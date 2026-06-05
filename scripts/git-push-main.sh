#!/usr/bin/env bash
# Push local main to https://github.com/hslabs99/apartmentrenos
set -euo pipefail

REPO_URL="https://github.com/hslabs99/apartmentrenos.git"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! git remote get-url origin &>/dev/null; then
  git remote add origin "$REPO_URL"
else
  git remote set-url origin "$REPO_URL"
fi

git branch -M main

if git rev-parse --verify origin/main &>/dev/null; then
  if ! git merge-base --is-ancestor origin/main HEAD 2>/dev/null; then
    echo "Remote main has unrelated history (e.g. placeholder 'test' commit)."
    echo "Replacing with local app — run: git push -u origin main --force-with-lease"
    read -r -p "Force-push main? [y/N] " ans
    if [[ "${ans,,}" == "y" ]]; then
      git push -u origin main --force-with-lease
    else
      exit 1
    fi
  else
    git push -u origin main
  fi
else
  git push -u origin main
fi

echo "Done: $(git remote get-url origin) ($(git branch --show-current))"
