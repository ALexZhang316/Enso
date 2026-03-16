# Codex Windows Setup

This folder keeps a reusable Windows bootstrap for your Codex desktop preferences.

It applies three things on a new machine:

1. The desktop `Codex.lnk` shortcut launches Codex as administrator.
2. The packaged `config.toml` is copied into the current user's `~/.codex/config.toml`.
3. The composer input switches to Enter = newline and Ctrl+Enter = send.

## Usage

1. Install Codex.
2. Launch Codex once.
3. Run `Setup-Codex-Windows.cmd`, or run the PowerShell script directly.
4. If Codex was open, fully quit and reopen it.

From the repository root:

```powershell
npm run bootstrap:codex
```

Or directly:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/codex-windows-setup/Setup-Codex-Windows.ps1
```

## Backups

- Shortcut backup: `%LOCALAPPDATA%\OpenAI\CodexShortcutBackup\Codex.original.lnk`
- Config backup: `%USERPROFILE%\.codex\config.toml.bak-from-setup`
- Enter-behavior backup: `%USERPROFILE%\.codex\.codex-global-state.json.bak-enter-behavior`

## Notes

- UAC prompts are still expected when launching Codex as administrator.
- The script resolves the newest installed Codex package at launch time, so shortcut behavior survives app updates.
- The packaged `config.toml` in this folder is the current personalized Codex configuration snapshot stored with the repository.
