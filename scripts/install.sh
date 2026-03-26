#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════
#  Offline PNPM Browser — Install & Service Setup
#  Works on macOS (launchd) and Linux (systemd)
# ═══════════════════════════════════════════════════════════════

BOLD='\033[1m'
DIM='\033[2m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
RESET='\033[0m'

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE_NAME="offline-pnpm-browser"
PORT="${PORT:-54321}"
HOST="${HOST:-0.0.0.0}"

info()  { echo -e "${CYAN}▸${RESET} $*"; }
ok()    { echo -e "${GREEN}✓${RESET} $*"; }
warn()  { echo -e "${YELLOW}⚠${RESET} $*"; }
error() { echo -e "${RED}✗${RESET} $*"; }
step()  { echo -e "\n${BOLD}$*${RESET}"; }

# ── Detect environment ──────────────────────────────────────

detect_os() {
  case "$(uname -s)" in
    Darwin) echo "macos" ;;
    Linux)  echo "linux" ;;
    *)      echo "unknown" ;;
  esac
}

detect_shell() {
  basename "${SHELL:-/bin/bash}"
}

find_node() {
  if command -v node &>/dev/null; then
    command -v node
  elif [ -f "$HOME/.nvm/nvm.sh" ]; then
    # Source nvm to find node
    export NVM_DIR="$HOME/.nvm"
    . "$NVM_DIR/nvm.sh" 2>/dev/null
    command -v node 2>/dev/null || ""
  else
    ""
  fi
}

find_npm() {
  if command -v pnpm &>/dev/null; then
    echo "pnpm"
  elif command -v npm &>/dev/null; then
    echo "npm"
  else
    echo ""
  fi
}

OS="$(detect_os)"
SHELL_NAME="$(detect_shell)"
NODE_BIN="$(find_node)"
PKG_MGR="$(find_npm)"

# ── Preflight ────────────────────────────────────────────────

step "Preflight checks"

if [ "$OS" = "unknown" ]; then
  error "Unsupported OS: $(uname -s). Only macOS and Linux are supported."
  exit 1
fi
ok "OS: ${OS}"

if [ -z "$NODE_BIN" ]; then
  error "Node.js not found. Install it first: https://nodejs.org"
  exit 1
fi
NODE_VERSION="$("$NODE_BIN" -v)"
ok "Node: ${NODE_VERSION} (${NODE_BIN})"

if [ -z "$PKG_MGR" ]; then
  error "No package manager found (pnpm or npm required)"
  exit 1
fi
ok "Package manager: ${PKG_MGR}"

# ── Install dependencies ─────────────────────────────────────

step "Installing dependencies"
cd "$PROJECT_DIR"

if [ "$PKG_MGR" = "pnpm" ]; then
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install
else
  npm ci 2>/dev/null || npm install
fi
ok "Dependencies installed"

# ── Initial index ────────────────────────────────────────────

step "Building initial index"

if [ ! -f "$PROJECT_DIR/packages.db" ]; then
  info "No database found — running full index..."
  $PKG_MGR run index:full
  ok "Full index complete"
else
  info "Database exists — running incremental index..."
  $PKG_MGR run index
  ok "Incremental index complete"
fi

# ── Build production bundle ──────────────────────────────────

step "Building production bundle"
$PKG_MGR run build
ok "Build complete"

# ── Set up background service ────────────────────────────────

step "Setting up background service"

# We need the full path to node, resolved through nvm if needed
NODE_FULL="$(which node)"

setup_launchd() {
  local plist_dir="$HOME/Library/LaunchAgents"
  local plist_file="$plist_dir/com.${SERVICE_NAME}.plist"
  local log_dir="$HOME/Library/Logs/${SERVICE_NAME}"

  mkdir -p "$plist_dir" "$log_dir"

  cat > "$plist_file" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.${SERVICE_NAME}</string>

    <key>WorkingDirectory</key>
    <string>${PROJECT_DIR}</string>

    <key>ProgramArguments</key>
    <array>
        <string>${NODE_FULL}</string>
        <string>start.js</string>
    </array>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PORT</key>
        <string>${PORT}</string>
        <key>HOST</key>
        <string>${HOST}</string>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>PATH</key>
        <string>$(dirname "$NODE_FULL"):/usr/local/bin:/usr/bin:/bin</string>
    </dict>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>

    <key>StandardOutPath</key>
    <string>${log_dir}/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>${log_dir}/stderr.log</string>

    <key>ProcessType</key>
    <string>Background</string>
</dict>
</plist>
PLIST

  ok "Created launchd plist: ${plist_file}"

  # Set up hourly indexing
  local index_plist="$plist_dir/com.${SERVICE_NAME}.index.plist"

  cat > "$index_plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.${SERVICE_NAME}.index</string>

    <key>WorkingDirectory</key>
    <string>${PROJECT_DIR}</string>

    <key>ProgramArguments</key>
    <array>
        <string>${NODE_FULL}</string>
        <string>--import</string>
        <string>tsx</string>
        <string>scripts/index-store.ts</string>
    </array>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>$(dirname "$NODE_FULL"):/usr/local/bin:/usr/bin:/bin</string>
    </dict>

    <key>StartInterval</key>
    <integer>3600</integer>

    <key>StandardOutPath</key>
    <string>${log_dir}/index-stdout.log</string>
    <key>StandardErrorPath</key>
    <string>${log_dir}/index-stderr.log</string>
</dict>
</plist>
PLIST

  ok "Created hourly index plist: ${index_plist}"

  # Load services
  launchctl bootout "gui/$(id -u)/com.${SERVICE_NAME}" 2>/dev/null || true
  launchctl bootout "gui/$(id -u)/com.${SERVICE_NAME}.index" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$plist_file"
  launchctl bootstrap "gui/$(id -u)" "$index_plist"

  ok "Services loaded and running"
  info "Logs: ${log_dir}/"
  info "Stop:    launchctl bootout gui/$(id -u)/com.${SERVICE_NAME}"
  info "Restart: launchctl kickstart -k gui/$(id -u)/com.${SERVICE_NAME}"
}

