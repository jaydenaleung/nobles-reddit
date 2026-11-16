#!/usr/bin/env bash
# Fails if a key-shaped string appears in tracked files or in the web bundle.
# Run by `npm run check:secrets` and by CI.
#
# It never prints the secret itself, only the file and line number.
set -u

cd "$(dirname "$0")/.."

# Patterns for things that must never be committed or shipped to browsers.
#   sk-ant-...                 Anthropic API keys
#   AIza...                    Google API keys
#   -----BEGIN PRIVATE KEY     service-account private keys
#   "private_key":             service-account JSON
#   ghp_ / github_pat_         GitHub tokens
PATTERN='sk-ant-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{30,}|-----BEGIN (RSA |EC )?PRIVATE KEY-----|"private_key"[[:space:]]*:|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}'

status=0

scan_file() {
  # Prints "file:line" for each hit, without the matching text.
  local file="$1"
  local hits
  hits=$(grep -n -I -E -e "$PATTERN" -- "$file" 2>/dev/null | cut -d: -f1)
  if [ -n "$hits" ]; then
    for line in $hits; do
      echo "  possible secret: $file:$line"
    done
    status=1
  fi
}

echo "Scanning tracked files for secrets"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  # Tracked files plus files that are staged or untracked-but-not-ignored,
  # so a secret is caught before the commit, not after.
  while IFS= read -r -d '' file; do
    case "$file" in
      scripts/check-secrets.sh | BUILD_PROMPT.md | package-lock.json) continue ;;
    esac
    [ -f "$file" ] && scan_file "$file"
  done < <(git ls-files -z --cached --others --exclude-standard)
else
  echo "  not a git repository, skipping tracked-file scan"
fi

if [ -d apps/web/dist ]; then
  echo "Scanning apps/web/dist for server-side secrets"
  # The Firebase web API key is public by design and is expected in the bundle,
  # so only the server-side patterns are checked here.
  DIST_PATTERN='sk-ant-[A-Za-z0-9_-]{16,}|-----BEGIN (RSA |EC )?PRIVATE KEY-----|"private_key"[[:space:]]*:|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}'
  while IFS= read -r -d '' file; do
    hits=$(grep -n -I -E -e "$DIST_PATTERN" -- "$file" 2>/dev/null | cut -d: -f1)
    if [ -n "$hits" ]; then
      for line in $hits; do
        echo "  possible secret in bundle: $file:$line"
      done
      status=1
    fi
    # No server-only variable name should reach the browser either.
    if grep -q -I -E -e 'ANTHROPIC_API_KEY|GOOGLE_APPLICATION_CREDENTIALS|BOOTSTRAP_ADMIN_EMAILS|WELLBEING_CONTACT_EMAIL' -- "$file" 2>/dev/null; then
      echo "  server-only variable name in bundle: $file"
      status=1
    fi
  done < <(find apps/web/dist -type f -print0)
else
  echo "apps/web/dist not built yet, skipping bundle scan"
fi

if [ "$status" -ne 0 ]; then
  echo "Secret check failed. Remove the value, rotate the key, and try again."
  exit 1
fi
echo "Secret check passed."
