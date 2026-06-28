#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" = "--" ]; then
  shift
fi

APP_PATH="${1:-}"
SKIP_SIGNATURE_CHECK="${DESKTOP_SKIP_SIGNATURE_CHECK:-false}"

if [ "${APP_PATH}" = "--skip-signature-check" ]; then
  SKIP_SIGNATURE_CHECK=true
  shift
  APP_PATH="${1:-}"
fi

if [ -z "${APP_PATH}" ]; then
  echo "Usage: $0 [--skip-signature-check] <path-to-app-bundle>"
  exit 1
fi

if [ ! -d "${APP_PATH}" ]; then
  echo "App bundle not found: ${APP_PATH}"
  exit 1
fi

APP_NAME="$(basename "${APP_PATH}" .app)"
MAIN_BIN="${APP_PATH}/Contents/MacOS/${APP_NAME}"
FRAMEWORK_BIN="${APP_PATH}/Contents/Frameworks/Electron Framework.framework/Versions/A/Electron Framework"
NATIVE_BIN="${APP_PATH}/Contents/Resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node"

for required in "${MAIN_BIN}" "${FRAMEWORK_BIN}" "${NATIVE_BIN}"; do
  if [ ! -f "${required}" ]; then
    echo "Missing required packaged binary: ${required}"
    exit 1
  fi
done

APP_ARCHS="$(lipo -archs "${MAIN_BIN}")"
NATIVE_ARCHS="$(lipo -archs "${NATIVE_BIN}")"
for arch in ${APP_ARCHS}; do
  if [[ " ${NATIVE_ARCHS} " != *" ${arch} "* ]]; then
    echo "Native module arch mismatch: app has [${APP_ARCHS}] but better-sqlite3 has [${NATIVE_ARCHS}]"
    exit 1
  fi
done

MAIN_TEAM_ID="unsigned"
if [ "${SKIP_SIGNATURE_CHECK}" != "true" ]; then
  MAIN_CODESIGN_OUTPUT="$(codesign -dv --verbose=4 "${MAIN_BIN}" 2>&1 || true)"
  FRAMEWORK_CODESIGN_OUTPUT="$(codesign -dv --verbose=4 "${FRAMEWORK_BIN}" 2>&1 || true)"
  MAIN_TEAM_ID="$(printf "%s\n" "${MAIN_CODESIGN_OUTPUT}" | sed -n 's/^TeamIdentifier=//p' | head -n 1)"
  FRAMEWORK_TEAM_ID="$(printf "%s\n" "${FRAMEWORK_CODESIGN_OUTPUT}" | sed -n 's/^TeamIdentifier=//p' | head -n 1)"
  if [ -z "${MAIN_TEAM_ID}" ] || [ -z "${FRAMEWORK_TEAM_ID}" ]; then
    echo "Unable to read TeamIdentifier for executable/framework"
    echo "Main binary codesign output:"
    printf "%s\n" "${MAIN_CODESIGN_OUTPUT}"
    echo "Framework codesign output:"
    printf "%s\n" "${FRAMEWORK_CODESIGN_OUTPUT}"
    exit 1
  fi
  if [ "${MAIN_TEAM_ID}" != "${FRAMEWORK_TEAM_ID}" ]; then
    echo "Team ID mismatch: app [${MAIN_TEAM_ID}] vs Electron Framework [${FRAMEWORK_TEAM_ID}]"
    exit 1
  fi

  ENTITLEMENTS_TMP="$(mktemp)"
  MAIN_ENTITLEMENTS_RAW="$(codesign -d --entitlements :- "${MAIN_BIN}" 2>/dev/null || true)"
  if [ -z "${MAIN_ENTITLEMENTS_RAW}" ]; then
    echo "Unable to read main executable entitlements"
    rm -f "${ENTITLEMENTS_TMP}"
    exit 1
  fi
  printf "%s" "${MAIN_ENTITLEMENTS_RAW}" >"${ENTITLEMENTS_TMP}"
  LIB_VALIDATION_DISABLED="$(/usr/libexec/PlistBuddy -c "Print :com.apple.security.cs.disable-library-validation" "${ENTITLEMENTS_TMP}" 2>/dev/null || echo false)"
  rm -f "${ENTITLEMENTS_TMP}"
  if [ "${LIB_VALIDATION_DISABLED}" != "1" ] && [ "${LIB_VALIDATION_DISABLED}" != "true" ]; then
    echo "Missing required entitlement: com.apple.security.cs.disable-library-validation=true"
    exit 1
  fi

  if ! codesign --verify --deep --strict --verbose=2 "${APP_PATH}" >/dev/null; then
    echo "codesign --verify failed for ${APP_PATH}"
    exit 1
  fi
fi

echo "macOS artifact verification passed"
echo "  app: ${APP_PATH}"
echo "  app arches: ${APP_ARCHS}"
echo "  better-sqlite3 arches: ${NATIVE_ARCHS}"
echo "  team id: ${MAIN_TEAM_ID}"
echo "  signature verification skipped: ${SKIP_SIGNATURE_CHECK}"
