<#
.SYNOPSIS
    Codex 通道探针：60 秒硬闸，只回答「该模型通道现在能不能通」。零正式任务内容。

.DESCRIPTION
    ⚠ 2026-11-22 YG 判定：**Codex 侧不设探针**（见 ~/.dsh/AGENTS.md §3.1）。Codex 坏了通常直接不回复，
    靠调用超时与空输出即可发现，不必多花一次额度去验。本脚本保留为「需要单独验通道时手动跑」的工具，
    不再是任何流程的前置门禁；日常查可用性用 quota-codex.ps1。

    依据 reports/DSH接入Codex方案-20261122.md §6.2 实现（agy 4N 于 2026-11-22 定稿）。
    参数组合固定最省额度：-a never / -s read-only / --ephemeral / --skip-git-repo-check / --color never。
    60 秒未退出 → taskkill /PID <wrapper> /T /F 整树终止。这是执行代理唯一可自行结束 Codex 进程的情形，
    且仅限探针进程（同构 agy §3.4）。

    探针失败（超时被杀 / 非零退出 / 没有回字）→ 调用方必须终止本批次，一次报齐五项，不换模型、不改 prompt 重发。

.PARAMETER Model
    模型 id。留空则沿用 ~/.codex/config.toml 的默认模型。

.PARAMETER Config
    配置覆盖项，等价于 `-c KEY=VALUE`，逐个元素传入。例如 `-Config 'model_reasoning_effort=low'`。
    注意 value 不加引号：Codex 会先按 TOML 解析，失败则按原始字面量使用。

.PARAMETER TimeoutSec
    硬闸秒数，默认 60。
#>
[CmdletBinding()]
param(
    [string]$Model = '',
    [string[]]$Config = @(),
    [int]$TimeoutSec = 60
)

$ErrorActionPreference = 'Stop'

$CODEX      = 'C:\Users\Administrator\AppData\Roaming\npm\codex.cmd'
$WorkDir    = 'E:\SHZDCHOSSS'
$HistoryDir = 'E:\SHZDCHOSSS\.work\codex-runs'
$RunDir     = Join-Path $HistoryDir ("probe-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))

New-Item -ItemType Directory -Path $RunDir     -Force | Out-Null
New-Item -ItemType Directory -Path $HistoryDir -Force | Out-Null

$PromptFile = Join-Path $RunDir 'prompt.txt'
$JsonlFile  = Join-Path $RunDir 'stdout.jsonl'
$StderrFile = Join-Path $RunDir 'stderr.log'
$OutFile    = Join-Path $RunDir 'last-message.md'

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($PromptFile, '只回复一个字：好', $utf8NoBom)

$allArgs = @('-a', 'never', 'exec', '-s', 'read-only', '--ephemeral', '--skip-git-repo-check', '--color', 'never')
if ($Model) { $allArgs += @('-m', $Model) }
foreach ($kv in $Config) { if ($kv) { $allArgs += @('-c', $kv) } }
$allArgs += @('--json', '-o', $OutFile, '-')

$quoted = $allArgs | ForEach-Object {
    if ([string]::IsNullOrEmpty($_)) { '""' }
    elseif ($_ -match '[\s"]')      { '"' + ($_ -replace '"', '\"') + '"' }
    else                            { $_ }
}

$cmdLine = '/d /s /c "' + '"' + $CODEX + '" ' + ($quoted -join ' ') +
           ' < "' + $PromptFile + '" 1>"' + $JsonlFile + '" 2>"' + $StderrFile + '""'

$psi = [System.Diagnostics.ProcessStartInfo]::new('cmd.exe', $cmdLine)
$psi.WorkingDirectory = $WorkDir
$psi.UseShellExecute  = $false

$sw   = [System.Diagnostics.Stopwatch]::StartNew()
$proc = [System.Diagnostics.Process]::Start($psi)

$killed = $false
while (-not $proc.HasExited) {
    Start-Sleep -Milliseconds 500
    if ($sw.Elapsed.TotalSeconds -ge $TimeoutSec) {
        & taskkill.exe /PID $proc.Id /T /F | Out-Null
        $killed = $true
        break
    }
}
$sw.Stop()

$reply = ''
if ((Test-Path -LiteralPath $OutFile) -and (Get-Item -LiteralPath $OutFile).Length -gt 0) {
    $reply = ([System.IO.File]::ReadAllText($OutFile, $utf8NoBom)).Trim()
}

$exitCode = if ($killed) { 124 } else { $proc.ExitCode }
$passed   = (-not $killed) -and ($exitCode -eq 0) -and ($reply.Length -gt 0)
$residue  = @(Get-Process -Name codex -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)

$record = [pscustomobject]@{
    timestamp        = (Get-Date -Format 'o')
    model            = if ($Model) { $Model } else { '(default)' }
    config           = @($Config)
    passed           = $passed
    killed           = $killed
    exit_code        = $exitCode
    elapsed_sec      = [math]::Round($sw.Elapsed.TotalSeconds, 1)
    wrapper_pid      = $proc.Id
    codex_residue_pid = @($residue)
    reply            = $reply
    run_dir          = $RunDir
    jsonl_file       = $JsonlFile
    stderr_file      = $StderrFile
}

$record | ConvertTo-Json -Compress | Add-Content -LiteralPath (Join-Path $HistoryDir 'probe-history.jsonl') -Encoding utf8NoBOM

$record | ConvertTo-Json -Depth 5
