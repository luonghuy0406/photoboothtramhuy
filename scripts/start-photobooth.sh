#!/bin/bash
set -e

echo "=========================================================="
echo "  💍 HUY & TRÂM - DIGITAL WEDDING PHOTOBOOTH SYSTEM 💍   "
echo "=========================================================="

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

STORAGE_DIR="${PHOTOBOOTH_STORAGE:-$PROJECT_DIR/PhotoboothData}"
mkdir -p "$STORAGE_DIR/photos/originals"
mkdir -p "$STORAGE_DIR/photos/thumbnails"
mkdir -p "$STORAGE_DIR/photos/strips"
mkdir -p "$STORAGE_DIR/watch"
mkdir -p "$STORAGE_DIR/export"

echo "📂 Thư mục lưu trữ: $STORAGE_DIR"

# Network IP check
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "192.168.1.9")
export LAN_IP
echo "📶 LAN IP máy chủ: $LAN_IP"
echo "🌐 Khách quét QR sẽ truy cập: http://$LAN_IP:3000"
echo "=========================================================="

# Build to ensure latest code is running
echo "🔨 Đang chuẩn bị các gói hệ thống..."
npm run build --workspace=@photobooth/shared
npm run build --workspace=@photobooth/server
npm run build --workspace=@photobooth/guest

# Remove Gatekeeper quarantine on Electron if present
if [ -d "node_modules/electron/dist/Electron.app" ]; then
  xattr -cr "node_modules/electron/dist/Electron.app" 2>/dev/null || true
fi

echo "🚀 Đang khởi động hệ thống..."

# Release port 3000 if occupied by previous session
if lsof -ti :3000 >/dev/null 2>&1; then
  echo "♻️ Đang giải phóng cổng 3000..."
  kill -9 $(lsof -ti :3000) 2>/dev/null || true
  sleep 1
fi

# Start Fastify local server in background
echo "1. Khởi động Fastify Local Server (Cổng 3000)..."
node packages/server/dist/index.js &
SERVER_PID=$!

# Trap exit to cleanup background processes
cleanup() {
  echo ""
  echo "🛑 Đang tắt máy chủ..."
  kill $SERVER_PID 2>/dev/null || true
  if [ -n "$VITE_PID" ]; then
    kill $VITE_PID 2>/dev/null || true
  fi
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

sleep 1

MODE="${1:-auto}"

# Determine whether to use Electron or Chrome Kiosk
if [ "$MODE" = "electron" ] && [ -d "node_modules/electron/dist/Electron.app" ]; then
  echo "2. Khởi động Electron Kiosk Photobooth App..."
  export USE_ELECTRON=true
  npm run dev --workspace=@photobooth/desktop
else
  echo "2. Khởi động Photobooth Kiosk UI (Web App Mode - Miễn nhiễm với cảnh báo Malware)..."
  # Release port 5173 if occupied
  if lsof -ti :5173 >/dev/null 2>&1; then
    echo "♻️ Đang giải phóng cổng 5173..."
    kill -9 $(lsof -ti :5173) 2>/dev/null || true
    sleep 1
  fi

  npm run dev --workspace=@photobooth/desktop &
  VITE_PID=$!
  sleep 2

  if [ -d "/Applications/Google Chrome.app" ]; then
    echo "✨ Mở Kiosk bằng Google Chrome (Không thanh địa chỉ, giao diện toàn màn hình)..."
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --app=http://localhost:5173 --start-fullscreen 2>/dev/null &
  else
    echo "✨ Mở Kiosk bằng trình duyệt mặc định..."
    open http://localhost:5173
  fi

  wait $VITE_PID
fi

wait $SERVER_PID
