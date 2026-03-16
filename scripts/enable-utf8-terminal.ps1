[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

# 让当前 PowerShell 会话和子进程尽量统一使用 UTF-8，减少文档与日志错码。
[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom

$PSDefaultParameterValues["Out-File:Encoding"] = "utf8"
$PSDefaultParameterValues["Set-Content:Encoding"] = "utf8"
$PSDefaultParameterValues["Add-Content:Encoding"] = "utf8"

cmd /c chcp 65001 > $null
$codePageLine = (& cmd /c chcp | Out-String).Trim()
$codePage = ([regex]::Match($codePageLine, "\d+")).Value

Write-Host "UTF-8 terminal profile enabled."
Write-Host "Code page: $codePage"
Write-Host "Console encoding: $([Console]::OutputEncoding.WebName)"
Write-Host "PowerShell output encoding: $($OutputEncoding.WebName)"
Write-Host "Tip: dot-source this script to keep the settings in the current session."
Write-Host "Example: . .\scripts\enable-utf8-terminal.ps1"
