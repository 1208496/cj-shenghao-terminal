<#
.SYNOPSIS
    DSH 侧的 Codex 统一调用器：文件重定向流式落盘 + 看门狗 + 权限档位锁 + 运行留痕。

.DESCRIPTION
    依据 reports/DSH接入Codex方案-20261122.md §5.2 / §7.2 实现（agy 4N 于 2026-11-22 定稿）。
    与 agy 接入同构：prompt 走文件（规避 Windows 命令行长度与引号问题），stdout 落 JSONL 供解析，
    `-o` 落末条消息，超时由外部看门狗计时，整个进程树由 wrapper_pid 标识。

    权限档位（方案 §7.1）：
      1. read-only（默认，不传 -Mode 即此档）—— 代码审查、架构诊断、方案撰写
      2. workspace-write —— 允许 Codex 在工作区内写文件
      3. danger-full-access —— 禁区，必须同时传 -ConfirmBypassSandbox；不得出现在默认示例中

    超时语义：
      - 默认 $AutoKillOnTimeout = $false：超时只标记 TIMEOUT_WAITING_USER（退出码 125）后返回，
        进程树继续存活，处置权归 YG，由主代理按卡死流程取证上报。
      - 仅探针允许 -AutoKillOnTimeout，此时 taskkill /T /F 整树终止并退出码 124。

.PARAMETER Prompt
    直接传入 prompt 文本。与 -PromptFile 二选一。

.PARAMETER PromptFile
    prompt 文件路径（UTF-8）。与 -Prompt 二选一，长 prompt 一律走这个。
#>
[CmdletBinding()]
param(
    [string]$Prompt = '',
    [string]$PromptFile = '',
    [string]$WorkDir = 'E:\SHZDCHOSSS',
    [ValidateSet('read-only', 'workspace-write', 'danger-full-access')]
    [string]$Mode = 'read-only',
    [switch]$ConfirmBypassSandbox,
    [string]$Model = '',
    [string]$SessionId = '',
    [switch]$Ephemeral,
    [int]$TimeoutSec = 900,
    [switch]$AutoKillOnTimeout,
    [string]$RunName = 'run',
    [string[]]$AddDir = @()
)

$ErrorActionPreference = 'Stop'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$CODEX     = 'C:\Users\Administrator\AppData\Roaming\npm\codex.cmd'

# ---- 档位 3 双开关拦截（方案 §7.2 第 3 条）----
if ($Mode -eq 'danger-full-access' -and -not $ConfirmBypassSandbox) {
    throw '档位 3（danger-full-access）必须同时传 -ConfirmBypassSandbox；默认与快捷模板中禁止出现此档。'
}
if ($Mode -ne 'read-only' -and $AutoKillOnTimeout) {
    throw '-AutoKillOnTimeout 仅限探针（read-only + 最省额度参数组合）使用。'
}

# ---- prompt 来源 ----
if (-not $Prompt -and -not $PromptFile) { throw '必须提供 -Prompt 或 -PromptFile 之一。' }
if ($Prompt -and $PromptFile)           { throw '-Prompt 与 -PromptFile 只能二选一。' }

# ---- 运行目录五件套（方案 §8.2）----
$base   = 'E:\SHZDCHOSSS\.work\codex-runs'
$runId  = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + $RunName
$RunDir = Join-Path $base $runId
New-Item -ItemType Directory -Path $base   -Force | Out-Null
New-Item -ItemType Directory -Path $RunDir -Force | Out-Null

$PromptPath = Join-Path $RunDir 'prompt.txt'
$JsonlFile  = Join-Path $RunDir 'stdout.jsonl'
$StderrFile = Join-Path $RunDir 'stderr.log'
$OutFile    = Join-Path $RunDir 'last-message.md'
$MetaFile   = Join-Path $RunDir 'run.meta.json'

if ($PromptFile) {
    $text = [System.IO.File]::ReadAllText($PromptFile, $utf8NoBom)
} else {
    $text = $Prompt
}
[System.IO.File]::WriteAllText($PromptPath, $text, $utf8NoBom)

# ---- 参数组装：resume 分支与新建分支的选项集合不同（方案 §4.2）----
$cmdArgs = @()
if ($SessionId) {
    $cmdArgs += @('-a', 'never', 'exec', 'resume', '--json', '-o', $OutFile)
    if ($Mode -eq 'danger-full-access') { $cmdArgs += '--dangerously-bypass-approvals-and-sandbox' }
    if ($Model)     { $cmdArgs += @('-m', $Model) }
    if ($Ephemeral) { $cmdArgs += '--ephemeral' }
    $cmdArgs += @($SessionId, '-')
    $effectiveSandbox = if ($Mode -eq 'danger-full-access') { 'bypass' } else { '(resume 未显式传 -s，继承会话配置)' }
} else {
    $cmdArgs += @('-a', 'never', 'exec')
    if ($Mode -eq 'danger-full-access') {
        $cmdArgs += '--dangerously-bypass-approvals-and-sandbox'
        $effectiveSandbox = 'bypass'
    } else {
        $cmdArgs += @('-s', $Mode)
        $effectiveSandbox = $Mode
    }
    $cmdArgs += @('-C', $WorkDir, '--color', 'never', '--json', '-o', $OutFile)
    if ($Model) { $cmdArgs += @('-m', $Model) }
    foreach ($d in $AddDir) { $cmdArgs += @('--add-dir', $d) }
    if ($Ephemeral) { $cmdArgs += '--ephemeral' }
    $cmdArgs += '-'
}

