#!/usr/bin/env bash
#
# fetch-mysql-win.sh — stage the CS 410/510 Windows MySQL bundle for offline install.
#
# Boise State University · CS 410/510 Introduction to Databases · Fall 2026
# Package set verified against official MySQL download pages 2026-10-01.
#
# Downloads every Windows installer and sample database the course needs into a
# single directory, verifies each against its published MD5, and writes a
# MANIFEST.txt plus a Windows-side verify script. Safe to re-run: completed and
# verified files are skipped, partial files resume.
#
# Usage:
#   ./fetch-mysql-win.sh                      # core bundle into ./mysql-win-bundle
#   ./fetch-mysql-win.sh -d /media/usb/mysql  # stage somewhere else
#   ./fetch-mysql-win.sh -a                   # include optional packages
#   ./fetch-mysql-win.sh -f                   # re-download even if verified
#   ./fetch-mysql-win.sh -n                   # list what would be fetched, fetch nothing
#
set -o errexit
set -o nounset
set -o pipefail

readonly SCRIPT_NAME="${0##*/}"
readonly VERIFIED_ON="2026-10-01"

DEST="./mysql-win-bundle"
INCLUDE_OPTIONAL=0
FORCE=0
DRY_RUN=0

# ---------------------------------------------------------------------------
# Package table.
#
# Fields, pipe-delimited:  tier | filename | md5 | url | description
#
# tier  core      always fetched
#       optional  fetched only with -a
# md5   SKIP      no pinned checksum (evergreen URL); hash is recorded, not compared
#
# To bump a version: edit the filename, md5 and url together, from the official
# page listed beside each entry. Never edit one without the others.
# ---------------------------------------------------------------------------
PACKAGES=(
  # Microsoft VC++ runtime — prerequisite for Workbench.
  # Page: https://learn.microsoft.com/cpp/windows/latest-supported-vc-redist
  "core|vc_redist.x64.exe|SKIP|https://aka.ms/vs/17/release/vc_redist.x64.exe|Visual C++ Redistributable 2015-2022 (x64)"

  # MySQL Community Server 8.4 LTS.
  # Page: https://dev.mysql.com/downloads/mysql/8.4.html
  "core|mysql-8.4.11-winx64.msi|b5c515a0f410cd6903cd41057ed5d662|https://dev.mysql.com/get/Downloads/MySQL-8.4/mysql-8.4.11-winx64.msi|MySQL Community Server 8.4.11 LTS"

  # MySQL Workbench 8.0.47 — final 8.0 release. Pinned because Workbench 26.7
  # does not yet ship Database Design / Modeling (EER diagrams, reverse
  # engineering), which HW2 Part 2 and the integration capstone require.
  # Page: https://downloads.mysql.com/archives/workbench/
  "core|mysql-workbench-community-8.0.47-winx64.msi|1078f06dcac442fbef82bc5dbd6c2046|https://downloads.mysql.com/archives/get/p/8/file/mysql-workbench-community-8.0.47-winx64.msi|MySQL Workbench 8.0.47 (EER modeling)"

  # Sample databases. Page: https://dev.mysql.com/doc/index-other.html
  "core|sakila-db.zip|SKIP|https://downloads.mysql.com/docs/sakila-db.zip|Sakila sample database"
  "core|world-db.zip|SKIP|https://downloads.mysql.com/docs/world-db.zip|World sample database"

  "optional|menagerie-db.zip|SKIP|https://downloads.mysql.com/docs/menagerie-db.zip|Menagerie sample database (smoke test)"
  "optional|mysql-workbench-26.7.0-winx64.msi|f53e39a78460e01786eae70f67bcabd4|https://dev.mysql.com/downloads/workbench/|MySQL Workbench 26.7.0 (current line, no modeling)"
)

# ---------------------------------------------------------------------------
# Output helpers. Color only when stdout is a terminal, and never as the sole
# carrier of meaning — every line is also labeled in text.
# ---------------------------------------------------------------------------
if [[ -t 1 ]]; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_BLUE=$'\033[34m'
  C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'
else
  C_RESET=''; C_BOLD=''; C_BLUE=''; C_GREEN=''; C_YELLOW=''; C_RED=''
fi

info()  { printf '%s[ info ]%s %s\n'  "$C_BLUE"   "$C_RESET" "$*"; }
ok()    { printf '%s[  ok  ]%s %s\n'  "$C_GREEN"  "$C_RESET" "$*"; }
warn()  { printf '%s[ warn ]%s %s\n'  "$C_YELLOW" "$C_RESET" "$*" >&2; }
die()   { printf '%s[ FAIL ]%s %s\n'  "$C_RED"    "$C_RESET" "$*" >&2; exit 1; }
head1() { printf '\n%s%s%s\n' "$C_BOLD" "$*" "$C_RESET"; }

