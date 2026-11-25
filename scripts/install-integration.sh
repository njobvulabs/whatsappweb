#!/usr/bin/env bash
set -euo pipefail

# Installs the .desktop launcher + icon system-wide and registers
# the whatsapp:// protocol handler so external links open this app.
#
# Usage:
#   ./scripts/install-integration.sh          # picks dist/WhatsApp-Web*.AppImage
#   APPIMAGE=/path/to/App.AppImage ./scripts/install-integration.sh
#
# When run from a running AppImage, $APPIMAGE is set automatically by AppRun.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESKTOP_ID="com.whatsappweb.WhatsAppWeb"
LEGACY_DESKTOP_ID="njobvu-whatsapp"
APP_NAME="WhatsApp Web"

# --- locate the AppImage ---------------------------------------------------
APPIMAGE="${APPIMAGE:-}"
if [[ -z "$APPIMAGE" ]]; then
  candidates=(
    "$ROOT"/dist/*.AppImage
    "$HOME"/Applications/*.AppImage
  )
  for c in "${candidates[@]}"; do
    if [[ -f "$c" ]]; then
      APPIMAGE="$c"
      break
    fi
  done
fi

if [[ -z "$APPIMAGE" || ! -f "$APPIMAGE" ]]; then
  echo "ERROR: AppImage not found. Build it first (npm run build) or set APPIMAGE=/path/to/WhatsApp-Web.AppImage" >&2
  exit 1
fi
APPIMAGE="$(readlink -f "$APPIMAGE")"

# --- paths -----------------------------------------------------------------
DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
APPS_DIR="$DATA_HOME/applications"
ICON_DIR="$DATA_HOME/icons/hicolor/512x512/apps"
DESKTOP_FILE="$APPS_DIR/$DESKTOP_ID.desktop"
ICON_FILE="$ICON_DIR/$DESKTOP_ID.png"

mkdir -p "$APPS_DIR" "$ICON_DIR"

# --- icon ------------------------------------------------------------------
if [[ -f "$ROOT/assets/icon.png" ]]; then
  cp -f "$ROOT/assets/icon.png" "$ICON_FILE"
elif [[ -f "$APPIMAGE" ]]; then
  "$APPIMAGE" --appimage-extract "whatsappweb.png" >/dev/null 2>&1 || true
  if [[ -f squashfs-root/whatsappweb.png ]]; then
    cp -f squashfs-root/whatsappweb.png "$ICON_FILE"
    rm -rf squashfs-root
  fi
fi

# --- desktop file -----------------------------------------------------------
cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Name=$APP_NAME
Comment=Run multiple WhatsApp Web accounts side by side with isolated sessions.
Exec="$APPIMAGE" %U
Terminal=false
Type=Application
Icon=$DESKTOP_ID
StartupWMClass=whatsappweb
Categories=Network;
MimeType=x-scheme-handler/whatsapp;
EOF

rm -f "$APPS_DIR/$LEGACY_DESKTOP_ID.desktop"
rm -f "$ICON_DIR/$LEGACY_DESKTOP_ID.png"

# --- register ---------------------------------------------------------------
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$APPS_DIR" >/dev/null 2>&1 || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f -t "$DATA_HOME/icons/hicolor" >/dev/null 2>&1 || true
fi
if command -v xdg-mime >/dev/null 2>&1; then
  xdg-mime default "$DESKTOP_ID.desktop" x-scheme-handler/whatsapp || true
fi

echo "Installed $DESKTOP_FILE"
echo "Installed $ICON_FILE"
echo "whatsapp:// handler -> $APPIMAGE"
echo "Done. Try: xdg-open 'whatsapp://send?phone=123456789'"
