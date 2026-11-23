<#
.SYNOPSIS
    解析 Codex `exec --json` 产生的 JSONL 事件流，提取会话 ID、错误事件与最终助手消息。

.DESCRIPTION
    依据 reports/DSH接入Codex方案-20261122.md §4.1 实现（agy 4N 于 2026-11-22 定稿）。
    策略：`-o` 落盘的 last-message 文件为主，JSONL 扫描为辅。
    会话 ID 兼容三种字段名：thread_id / session_id / thread.id。
    本脚本只读，不发起任何模型调用，零额度消耗。

.PARAMETER JsonlFile
    `codex exec --json` 重定向得到的 stdout.jsonl 路径。

.PARAMETER OutFile
    可选，`-o` 落盘的末条消息文件路径（last-message.md）。

.OUTPUTS
    单行 JSON：SessionId / EventCount / LineCount / ErrorCount / Errors / FinalMessageChars / FinalMessage
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$JsonlFile,
    [string]$OutFile = ''
)

$ErrorActionPreference = 'Stop'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

$sessionId     = $null
$errors        = [System.Collections.Generic.List[string]]::new()
$lastAgentText = $null
$eventCount    = 0
$lineCount     = 0

if (Test-Path -LiteralPath $JsonlFile) {
    foreach ($line in [System.IO.File]::ReadLines($JsonlFile, $utf8NoBom)) {
        $lineCount++
        if ([string]::IsNullOrWhiteSpace($line)) { continue }

        try {
            $ev = $line | ConvertFrom-Json -Depth 32
            $eventCount++
        } catch {
            continue
        }

        # 提取会话 ID（兼容 thread_id / session_id / thread.id）
        if (-not $sessionId) {
            if ($ev.PSObject.Properties['thread_id'] -and $ev.thread_id)       { $sessionId = [string]$ev.thread_id }
            elseif ($ev.PSObject.Properties['session_id'] -and $ev.session_id) { $sessionId = [string]$ev.session_id }
            elseif ($ev.PSObject.Properties['thread'] -and $ev.thread.id)      { $sessionId = [string]$ev.thread.id }
        }

        # 记录错误 / 失败事件原文
        if ($ev.type -match 'error|failed') {
            $errors.Add($line)
        }

        # 兜底提取末条助手消息
        if ($ev.type -eq 'item.completed' -and $ev.item -and $ev.item.type -eq 'agent_message' -and $ev.item.text) {
            $lastAgentText = [string]$ev.item.text
        }
    }
}

$finalMessage = $null
if ($OutFile -and (Test-Path -LiteralPath $OutFile) -and (Get-Item -LiteralPath $OutFile).Length -gt 0) {
    $finalMessage = [System.IO.File]::ReadAllText($OutFile, $utf8NoBom)
} else {
    $finalMessage = $lastAgentText
}

[pscustomobject]@{
    SessionId         = $sessionId
    EventCount        = $eventCount
    LineCount         = $lineCount
    ErrorCount        = $errors.Count
    Errors            = @($errors)
    FinalMessageChars = if ($finalMessage) { $finalMessage.Length } else { 0 }
    FinalMessage      = $finalMessage
} | ConvertTo-Json -Depth 8