usage() {
  cat <<EOF
$SCRIPT_NAME — stage the CS 410/510 Windows MySQL bundle for offline install.

Usage: $SCRIPT_NAME [-d DIR] [-a] [-f] [-n] [-h]

  -d DIR   destination directory (default: $DEST)
  -a       include optional packages
  -f       force re-download of files that already verify
  -n       dry run: print the plan, download nothing
  -h       show this help

Package set verified against official MySQL pages on $VERIFIED_ON.
EOF
}

while getopts ":d:afnh" opt; do
  case "$opt" in
    d) DEST="$OPTARG" ;;
    a) INCLUDE_OPTIONAL=1 ;;
    f) FORCE=1 ;;
    n) DRY_RUN=1 ;;
    h) usage; exit 0 ;;
    :) die "option -$OPTARG requires an argument" ;;
    \?) die "unknown option -$OPTARG (try -h)" ;;
  esac
done

# ---------------------------------------------------------------------------
# Tool discovery. curl preferred, wget accepted; md5sum or md5 for hashing.
# ---------------------------------------------------------------------------
if command -v curl >/dev/null 2>&1;   then FETCHER=curl
elif command -v wget >/dev/null 2>&1; then FETCHER=wget
else die "neither curl nor wget found; install one and re-run"
fi

if command -v md5sum >/dev/null 2>&1;  then md5_of() { md5sum "$1" | cut -d' ' -f1; }
elif command -v md5 >/dev/null 2>&1;   then md5_of() { md5 -q "$1"; }
else die "neither md5sum nor md5 found; install one and re-run"
fi

if command -v sha256sum >/dev/null 2>&1; then sha256_of() { sha256sum "$1" | cut -d' ' -f1; }
elif command -v shasum >/dev/null 2>&1;  then sha256_of() { shasum -a 256 "$1" | cut -d' ' -f1; }
else sha256_of() { printf 'unavailable'; }
fi

# Reject an "installer" that is really an HTML error or interstitial page.
# MySQL's CDN occasionally serves one on a stale or redirected path, and it
# arrives with HTTP 200, so size alone will not catch it.
looks_like_html() {
  local f="$1" first
  first=$(head -c 512 "$f" 2>/dev/null | tr -d '\0' | tr 'A-Z' 'a-z')
  [[ "$first" == *"<!doctype html"* || "$first" == *"<html"* ]]
}

download() {
  local url="$1" out="$2"
  if [[ "$FETCHER" == curl ]]; then
    # -L follow redirects, -C - resume, --retry survive transient CDN failures
    curl -fL --retry 3 --retry-delay 2 --connect-timeout 20 \
         --progress-bar -C - -o "$out" "$url"
  else
    wget --tries=3 --timeout=20 --continue -O "$out" "$url"
  fi
}

# ---------------------------------------------------------------------------
# Plan
# ---------------------------------------------------------------------------
head1 "CS 410/510 — MySQL Windows bundle"
info "destination : $DEST"
info "packages    : core$( ((INCLUDE_OPTIONAL)) && printf ' + optional' )"
info "verified    : $VERIFIED_ON"

selected=()
for entry in "${PACKAGES[@]}"; do
  IFS='|' read -r tier _ _ _ _ <<<"$entry"
  if [[ "$tier" == core ]] || ((INCLUDE_OPTIONAL)); then
    selected+=("$entry")
  fi
done

if ((DRY_RUN)); then
  head1 "Dry run — would fetch ${#selected[@]} file(s):"
  for entry in "${selected[@]}"; do
    IFS='|' read -r tier name md5 url desc <<<"$entry"
    printf '  %-45s %s\n' "$name" "$desc"
    printf '  %-45s %s\n' "" "$url"
  done
  printf '\n'
  exit 0
fi

mkdir -p "$DEST"
DEST_ABS="$(cd "$DEST" && pwd)"

# ---------------------------------------------------------------------------
# Fetch and verify
# ---------------------------------------------------------------------------
declare -i n_ok=0 n_skipped=0
FAILED=()
MANIFEST_ROWS=()

head1 "Fetching ${#selected[@]} package(s)"

