param([string]$Repo,[string]$Scenario,[string]$Report)
$ErrorActionPreference='Stop'
$global:case=$Scenario;$global:repo=$Repo;$global:adds=0;$global:diffs=0;$global:pushes=0;$global:writes=0;$global:written='';$global:commands=[Collections.Generic.List[string]]::new()
function global:node {
    $global:LASTEXITCODE=0
    if (($global:case -eq 'config' -and $args[0] -like '*validate-release*') -or ($global:case -eq 'core' -and $args[0] -like '*build.mjs') -or ($global:case -eq 'syntax' -and $args[0] -eq '--check')) {$global:LASTEXITCODE=1}
}
function global:npm {
    $global:LASTEXITCODE=0
    if ($args[1] -eq $global:case) {$global:LASTEXITCODE=1}
}
function global:git {
    $global:LASTEXITCODE=0;$global:commands.Add('git '+($args -join ' '))
    switch($args[0]) {
        'remote' { 'https://github.com/1208496/cj-shenghao-terminal.git' }
        'branch' { 'main' }
        'add' {$global:adds++;if (($global:case -eq 'stage' -and $global:adds -eq 1) -or ($global:case -eq 'package-stage' -and $global:adds -eq 2)) {$global:LASTEXITCODE=1}}
        'diff' {$global:diffs++;$global:LASTEXITCODE=1;if ($global:case -eq 'package-no-diff' -and $global:diffs -eq 2){$global:LASTEXITCODE=0};if ($global:case -eq 'diff-error'){$global:LASTEXITCODE=128}}
        'commit' {if (($global:case -eq 'commit' -and $global:adds -eq 1) -or ($global:case -eq 'package-commit' -and $global:adds -eq 2)){$global:LASTEXITCODE=1}}
        'push' {$global:pushes++;if (($global:case -eq 'push' -and $global:pushes -eq 1) -or ($global:case -eq 'package-push' -and $global:pushes -eq 2)){$global:LASTEXITCODE=1}}
        'rev-parse' { 'a'*40 }
        'show' { Get-Content -Raw (Join-Path $global:repo 'dist/release.json') }
    }
}
function global:Start-Sleep {}
function global:Invoke-WebRequest {
    param($Uri,$OutFile,$TimeoutSec,$UserAgent)
    if ($global:case -eq 'cdn') {throw 'CDN offline'}
    $name=if ($Uri.EndsWith('.json')) {'release.json'}else{'terminal.js'}
    Copy-Item -LiteralPath (Join-Path $global:repo ('dist/'+$name)) -Destination $OutFile -Force
}
function global:Invoke-RestMethod {
    param($Method,$Uri,$Headers,$UserAgent,$ContentType,$Body)
    if($Method -eq 'Post'){$global:writes++;$global:written=($Body | ConvertFrom-Json)[0].value;return @([pscustomobject]@{value=$global:written})}
    if($global:written){return @([pscustomobject]@{value=$(if($global:case -eq 'readback'){'wrong'}else{$global:written})})}
    return @()
}
$failure=''
try { & (Join-Path $Repo 'scripts/release.ps1') -EnvFile (Join-Path (Split-Path $Repo) 'service.env') -Bootstrap | Out-Null } catch {$failure=$_.Exception.Message}
@{writes=$global:writes;error=$failure;pushes=$global:pushes;commands=@($global:commands)} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $Report -Encoding utf8
