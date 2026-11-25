#!/usr/bin/env bash
set -euo pipefail

# One-shot setup for WhatsApp Web. Run this after a fresh OS install or when
# copying the folder to another machine. It:
#   1. detects your distro and installs the required system packages
#   2. installs npm dependencies
#   3. builds the AppImage
#   4. registers the desktop launcher + whatsapp:// handler
#
# Usage:  bash setup.sh
#         bash setup.sh --skip-deps    (skip installing system packages)

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

SKIP_DEPS=0
for arg in "$@"; do
  case "$arg" in
    --skip-deps) SKIP_DEPS=1 ;;
  esac
done

say() { printf '\033[1;32m==>\033[0m %s\n' "$*"; }
err() { printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2; }

# --- helpers -----------------------------------------------------------------
run_root() {
  if [[ "$(id -u)" -eq 0 ]]; then "$@"; else sudo "$@"; fi
}

# --- distro detection ---------------------------------------------------------
detect_pm() {
  if   command -v pacman >/dev/null 2>&1; then echo pacman
  elif command -v apt-get >/dev/null 2>&1; then echo apt
  elif command -v dnf    >/dev/null 2>&1; then echo dnf
  elif command -v zypper >/dev/null 2>&1; then echo zypper
  else echo ""; fi
}

install_packages() {
  local pm="$1"
  local pkgs
  case "$pm" in
    # nodejs+npm to build, librsvg for rsvg-convert (icon generation), fuse2 for
    # AppImages, xdg-utils for desktop/protocol registration
    pacman) pkgs="git nodejs npm librsvg fuse2 xdg-utils" ;;
    apt)    pkgs="git nodejs npm librsvg2-bin libfuse2 xdg-utils" ;;
    dnf)    pkgs="git nodejs npm librsvg2-tools fuse2 xdg-utils" ;;
    zypper) pkgs="git nodejs npm librsvg2-tools fuse2 xdg-utils" ;;
    *) return 1 ;;
  esac
  say "Installing system packages (${pkgs})..."
  case "$pm" in
    pacman) run_root pacman -S --needed --noconfirm $pkgs ;;
    apt)    run_root apt-get update && run_root apt-get install -y $pkgs ;;
    dnf)    run_root dnf install -y $pkgs ;;
    zypper) run_root zypper --non-interactive install $pkgs ;;
  esac
}

# --- 1. system packages --------------------------------------------------------
if [[ "$SKIP_DEPS" -eq 1 ]]; then
  say "Skipping system package installation (--skip-deps)."
else
  PM="$(detect_pm)"
  if [[ -z "$PM" ]]; then
    err "No supported package manager found (pacman/apt/dnf/zypper)."
    err "Install git, nodejs, npm, librsvg (rsvg-convert), fuse2 and xdg-utils manually, then re-run with --skip-deps."
    exit 1
  fi
  NEED_PACKAGES=0
  for c in node npm rsvg-convert; do
    command -v "$c" >/dev/null 2>&1 || NEED_PACKAGES=1
  done
  if [[ "$NEED_PACKAGES" -eq 1 ]]; then
    install_packages "$PM" || true
  else
    say "Node, npm and rsvg-convert already installed. Skipping system packages (node $(node -v))."
  fi
fi

# --- verify toolchain -----------------------------------------------------------
for c in node npm rsvg-convert; do
  command -v "$c" >/dev/null 2>&1 || { err "Missing required command: $c (librsvg provides rsvg-convert)"; exit 1; }
done
say "Using node $(node -v), npm $(npm -v), $(rsvg-convert --version | head -n1)"

# --- 2. npm dependencies --------------------------------------------------------
say "[1/3] Installing npm dependencies..."
npm install --no-audit --no-fund

# --- 3. build -------------------------------------------------------------------
say "[2/3] Building the AppImage..."
node scripts/gen-icon.js
npx electron-builder --linux AppImage

# --- 4. desktop integration ------------------------------------------------------
say "[3/3] Registering desktop launcher + whatsapp:// handler..."
bash scripts/install-integration.sh

# --- done ------------------------------------------------------------------------
APPIMAGE="$(ls -1 "$ROOT"/dist/*.AppImage 2>/dev/null | head -n1 || true)"
echo
say "Setup complete."
if [[ -n "$APPIMAGE" ]]; then
  echo "  Run the app   : $APPIMAGE"
  echo "  Or via menu   : 'WhatsApp Web' from your app launcher"
else
  echo "  Run from source: npm start"
fi
echo "  Uninstall     : bash uninstall.sh"