for entry in "${selected[@]}"; do
  IFS='|' read -r tier name md5_expected url desc <<<"$entry"
  target="$DEST_ABS/$name"

  # Already present and verified?
  if [[ -f "$target" && $FORCE -eq 0 ]]; then
    if [[ "$md5_expected" == SKIP ]]; then
      if ! looks_like_html "$target"; then
        ok "$name — already present (no pinned checksum)"
        MANIFEST_ROWS+=("$name|$(md5_of "$target")|$(sha256_of "$target")|$(wc -c <"$target")|$url|$desc")
        n_skipped+=1
        continue
      fi
    elif [[ "$(md5_of "$target")" == "$md5_expected" ]]; then
      ok "$name — already present and verified"
      MANIFEST_ROWS+=("$name|$md5_expected|$(sha256_of "$target")|$(wc -c <"$target")|$url|$desc")
      n_skipped+=1
      continue
    else
      warn "$name — present but checksum mismatch; re-downloading"
      rm -f "$target"
    fi
  fi
  ((FORCE)) && rm -f "$target"

  info "$name — $desc"
  if ! download "$url" "$target"; then
    warn "$name — download failed"
    FAILED+=("$name — download failed from $url")
    rm -f "$target"
    continue
  fi

  if [[ ! -s "$target" ]]; then
    FAILED+=("$name — downloaded file is empty")
    rm -f "$target"
    continue
  fi

  if looks_like_html "$target"; then
    FAILED+=("$name — server returned an HTML page, not the installer. The URL has probably moved; check the download page and update the package table.")
    rm -f "$target"
    continue
  fi

  actual_md5="$(md5_of "$target")"
  if [[ "$md5_expected" == SKIP ]]; then
    ok "$name — fetched ($(wc -c <"$target") bytes), MD5 $actual_md5 recorded"
  elif [[ "$actual_md5" == "$md5_expected" ]]; then
    ok "$name — fetched and MD5 verified"
  else
    FAILED+=("$name — MD5 mismatch: expected $md5_expected, got $actual_md5. A new patch release may have replaced it; reverify the package table against the download page.")
    continue
  fi

  MANIFEST_ROWS+=("$name|$actual_md5|$(sha256_of "$target")|$(wc -c <"$target")|$url|$desc")
  n_ok+=1
done

# ---------------------------------------------------------------------------
# MANIFEST.txt
# ---------------------------------------------------------------------------
manifest="$DEST_ABS/MANIFEST.txt"
{
  echo "CS 410/510 Introduction to Databases — Fall 2026"
  echo "MySQL Windows install bundle"
  echo "Boise State University"
  echo
  echo "Staged      : $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "Staged by   : $SCRIPT_NAME on $(uname -s)"
  echo "Package set : verified against official MySQL pages $VERIFIED_ON"
  echo
  echo "Install order: vc_redist → MySQL Server → MySQL Workbench → sample databases"
  echo
  printf '%s\n' "----------------------------------------------------------------------"
  for row in "${MANIFEST_ROWS[@]}"; do
    IFS='|' read -r name md5 sha size url desc <<<"$row"
    echo "File   : $name"
    echo "What   : $desc"
    echo "Size   : $size bytes"
    echo "MD5    : $md5"
    echo "SHA256 : $sha"
    echo "Source : $url"
    printf '%s\n' "----------------------------------------------------------------------"
  done
} >"$manifest"

# ---------------------------------------------------------------------------
# verify-bundle.cmd — so the lab tech can re-check on the Windows side
# ---------------------------------------------------------------------------
verify_cmd="$DEST_ABS/verify-bundle.cmd"
{
  # Quoted heredocs: nothing below is interpreted by bash, so batch syntax
  # (%~1, %%H, embedded quotes) passes through exactly as written.
  cat <<'CMD_HEAD'
@echo off
REM CS 410/510 - verify staged MySQL bundle against published MD5 checksums.
REM Run from inside the bundle folder. Requires certutil (built into Windows).
setlocal enabledelayedexpansion
set FAILED=0
echo.
echo CS 410/510 - verifying MySQL bundle
echo.
CMD_HEAD

  for row in "${MANIFEST_ROWS[@]}"; do
    IFS='|' read -r name md5 _ _ _ _ <<<"$row"
    printf 'call :check "%s" "%s"\n' "$name" "$md5"
  done

  cat <<'CMD_TAIL'
echo.
if %FAILED% EQU 0 (echo All files verified.) else (echo %FAILED% file^(s^) FAILED verification.)
pause
exit /b %FAILED%

:check
if not exist "%~1" (echo [MISSING] %~1 & set /a FAILED+=1 & exit /b)
set "HASH="
for /f "skip=1 tokens=*" %%H in ('certutil -hashfile "%~1" MD5') do (
  if not defined HASH set "HASH=%%H"
)
set "HASH=!HASH: =!"
if /i "!HASH!"=="%~2" (echo [  OK  ] %~1) else (echo [ FAIL ] %~1 & set /a FAILED+=1)
exit /b
CMD_TAIL
} | sed 's/$/\r/' >"$verify_cmd"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
head1 "Summary"
info "fetched  : $n_ok"
info "skipped  : $n_skipped (already verified)"

if ((${#FAILED[@]})); then
  printf '\n%s[ FAIL ]%s %d package(s) did not stage:\n' "$C_RED" "$C_RESET" "${#FAILED[@]}" >&2
  for f in "${FAILED[@]}"; do
    printf '         - %s\n' "$f" >&2
  done
  printf '\n' >&2
  warn "bundle is INCOMPLETE — do not image lab machines from it"
  exit 1
fi

total_bytes=0
for row in "${MANIFEST_ROWS[@]}"; do
  IFS='|' read -r _ _ _ size _ _ <<<"$row"
  total_bytes=$(( total_bytes + size ))
done

ok "bundle complete at $DEST_ABS"
info "total size : $(awk -v b="$total_bytes" 'BEGIN{printf "%.1f MB", b/1048576}')"
info "manifest   : MANIFEST.txt"
info "verifier   : verify-bundle.cmd (run on the Windows machine)"
printf '\n'
