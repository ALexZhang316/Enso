[CmdletBinding()]
param(
  [string]$OriginUrl = "https://github.com/ALexZhang316/Enso.git",
  [string]$UpstreamUrl = "",
  [switch]$InitialCommit,
  [string]$InitialCommitMessage = "chore: initialize repository from internalized baseline"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function RequireCommand {
  param(
    [string]$Name,
    [string]$InstallHint
  )

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is required. $InstallHint"
  }
}

function GetRemoteUrl {
  param([string]$Name)

  try {
    $value = git remote get-url $Name 2>$null
    if ($LASTEXITCODE -ne 0) {
      return ""
    }

    return ($value | Out-String).Trim()
  } catch {
    return ""
  }
}

function EnsureRemote {
  param(
    [string]$Name,
    [string]$Url
  )

  if ([string]::IsNullOrWhiteSpace($Url)) {
    return
  }

  $existingUrl = GetRemoteUrl -Name $Name

  if ([string]::IsNullOrWhiteSpace($existingUrl)) {
    Write-Host "Adding remote $Name -> $Url"
    git remote add $Name $Url
    return
  }

  if ($existingUrl -ne $Url) {
    Write-Host "Updating remote $Name -> $Url"
    git remote set-url $Name $Url
    return
  }

  Write-Host "Remote $Name already points to $Url"
}

function HasCommit {
  git rev-parse --verify HEAD *> $null
  return $LASTEXITCODE -eq 0
}

function HasGitIdentity {
  $userName = ""
  $userEmail = ""

  try {
    $userName = (git config user.name | Out-String).Trim()
    $userEmail = (git config user.email | Out-String).Trim()
  } catch {}

  return -not [string]::IsNullOrWhiteSpace($userName) -and -not [string]::IsNullOrWhiteSpace($userEmail)
}

function EnsureGitHubCliAuth {
  Write-Host "Checking GitHub CLI authentication..."
  & gh auth status
  if ($LASTEXITCODE -ne 0) {
    throw "GitHub CLI is installed but not authenticated. Run 'gh auth login' and retry."
  }
}

function LinkGitHubRepo {
  param([string]$RemoteName = "origin")

  $remoteUrl = GetRemoteUrl -Name $RemoteName
  if ([string]::IsNullOrWhiteSpace($remoteUrl)) {
    Write-Warning "Remote $RemoteName is not configured; skipping GitHub CLI repo linking."
    return
  }

  if ($remoteUrl -notmatch "github\.com[:/]") {
    Write-Warning "Remote $RemoteName is not a GitHub URL; skipping GitHub CLI repo linking."
    return
  }

  Write-Host "Linking GitHub CLI default repo -> $RemoteName"
  & gh repo set-default $RemoteName
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to link GitHub CLI default repo to remote '$RemoteName'."
  }

  Write-Host "GitHub CLI default repo:"
  & gh repo set-default --view
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to verify the GitHub CLI default repo."
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot

try {
  RequireCommand -Name "git" -InstallHint "Install Git and retry."
  RequireCommand -Name "gh" -InstallHint "Install GitHub CLI ('gh') and retry."
  EnsureGitHubCliAuth

  # Initialize .git when missing and bind the default remote.
  if (-not (Test-Path ".git")) {
    Write-Host "Initializing git repository..."
    git init
  } else {
    Write-Host "Git repository already exists."
  }

  git branch -M main
  EnsureRemote -Name "origin" -Url $OriginUrl
  LinkGitHubRepo -RemoteName "origin"

  try {
    Write-Host "Fetching origin metadata..."
    git fetch origin --prune
  } catch {
    Write-Warning "Failed to fetch origin metadata. The remote is still configured."
  }

  if (-not [string]::IsNullOrWhiteSpace($UpstreamUrl)) {
    EnsureRemote -Name "upstream" -Url $UpstreamUrl
  }

  # Only create the first commit when explicitly requested.
  if ($InitialCommit -and -not (HasCommit)) {
    if (HasGitIdentity) {
      Write-Host "Creating initial commit..."
      git add .
      git commit -m $InitialCommitMessage
    } else {
      Write-Warning "Git user.name or user.email is not configured; skipping the initial commit."
    }
  }

  Write-Host ""
  Write-Host "Current remotes:"
  git remote -v

  Write-Host ""
  Write-Host "Remote branches:"
  git branch -r

  Write-Host ""
  Write-Host "Current status:"
  git status --short --branch
} finally {
  Pop-Location
}
