# Push local main to https://github.com/hslabs99/apartmentrenos (PowerShell)
$ErrorActionPreference = "Stop"
$RepoUrl = "https://github.com/hslabs99/apartmentrenos.git"
Set-Location (Join-Path $PSScriptRoot "..")

if (-not (git remote get-url origin 2>$null)) {
  git remote add origin $RepoUrl
} else {
  git remote set-url origin $RepoUrl
}

git branch -M main
git push -u origin main

Write-Host "Done: $(git remote get-url origin) branch $(git branch --show-current)"