setup_systemd() {
  local service_dir="$HOME/.config/systemd/user"
  local service_file="$service_dir/${SERVICE_NAME}.service"
  local timer_file="$service_dir/${SERVICE_NAME}-index.timer"
  local index_service="$service_dir/${SERVICE_NAME}-index.service"

  mkdir -p "$service_dir"

  cat > "$service_file" <<SERVICE
[Unit]
Description=Offline PNPM Browser
After=network.target

[Service]
Type=simple
WorkingDirectory=${PROJECT_DIR}
ExecStart=${NODE_FULL} start.js
Environment=PORT=${PORT}
Environment=HOST=${HOST}
Environment=NODE_ENV=production
Environment=PATH=$(dirname "$NODE_FULL"):/usr/local/bin:/usr/bin:/bin
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
SERVICE

  ok "Created service: ${service_file}"

  cat > "$index_service" <<SERVICE
[Unit]
Description=Offline PNPM Browser — Index Update

[Service]
Type=oneshot
WorkingDirectory=${PROJECT_DIR}
ExecStart=${NODE_FULL} --import tsx scripts/index-store.ts
Environment=PATH=$(dirname "$NODE_FULL"):/usr/local/bin:/usr/bin:/bin
SERVICE

  cat > "$timer_file" <<TIMER
[Unit]
Description=Offline PNPM Browser — Hourly Index

[Timer]
OnCalendar=hourly
Persistent=true

[Install]
WantedBy=timers.target
TIMER

  ok "Created index timer: ${timer_file}"

  # Enable and start
  systemctl --user daemon-reload
  systemctl --user enable --now "${SERVICE_NAME}.service"
  systemctl --user enable --now "${SERVICE_NAME}-index.timer"

  ok "Services enabled and running"
  info "Logs:    journalctl --user -u ${SERVICE_NAME} -f"
  info "Stop:    systemctl --user stop ${SERVICE_NAME}"
  info "Restart: systemctl --user restart ${SERVICE_NAME}"
}

case "$OS" in
  macos) setup_launchd ;;
  linux) setup_systemd ;;
esac

# ── Git hook ─────────────────────────────────────────────────

step "Setting up git hooks"

HOOK_DIR="$PROJECT_DIR/.husky"
mkdir -p "$HOOK_DIR"

cat > "$HOOK_DIR/post-merge" <<'HOOK'
#!/usr/bin/env bash
# Post git-pull hook: rebuild and restart the server

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "▸ Post-pull: installing dependencies..."
if command -v pnpm &>/dev/null; then
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install
else
  npm ci 2>/dev/null || npm install
fi

echo "▸ Post-pull: rebuilding..."
npm run build 2>/dev/null || pnpm run build

echo "▸ Post-pull: restarting server..."
OS="$(uname -s)"
SERVICE_NAME="offline-pnpm-browser"

case "$OS" in
  Darwin)
    launchctl kickstart -k "gui/$(id -u)/com.${SERVICE_NAME}" 2>/dev/null || true
    ;;
  Linux)
    systemctl --user restart "${SERVICE_NAME}.service" 2>/dev/null || true
    ;;
esac

echo "✓ Server restarted"
HOOK

chmod +x "$HOOK_DIR/post-merge"
ok "Created post-merge hook (triggers on git pull)"

# ── Summary ──────────────────────────────────────────────────

step "Setup complete!"
echo ""
echo -e "  ${BOLD}Server${RESET}        http://${HOST}:${PORT}"
echo -e "  ${BOLD}Indexing${RESET}      Incremental, every hour"
echo -e "  ${BOLD}Git pull${RESET}      Auto-rebuild and restart"
echo ""
echo -e "  ${DIM}Force reindex:${RESET}  ./scripts/reindex.sh"
echo -e "  ${DIM}Force reindex:${RESET}  ./scripts/reindex.sh --full"
echo ""

if command -v tailscale &>/dev/null; then
  TS_IP="$(tailscale ip -4 2>/dev/null || true)"
  if [ -n "$TS_IP" ]; then
    echo -e "  ${BOLD}Tailscale${RESET}     http://${TS_IP}:${PORT}"
    echo ""
  fi
fi
