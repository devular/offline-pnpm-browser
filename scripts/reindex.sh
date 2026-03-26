#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════
#  Offline PNPM Browser — Force Reindex
#
#  Usage:
#    ./scripts/reindex.sh          # incremental
#    ./scripts/reindex.sh --full   # full rebuild
# ═══════════════════════════════════════════════════════════════

GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

SERVICE_NAME="offline-pnpm-browser"

# Resolve node through nvm if needed
if ! command -v node &>/dev/null && [ -f "$HOME/.nvm/nvm.sh" ]; then
  export NVM_DIR="$HOME/.nvm"
  . "$NVM_DIR/nvm.sh" 2>/dev/null
fi

MODE="incremental"
INDEX_CMD="npm run index"

if [[ "${1:-}" == "--full" ]]; then
  MODE="full"
  INDEX_CMD="npm run index:full"
fi

echo -e "${BOLD}Reindexing (${MODE})...${RESET}"
echo ""

$INDEX_CMD

echo ""
echo -e "${GREEN}✓${RESET} Index updated"

# Restart the server so it picks up the new DB
echo -e "${CYAN}▸${RESET} Restarting server..."

OS="$(uname -s)"
case "$OS" in
  Darwin)
    launchctl kickstart -k "gui/$(id -u)/com.${SERVICE_NAME}" 2>/dev/null && \
      echo -e "${GREEN}✓${RESET} Server restarted (launchd)" || \
      echo -e "${CYAN}▸${RESET} No launchd service found — restart manually if needed"
    ;;
  Linux)
    systemctl --user restart "${SERVICE_NAME}.service" 2>/dev/null && \
      echo -e "${GREEN}✓${RESET} Server restarted (systemd)" || \
      echo -e "${CYAN}▸${RESET} No systemd service found — restart manually if needed"
    ;;
  *)
    echo -e "${CYAN}▸${RESET} Restart the server manually"
    ;;
esac
