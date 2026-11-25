#!/usr/bin/env bash
set -euo pipefail

# Removes WhatsApp Web from the system:
#   - the desktop launcher + icon
#   - the whatsapp:// handler registration
#   - the build artifacts (dist/, node_modules/)   [optional]
#   - the app data (~/.config/Njobvu WhatsApp, kept for compatibility) [optional]
#
# Usage:  bash uninstall.sh
#         bash uninstall.sh --all      (also remove build artifacts + app data)

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_ID="com.whatsappweb.WhatsAppWeb"
LEGACY_DESKTOP_ID="njobvu-whatsapp"
DATA_DIR="$HOME/.config/Njobvu WhatsApp"

ALL=0
for arg in "$@"; do
  case "$arg" in
    --all) ALL=1 ;;
  esac
done

say() { printf '\033[1;33m==>\033[0m %s\n' "$*"; }
err() { printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2; }

APPS_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
ICON_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor/512x512/apps"

# --- stop the app if running -----------------------------------------------------
if pgrep -x "whatsappweb" >/dev/null 2>&1 || pgrep -x "WhatsApp-Web" >/dev/null 2>&1 || pgrep -x "njobvu-whatsapp" >/dev/null 2>&1 || pgrep -x "Njobvu-WhatsApp" >/dev/null 2>&1; then
  say "Stopping running instances..."
  pkill -9 -x "whatsappweb" 2>/dev/null || true
  pkill -9 -x "WhatsApp-Web" 2>/dev/null || true
  pkill -9 -x "njobvu-whatsapp" 2>/dev/null || true
  pkill -9 -x "Njobvu-WhatsApp" 2>/dev/null || true
  sleep 1
fi

# --- desktop entry + icon ----------------------------------------------------------
say "Removing desktop launcher..."
rm -f "$APPS_DIR/$DESKTOP_ID.desktop"
rm -f "$ICON_DIR/$DESKTOP_ID.png"
rm -f "$APPS_DIR/$LEGACY_DESKTOP_ID.desktop"
rm -f "$ICON_DIR/$LEGACY_DESKTOP_ID.png"
rmdir "$ICON_DIR" 2>/dev/null || true

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$APPS_DIR" >/dev/null 2>&1 || true
fi
if command -v xdg-mime >/dev/null 2>&1; then
  xdg-mime default "" x-scheme-handler/whatsapp >/dev/null 2>&1 || true
fi

# --- build artifacts (only with --all) ---------------------------------------------
if [[ "$ALL" -eq 1 ]]; then
  say "Removing build artifacts (dist/, node_modules/)..."
  rm -rf "$ROOT/dist" "$ROOT/node_modules"
else
  say "Kept dist/ and node_modules/. Use --all to remove them too."
fi

# --- app data (only with --all) ------------------------------------------------------
if [[ "$ALL" -eq 1 ]]; then
  if [[ -d "$DATA_DIR" ]]; then
    say "Removing app data: $DATA_DIR"
    rm -rf "$DATA_DIR"
  fi
else
  echo
  err "App data ($DATA_DIR) was kept. It holds your accounts and sessions."
  err "To remove it as well, run: bash uninstall.sh --all"
fi

echo
say "Uninstall complete."