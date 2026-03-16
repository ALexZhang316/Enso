Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step {
    param([string]$Message)
    Write-Host "[Codex Setup] $Message" -ForegroundColor Cyan
}

function Backup-File {
    param(
        [string]$Path,
        [string]$BackupDir,
        [string]$BackupName
    )

    if (-not (Test-Path $Path)) {
        return
    }

    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    Copy-Item $Path (Join-Path $BackupDir $BackupName) -Force
}

$desktopPath = [Environment]::GetFolderPath('Desktop')
$userProfile = $env:USERPROFILE
$localAppData = $env:LOCALAPPDATA
$shortcutPath = Join-Path $desktopPath 'Codex.lnk'
$shortcutBackupDir = Join-Path $localAppData 'OpenAI\CodexShortcutBackup'
$packagedConfigPath = Join-Path $PSScriptRoot 'config.toml'
$codexConfigDir = Join-Path $userProfile '.codex'
$codexConfigPath = Join-Path $codexConfigDir 'config.toml'
$codexConfigBackupPath = Join-Path $codexConfigDir 'config.toml.bak-from-setup'
$statePath = Join-Path $userProfile '.codex\.codex-global-state.json'
$stateBackupPath = Join-Path $userProfile '.codex\.codex-global-state.json.bak-enter-behavior'
$powerShellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'

Write-Step 'Locating the installed Codex package'
$package = Get-AppxPackage OpenAI.Codex | Sort-Object Version -Descending | Select-Object -First 1
if (-not $package) {
    throw 'Codex is not installed. Install it and launch it once, then run this script again.'
}

$codexExePath = Join-Path $package.InstallLocation 'app\resources\codex.exe'
if (-not (Test-Path $codexExePath)) {
    throw "Could not find the Codex executable: $codexExePath"
}

Write-Step 'Updating the desktop shortcut'
Backup-File -Path $shortcutPath -BackupDir $shortcutBackupDir -BackupName 'Codex.original.lnk'

$launchCommand = "Start-Process -FilePath (Join-Path ((Get-AppxPackage OpenAI.Codex | Sort-Object Version -Descending | Select-Object -First 1).InstallLocation) 'app\resources\codex.exe') -Verb RunAs"
$shortcutArguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "' + $launchCommand + '"'

$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $powerShellPath
$shortcut.Arguments = $shortcutArguments
$shortcut.WorkingDirectory = $userProfile
$shortcut.IconLocation = "$codexExePath,0"
$shortcut.Description = 'Launch Codex as administrator'
$shortcut.WindowStyle = 7
$shortcut.Save()

Write-Step 'Applying the packaged Codex config'
if (-not (Test-Path $packagedConfigPath)) {
    Write-Warning "Could not find the packaged config file: $packagedConfigPath"
} else {
    New-Item -ItemType Directory -Path $codexConfigDir -Force | Out-Null
    Backup-File -Path $codexConfigPath -BackupDir $codexConfigDir -BackupName (Split-Path $codexConfigBackupPath -Leaf)
    Copy-Item $packagedConfigPath $codexConfigPath -Force
}

Write-Step 'Updating Enter behavior to newline'
if (-not (Test-Path $statePath)) {
    Write-Warning "Could not find the Codex state file: $statePath"
    Write-Warning 'Launch Codex once, then rerun this script to apply Enter-as-newline.'
} else {
    Backup-File -Path $statePath -BackupDir (Split-Path $stateBackupPath) -BackupName (Split-Path $stateBackupPath -Leaf)

    $stateContent = Get-Content $statePath -Raw
    $updatedState = [regex]::Replace(
        $stateContent,
        '"enter-behavior":"[^"]*"',
        '"enter-behavior":"newline"',
        1
    )

    if ($updatedState -eq $stateContent) {
        $updatedState = [regex]::Replace(
            $stateContent,
            '"electron-persisted-atom-state":\{',
            '"electron-persisted-atom-state":{"enter-behavior":"newline",',
            1
        )
    }

    if ($updatedState -eq $stateContent) {
        Write-Warning 'Could not locate a writable enter-behavior setting. Enter behavior was not changed.'
    } else {
        [System.IO.File]::WriteAllText(
            $statePath,
            $updatedState,
            [System.Text.UTF8Encoding]::new($false)
        )
    }
}

$enterBehaviorApplied = $false
if (Test-Path $statePath) {
    $enterBehaviorApplied = Select-String -Path $statePath -Pattern '"enter-behavior":"newline"' -Quiet
}

$runningCodex = @(Get-Process Codex -ErrorAction SilentlyContinue)
$shortcutBackupPath = Join-Path $shortcutBackupDir 'Codex.original.lnk'

Write-Host ''
Write-Host 'Done:'
Write-Host '- The desktop Codex shortcut now launches as administrator.'
if (Test-Path $packagedConfigPath) {
    Write-Host '- The packaged Codex config has been copied into the user profile.'
}
if ($enterBehaviorApplied) {
    Write-Host '- Enter now inserts a newline. Use Ctrl+Enter to send.'
} else {
    Write-Host '- Enter behavior was not changed. Launch Codex once and rerun the script if needed.'
}

if ($runningCodex.Count -gt 0) {
    Write-Host '- Codex is currently running. Fully quit and reopen it so the Enter setting takes effect.'
}

Write-Host ''
Write-Host "Desktop shortcut: $shortcutPath"
Write-Host "Shortcut backup: $shortcutBackupPath"
Write-Host "Codex config: $codexConfigPath"
if (Test-Path $codexConfigBackupPath) {
    Write-Host "Codex config backup: $codexConfigBackupPath"
}
if (Test-Path $statePath) {
    Write-Host "State file: $statePath"
    Write-Host "State backup: $stateBackupPath"
}
