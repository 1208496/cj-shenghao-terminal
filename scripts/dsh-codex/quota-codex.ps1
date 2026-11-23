<#
.SYNOPSIS
    查询 Codex（ChatGPT 账号）的额度快照。零模型调用，只走 app-server 只读 RPC。

.DESCRIPTION
    Codex CLI 没有 `/usage` 之类子命令，额度只存在于服务端的 rateLimits 对象里。
    本脚本以 stdio JSON-RPC 启动 `codex app-server`，发送：
      initialize → initialized → account/rateLimits/read
    读取返回的 primary / secondary 窗口（usedPercent / windowDurationMins / resetsAt）、
    planType、credits、重置券数量，并换算成北京时间的重置时刻。

    依据 reports/DSH接入Codex方案-20261122.md 与 2026-11-22 实测：
      - 方法名 `account/rateLimits/read` 来自 `codex app-server generate-json-schema` 的 ClientRequest.json
      - 返回结构见 v2/GetAccountRateLimitsResponse.json
      - 不调用任何模型，不消耗额度

    Codex 侧不设探针（~/.dsh/AGENTS.md §3.1）：坏了通常直接不回复，靠调用超时与空输出发现。

.PARAMETER TimeoutSec
    每次 RPC 读取的超时秒数，默认 60。

.PARAMETER Json
    只输出原始 JSON，便于程序消费。

.EXAMPLE
    .\quota-codex.ps1
    .\quota-codex.ps1 -Json | ConvertFrom-Json
