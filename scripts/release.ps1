# Requires PowerShell 7. This command tests, builds, pushes, verifies CDN and flips a pointer.
param(
    [string]$Message = 'Publish terminal script',
    [string]$EnvFile = (Join-Path ([Environment]::GetFolderPath('UserProfile')) '.secrets/cj-shenghao-terminal.env'),
    [switch]$Bootstrap
)
$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSVersion.Major -lt 7) { throw 'Use PowerShell 7 (pwsh).' }
$repoDir = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$configPath = Join-Path $repoDir 'release/loader.config.json'
$config = Get-Content -LiteralPath $configPath -Raw -Encoding utf8 | ConvertFrom-Json
$servicePath = (Resolve-Path -LiteralPath $EnvFile).ProviderPath
if ($servicePath.StartsWith($repoDir + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'The service/secret key file must stay outside the repository.'
}
$serviceKey = ''
foreach ($line in Get-Content -LiteralPath $servicePath -Encoding utf8) {
    if ($line -match '^\s*SUPABASE_SERVICE_KEY\s*=\s*(.+?)\s*$') { $serviceKey = $Matches[1].Trim(); break }
}
if (-not $serviceKey) { throw 'SUPABASE_SERVICE_KEY is missing; no release was attempted.' }
$headers = @{ apikey = $serviceKey }
if (-not $serviceKey.StartsWith('sb_secret_')) {
    # Legacy service_role is a JWT; modern sb_secret_ keys are sent only in apikey.
    $headers.Authorization = 'Bearer ' + $serviceKey
}
$ua = 'cj-shenghao-script-release/1.0'
$endpoint = $config.supabaseUrl + '/rest/v1/' + $config.table
$tempCore = $null; $tempMeta = $null
Push-Location $repoDir
try {
    & node scripts/validate-release-config.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Public loader configuration is not ready.' }
    $remote = (& git remote get-url origin).Trim()
    if ($LASTEXITCODE -ne 0 -or $remote -ne ('https://github.com/' + $config.repository + '.git')) { throw 'Unexpected release remote.' }
    $branch = (& git branch --show-current).Trim()
    if ($LASTEXITCODE -ne 0 -or $branch -ne 'main') { throw 'Release only from main.' }
    & npm run test
    if ($LASTEXITCODE -ne 0) { throw 'Tests failed; pointer was not changed.' }
    & node scripts/build.mjs --core-only
    if ($LASTEXITCODE -ne 0) { throw 'Core build failed; pointer was not changed.' }
    & node --check dist/terminal.js
    if ($LASTEXITCODE -ne 0) { throw 'Syntax check failed; pointer was not changed.' }

    # Publishing a commit is not switching players to it.
    & git add -A
    if ($LASTEXITCODE -ne 0) { throw 'Staging failed.' }
    & git diff --cached --quiet
    $diffExit = $LASTEXITCODE
    if ($diffExit -notin @(0,1)) { throw 'Cannot inspect staged changes; pointer unchanged.' }
    if ($diffExit -eq 1) {
        & git commit -m $Message
        if ($LASTEXITCODE -ne 0) { throw 'Commit failed; pointer was not changed.' }
    }
    & git push origin main
    if ($LASTEXITCODE -ne 0) { throw 'Push failed; pointer was not changed.' }
    $ref = (& git rev-parse HEAD).Trim()
    if ($ref -notmatch '^[a-f0-9]{40}$') { throw 'Invalid release commit.' }
    $corePath = Join-Path $repoDir $config.file
    $metaPath = Join-Path $repoDir $config.metadataFile
    $wantCore = [IO.File]::ReadAllText($corePath, [Text.Encoding]::UTF8)
    $wantMeta = [IO.File]::ReadAllText($metaPath, [Text.Encoding]::UTF8)
    if (-not $wantCore.StartsWith('// ' + $config.mark)) { throw 'Core marker missing.' }
    $metadata = $wantMeta | ConvertFrom-Json
    if ((Get-FileHash -LiteralPath $corePath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $metadata.sha256) { throw 'Local SHA mismatch.' }
    $tempCore = [IO.Path]::GetTempFileName(); $tempMeta = [IO.Path]::GetTempFileName()
    $ready = $false
    foreach ($attempt in 1..10) {
        foreach ($hostName in @('testingcf.jsdelivr.net', 'fastly.jsdelivr.net', 'cdn.jsdelivr.net')) {
            try {
                $prefix = 'https://' + $hostName + '/gh/' + $config.repository + '@' + $ref + '/'
                Invoke-WebRequest -Uri ($prefix + $config.file) -OutFile $tempCore -TimeoutSec 30 -UserAgent $ua
                Invoke-WebRequest -Uri ($prefix + $config.metadataFile) -OutFile $tempMeta -TimeoutSec 30 -UserAgent $ua
                if ([IO.File]::ReadAllText($tempCore, [Text.Encoding]::UTF8) -ceq $wantCore -and
                    [IO.File]::ReadAllText($tempMeta, [Text.Encoding]::UTF8) -ceq $wantMeta) { $ready = $true; break }
            } catch { Write-Host ('CDN not ready: ' + $hostName + ', attempt ' + $attempt) }
        }
        if ($ready) { break }
        if ($attempt -lt 10) { Start-Sleep -Seconds 15 }
    }
    if (-not $ready) { throw 'CDN did not match local files. Pointer unchanged; retry later.' }

    # A full-card baseline must match the embedded schema/worldbook/regex contract.
    $baselineCompatible = $false
    if ($config.fallbackRef -match '^[a-f0-9]{40}$') {
        try {
            $baselineText = & git show ($config.fallbackRef + ':' + $config.metadataFile)
            if ($LASTEXITCODE -eq 0) { $baselineCompatible = (($baselineText -join "`n" | ConvertFrom-Json).worldbookHash -eq $metadata.worldbookHash) }
        } catch { $baselineCompatible = $false }
    }
    if ($Bootstrap -or -not $baselineCompatible) {
        $config.fallbackRef = $ref
        [IO.File]::WriteAllText($configPath, ($config | ConvertTo-Json -Depth 20) + "`n", [Text.UTF8Encoding]::new($false))
    }
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Loader/card packaging failed; pointer unchanged.' }
    & npm run check
    if ($LASTEXITCODE -ne 0) { throw 'Artifact verification failed; pointer unchanged.' }
    if ([IO.File]::ReadAllText($corePath, [Text.Encoding]::UTF8) -cne $wantCore) { throw 'Packaging changed core bytes; pointer unchanged.' }
    & git add -A
    if ($LASTEXITCODE -ne 0) { throw 'Card staging failed; pointer unchanged.' }
    & git diff --cached --quiet
    $diffExit = $LASTEXITCODE
    if ($diffExit -notin @(0,1)) { throw 'Cannot inspect staged card changes; pointer unchanged.' }
    if ($diffExit -eq 1) {
        & git commit -m ('Package fixed loader: ' + $Message)
        if ($LASTEXITCODE -ne 0) { throw 'Card commit failed; pointer unchanged.' }
    }
    & git push origin main
    if ($LASTEXITCODE -ne 0) { throw 'Card push failed; pointer unchanged.' }

    # The ONLY online switch is last. Never clear the emergency-off row here.
    $oldRows = @(Invoke-RestMethod -Uri ($endpoint + '?key=eq.' + $config.refKey + '&select=value') -Headers $headers -UserAgent $ua)
    $previous = if ($oldRows.Count) { [string]$oldRows[0].value } else { '' }
    $body = ConvertTo-Json -InputObject @(@{ key = $config.refKey; value = $ref }) -Compress
    $writeHeaders = $headers.Clone(); $writeHeaders.Prefer = 'resolution=merge-duplicates,return=representation'
    $result = @(Invoke-RestMethod -Method Post -Uri ($endpoint + '?on_conflict=key') -Headers $writeHeaders -UserAgent $ua -ContentType 'application/json' -Body $body)
    if ($result.Count -ne 1 -or $result[0].value -cne $ref) { throw 'Pointer write did not return the expected commit.' }
    $readBack = @(Invoke-RestMethod -Uri ($endpoint + '?key=eq.' + $config.refKey + '&select=value') -Headers $headers -UserAgent $ua)
    if ($readBack.Count -ne 1 -or $readBack[0].value -cne $ref) { throw 'Pointer read-back did not match; inspect server state before retrying.' }
    Write-Host ('LIVE: ' + $config.refKey + ' = ' + $ref)
    if ($previous -match '^[a-f0-9]{40}$') { Write-Host ('Previous commit for rollback: ' + $previous) }
} finally {
    Pop-Location
    if ($tempCore) { Remove-Item -LiteralPath $tempCore -ErrorAction SilentlyContinue }
    if ($tempMeta) { Remove-Item -LiteralPath $tempMeta -ErrorAction SilentlyContinue }
    $serviceKey = $null; $headers = $null
}
