#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

APP_PATH="${1:-}"
ARCH="${2:-}"

if [ -z "${APP_PATH}" ] || [ -z "${ARCH}" ]; then
  echo "Usage: $0 <path-to-app-bundle> <arm64|x64>"
  exit 1
fi

if [ ! -d "${APP_PATH}" ]; then
  echo "App bundle not found: ${APP_PATH}"
  exit 1
fi

VERIFY_SCRIPT="${SCRIPT_DIR}/verify-macos-artifact.sh"
if bash "${VERIFY_SCRIPT}" "${APP_PATH}"; then
  exit 0
fi

echo "Packaged app failed verification; applying ad-hoc signature and recreating artifacts..."

codesign \
  --force \
  --deep \
  --sign - \
  --options runtime \
  --entitlements "${APP_ROOT}/assets/entitlements.mac.plist" \
  "${APP_PATH}"

bash "${VERIFY_SCRIPT}" "${APP_PATH}"

APP_NAME="$(basename "${APP_PATH}" .app)"
VERSION="$(cd "${APP_ROOT}" && node -p "require('./package.json').version")"
ZIP_PATH="${APP_ROOT}/release/build/${APP_NAME}-${VERSION}-mac-${ARCH}.zip"
DMG_PATH="${APP_ROOT}/release/build/${APP_NAME}-${VERSION}-mac-${ARCH}.dmg"

rm -f "${ZIP_PATH}" "${DMG_PATH}" "${ZIP_PATH}.blockmap" "${DMG_PATH}.blockmap"

ditto -c -k --sequesterRsrc --keepParent "${APP_PATH}" "${ZIP_PATH}"
unzip -t "${ZIP_PATH}" >/dev/null

hdiutil create \
  -volname "${APP_NAME}" \
  -srcfolder "${APP_PATH}" \
  -ov \
  -format UDZO \
  "${DMG_PATH}" >/dev/null

hdiutil verify "${DMG_PATH}" >/dev/null

echo "Recreated signed distributables:"
echo "  ${ZIP_PATH}"
echo "  ${DMG_PATH}"