#>
[CmdletBinding()]
param(
    [int]$TimeoutSec = 60,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$CODEX     = 'C:\Users\Administrator\AppData\Roaming\npm\codex.cmd'

$psi = [System.Diagnostics.ProcessStartInfo]::new('cmd.exe')
$psi.Arguments              = '/d /s /c "' + '"' + $CODEX + '" app-server"'
$psi.UseShellExecute        = $false
$psi.RedirectStandardInput  = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError  = $true
$psi.StandardOutputEncoding = $utf8NoBom
$psi.StandardErrorEncoding  = $utf8NoBom
$psi.CreateNoWindow         = $true

$proc = [System.Diagnostics.Process]::Start($psi)
$errTask = $proc.StandardError.ReadToEndAsync()

function Send-Rpc($obj) {
    $proc.StandardInput.WriteLine(($obj | ConvertTo-Json -Compress -Depth 10))
    $proc.StandardInput.Flush()
}

function Read-Until([int]$id, [int]$timeoutSec) {
    $deadline = (Get-Date).AddSeconds($timeoutSec)
    while ((Get-Date) -lt $deadline) {
        $remainingMs = [int][Math]::Max(200, ($deadline - (Get-Date)).TotalMilliseconds)
        $t = $proc.StandardOutput.ReadLineAsync()
        if (-not $t.Wait($remainingMs)) { return $null }
        $line = $t.Result
        if ($null -eq $line) { return $null }
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        try { $msg = $line | ConvertFrom-Json -Depth 20 } catch { continue }
        if ($msg.id -eq $id) { return $msg }
    }
    return $null
}

try {
    Send-Rpc @{ jsonrpc = '2.0'; id = 1; method = 'initialize'
                params  = @{ clientInfo = @{ name = 'dsh-quota'; version = '1.0.0' } } }
    $init = Read-Until 1 $TimeoutSec
    if (-not $init) { throw "initialize 无响应（${TimeoutSec}s 超时）。Codex 通道可能已坏。" }

    Send-Rpc @{ jsonrpc = '2.0'; method = 'initialized'; params = @{} }

    Send-Rpc @{ jsonrpc = '2.0'; id = 2; method = 'account/rateLimits/read'
                params  = @{ supportsLunaReserve = $true } }
    $rlMsg = Read-Until 2 $TimeoutSec
    if (-not $rlMsg) { throw "account/rateLimits/read 无响应（${TimeoutSec}s 超时）。" }
    if ($rlMsg.error) { throw "RPC 错误: $($rlMsg.error.message)" }

    Send-Rpc @{ jsonrpc = '2.0'; id = 3; method = 'account/read'; params = @{} }
    $acctMsg = Read-Until 3 20
}
finally {
    try { $proc.StandardInput.Close() } catch {}
    Start-Sleep -Milliseconds 300
    if (-not $proc.HasExited) {
        # 仅清理本脚本自己启动的查询进程，不涉及任何 agy / Codex 正式任务
        & taskkill.exe /PID $proc.Id /T /F | Out-Null
    }
    try { $proc.WaitForExit(3000) | Out-Null } catch {}
}

$res  = $rlMsg.result
$rl   = $res.rateLimits
$p    = $rl.primary
$s    = $rl.secondary
$acct = if ($acctMsg -and $acctMsg.result) { $acctMsg.result.account } else { $null }

function Convert-Ts($ts) {
    if (-not $ts) { return $null }
    try { return [DateTimeOffset]::FromUnixTimeSeconds([int64]$ts).ToLocalTime() } catch { return $null }
}

$now        = Get-Date
$resetAt    = Convert-Ts $p.resetsAt
$hoursLeft  = if ($resetAt) { [Math]::Round(($resetAt.DateTime - $now).TotalHours, 2) } else { $null }
$remaining  = if ($null -ne $p.usedPercent) { 100 - [int]$p.usedPercent } else { $null }
$windowDays = if ($p.windowDurationMins) { [Math]::Round($p.windowDurationMins / 1440, 2) } else { $null }

# 兜底判定：服务端 usedPercent 取整到百位，与实际剩余存在误差
$fallbackLikely = ($null -ne $p.usedPercent) -and ([int]$p.usedPercent -ge 95) -and ($res.ordinaryUsageAllowed -eq $true)

$snapshot = [ordered]@{
    queried_at_local     = $now.ToString('yyyy-MM-dd HH:mm:ss')
    account              = if ($acct) { $acct.email } else { $null }
    account_type         = if ($acct) { $acct.type } else { $null }
    plan_type            = $rl.planType
    window               = [ordered]@{
        limit_id          = $rl.limitId
        used_percent      = $p.usedPercent
        remaining_percent = $remaining
        window_days       = $windowDays
        resets_at_local   = if ($resetAt) { $resetAt.ToString('yyyy-MM-dd HH:mm:ss') } else { $null }
        hours_until_reset = $hoursLeft
    }
    secondary_window     = if ($s) {
        [ordered]@{ used_percent = $s.usedPercent; window_days = [Math]::Round($s.windowDurationMins / 1440, 2)
                    resets_at_local = (Convert-Ts $s.resetsAt).ToString('yyyy-MM-dd HH:mm:ss') }
    } else { $null }
    credits              = [ordered]@{
        has_credits = $rl.credits.hasCredits
        unlimited   = $rl.credits.unlimited
        balance     = $rl.credits.balance
    }
    reset_credits_available = $res.rateLimitResetCredits.availableCount
    ordinary_usage_allowed  = $res.ordinaryUsageAllowed
    rate_limit_reached_type = $rl.rateLimitReachedType
    spend_control_reached   = $rl.spendControlReached
    fallback_likely         = $fallbackLikely
    note = 'usedPercent 由服务端取整；桌面端可能显示更细的剩余值。fallback_likely 表示主额度近耗尽但仍允许调用，实际档位可能已降级。'
}

if ($Json) {
    $snapshot | ConvertTo-Json -Depth 8
    exit 0
}

$snapshot | ConvertTo-Json -Depth 8

Write-Host ''
Write-Host "账号      : $($snapshot.account) ($($snapshot.account_type))  计划: $($snapshot.plan_type)"
Write-Host "周窗口    : 已用 $($snapshot.window.used_percent)%  剩余约 $($snapshot.window.remaining_percent)%  ($($snapshot.window.window_days) 天)"
Write-Host "重置时间  : $($snapshot.window.resets_at_local)  距现在 $($snapshot.window.hours_until_reset) 小时"
Write-Host "兜底态    : $($snapshot.fallback_likely)  (ordinaryUsageAllowed=$($snapshot.ordinary_usage_allowed))"

if ($fallbackLikely) {
    Write-Warning '主额度接近耗尽，当前仍允许调用说明可能已走兜底通道；此时不宜派正式重活，等重置后再做。'
}