$quoted = $cmdArgs | ForEach-Object {
    if ([string]::IsNullOrEmpty($_)) { '""' }
    elseif ($_ -match '[\s"]')      { '"' + ($_ -replace '"', '\"') + '"' }
    else                            { $_ }
}
$argStr = $quoted -join ' '

$cmdLine = '/d /s /c "' + '"' + $CODEX + '" ' + $argStr + ' < "' + $PromptPath + '" 1>"' + $JsonlFile + '" 2>"' + $StderrFile + '""'

# ---- git 越权基线（仅 read-only 档，方案 §7.2 第 4 条）----
$gitBefore = @()
if ($Mode -eq 'read-only' -and -not $SessionId) {
    try { $gitBefore = @(git -C $WorkDir status --porcelain 2>$null) } catch { $gitBefore = @() }
}

# ---- 启动 ----
$psi = [System.Diagnostics.ProcessStartInfo]::new('cmd.exe', $cmdLine)
$psi.WorkingDirectory = $WorkDir
$psi.UseShellExecute  = $false

$sw   = [System.Diagnostics.Stopwatch]::StartNew()
$proc = [System.Diagnostics.Process]::Start($psi)

$meta = [ordered]@{
    run_id            = $runId
    run_dir           = $RunDir
    wrapper_pid       = $proc.Id
    started_at        = (Get-Date -Format 'o')
    timeout_sec       = $TimeoutSec
    auto_kill         = [bool]$AutoKillOnTimeout
    mode              = $Mode
    effective_sandbox = $effectiveSandbox
    model             = if ($Model) { $Model } else { '(default)' }
    session_id        = $SessionId
    ephemeral         = [bool]$Ephemeral
    work_dir          = $WorkDir
    prompt_chars      = $text.Length
    prompt_file       = $PromptPath
    jsonl_file        = $JsonlFile
    stderr_file       = $StderrFile
    out_file          = $OutFile
    cmd_line          = $cmdLine
    status            = 'RUNNING'
}
$meta | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $MetaFile -Encoding utf8NoBOM

# ---- 看门狗轮询（非死等）----
$killed = $false
while (-not $proc.HasExited) {
    Start-Sleep -Seconds 2
    if ($sw.Elapsed.TotalSeconds -ge $TimeoutSec) {
        if ($AutoKillOnTimeout) {
            & taskkill.exe /PID $proc.Id /T /F | Out-Null
            $killed = $true
        }
        break
    }
}
$sw.Stop()

$exitCode = if ($killed) { 124 } else { $proc.ExitCode }
$status   = if ($killed) { 'TIMEOUT_KILLED' }
            elseif (-not $proc.HasExited) { 'TIMEOUT_WAITING_USER' }
            elseif ($exitCode -eq 0) { 'EXITED_OK' }
            else { 'EXITED_ERR' }
if ($status -eq 'TIMEOUT_WAITING_USER') { $exitCode = 125 }

# ---- 后置校验 ----
$gitAfter = @()
if ($Mode -eq 'read-only' -and -not $SessionId) {
    try { $gitAfter = @(git -C $WorkDir status --porcelain 2>$null) } catch { $gitAfter = @() }
}
$gitDelta = @()
if ($gitBefore.Count -gt 0 -or $gitAfter.Count -gt 0) {
    $gitDelta = @(Compare-Object -ReferenceObject $gitBefore -DifferenceObject $gitAfter |
        Where-Object { $_.InputObject -notmatch '\.work[/\\]codex-runs' } |
        ForEach-Object { $_.InputObject })
}

$hasOut   = (Test-Path -LiteralPath $OutFile)    -and ((Get-Item -LiteralPath $OutFile).Length -gt 0)
$hasJsonl = (Test-Path -LiteralPath $JsonlFile)  -and ((Get-Item -LiteralPath $JsonlFile).Length -gt 0)

$meta.status      = $status
$meta.exit_code   = $exitCode
$meta.elapsed_sec = [math]::Round($sw.Elapsed.TotalSeconds, 1)
$meta.ended_at    = (Get-Date -Format 'o')
$meta.has_out     = $hasOut
$meta.has_jsonl   = $hasJsonl
$meta.git_delta   = $gitDelta
$meta | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $MetaFile -Encoding utf8NoBOM

[pscustomobject]@{
    Status       = $status
    ExitCode     = $exitCode
    ElapsedSec   = [math]::Round($sw.Elapsed.TotalSeconds, 1)
    WrapperPid   = $proc.Id
    RunDir       = $RunDir
    JsonlFile    = $JsonlFile
    StderrFile   = $StderrFile
    OutFile      = $OutFile
    MetaFile     = $MetaFile
    HasOut       = $hasOut
    HasJsonl     = $hasJsonl
    GitDelta     = $gitDelta
    Sandbox      = $effectiveSandbox
} | ConvertTo-Json -Depth 5

if ($status -eq 'TIMEOUT_KILLED') { exit 124 }
if ($status -eq 'TIMEOUT_WAITING_USER') { exit 125 }
if ($status -eq 'EXITED_ERR') { exit 1 }
exit 0
