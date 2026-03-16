# Environment and GitHub Bootstrap v0.3.1

## Purpose

This document makes the repository runnable on a new Windows device without relying on external notes.
It covers:
- local environment requirements
- project install and verification
- Git metadata initialization when the project arrived as a zip or copied folder

This is an operational document, not a product-spec document.

## Required local environment

Target machine:
- Windows 10 or Windows 11

Required tools:
- Node.js `20.x`
- npm (bundled with Node.js)
- Git
- Python `3.12`
- Visual Studio 2022 Build Tools with C++ tools and Windows SDK

Why the native toolchain exists:
- Electron is part of the runtime
- `better-sqlite3` may need native rebuilds
- `npm run rebuild:native` depends on a working Python + MSVC toolchain

## Recommended install path

Use `winget` where available.

Recommended packages:
- `OpenJS.NodeJS.20`
- `Git.Git`
- `Python.Python.3.12`
- `Microsoft.VisualStudio.2022.BuildTools`

Recommended Build Tools workload:
- `Microsoft.VisualStudio.Workload.VCTools`

## Environment verification

Run these checks in a fresh terminal after installation:

```powershell
node -v
npm -v
git --version
python --version
```

Expected minimums:
- Node.js reports `20.x`
- npm is available
- Git is available
- Python is available

## UTF-8 terminal bootstrap

This repository keeps text files in UTF-8.
On Windows PowerShell, switch the terminal to UTF-8 before reviewing docs, copying terminal output, or editing markdown-heavy files.

Recommended for the current session:

```powershell
. .\scripts\enable-utf8-terminal.ps1
```

This sets:
- console input/output encoding to UTF-8
- PowerShell `$OutputEncoding` to UTF-8
- `Out-File` / `Set-Content` / `Add-Content` default encoding to UTF-8
- terminal code page to `65001`

Manual equivalent:

```powershell
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
chcp 65001
```

Doc-writing hygiene:
- prefer ASCII punctuation when it is equivalent, for example use `->` in place of a Unicode arrow
- if terminal output still looks garbled, open the file directly in an editor before resaving it

## Project bootstrap

From the repository root:

```powershell
npm install
npm run rebuild:native
npm run build
npm run test:mvp
npm run test:mvp:ui
```

Useful full check:

```powershell
npm run test:mvp:all
```

If `better-sqlite3` reports ABI or native-load problems, re-run:

```powershell
npm run rebuild:native
```

## GitHub bootstrap when `.git` is missing

This repository may be handed off as a zip or copied working directory.
In that case, the files are present but Git metadata is missing.

Preferred shortcut:

```powershell
npm run bootstrap:git
```

Default behavior:
- initialize `.git` if missing
- rename the primary branch to `main`
- automatically bind `origin` to `https://github.com/ALexZhang316/Enso.git`
- fetch remote metadata so `origin/*` branches are visible locally
- print remotes and current status

Optional initial commit:

```powershell
npm run bootstrap:git:commit
```

Check first:

```powershell
Test-Path .git
```

If `.git` already exists:
- skip repository initialization
- verify remotes with `git remote -v`

If you want to run the steps manually instead of using the script:

```powershell
git init
git branch -M main
git remote add origin https://github.com/ALexZhang316/Enso.git
git add .
git commit -m "chore: initialize repository from internalized baseline"
```

If you need a different remote, override the script default:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/bootstrap-git.ps1 -OriginUrl <your-repo-url>
```

## Optional Codex desktop bootstrap

If you want a new Windows device to reuse the same Codex desktop preferences stored in this repository, run:

```powershell
npm run bootstrap:codex
```

This applies:
- desktop `Codex.lnk` -> launch as administrator
- repository-packaged `config.toml` -> copied to `%USERPROFILE%\.codex\config.toml`
- Enter behavior -> newline by default, with `Ctrl+Enter` to send

Source files live in:
- `scripts/codex-windows-setup/`

Safety behavior:
- existing shortcut/config/state files are backed up before overwrite
- Codex should be launched once before running the script so the state file exists
- if Codex is already open, fully restart it after running the script

## Recommended remote layout

If you only need upstream read access:

```powershell
git remote add origin https://github.com/ALexZhang316/Enso.git
git remote -v
```

If you expect to push your own changes, prefer a fork-based layout:

```powershell
git remote add upstream https://github.com/ALexZhang316/Enso.git
git remote add origin <your-fork-url>
git remote -v
```

Recommended meaning:
- `upstream` = original source repository
- `origin` = your writable fork

## Post-init sanity check

After Git initialization, run:

```powershell
git status
git remote -v
```

The repository is ready for normal work once all are true:
- environment verification passes
- `npm run build` passes
- `npm run test:mvp:all` passes
- Git metadata exists if this copy is meant to sync with GitHub

## Maintenance rule

If environment requirements, bootstrap commands, or remote conventions change, update this file together with:
- `README.md`
- `AGENTS.md`
- `CLAUDE.md`
- `.editorconfig`
- `.gitattributes`
- `docs/codebase-contract.md` if onboarding order changes
