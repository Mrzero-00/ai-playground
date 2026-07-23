#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
UPROJECT="${PROJECT_ROOT}/unreal/AlpineMercenaries/AlpineMercenaries.uproject"
DEFAULT_RUN_UAT="/Users/Shared/Epic Games/UE_5.8/Engine/Build/BatchFiles/RunUAT.sh"
RUN_UAT="${AM_UNREAL_RUN_UAT:-${DEFAULT_RUN_UAT}}"
DEFAULT_XCODE_DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer"
ARCHIVE_DIR="${AM_UNREAL_ARCHIVE_DIR:-${TMPDIR:-/tmp}/AlpineMercenaries-Mac-Package}"

if [[ -z "${DEVELOPER_DIR:-}" && -d "${DEFAULT_XCODE_DEVELOPER_DIR}" ]]; then
  export DEVELOPER_DIR="${DEFAULT_XCODE_DEVELOPER_DIR}"
fi

if [[ ! -x "${RUN_UAT}" ]]; then
  echo "RunUAT.sh를 찾을 수 없습니다: ${RUN_UAT}" >&2
  echo "다른 위치를 사용하려면 AM_UNREAL_RUN_UAT를 지정하세요." >&2
  exit 1
fi

if [[ ! -f "${UPROJECT}" ]]; then
  echo "Unreal 프로젝트를 찾을 수 없습니다: ${UPROJECT}" >&2
  exit 1
fi

if [[ -z "${DEVELOPER_DIR:-}" || ! -x "${DEVELOPER_DIR}/usr/bin/xcodebuild" ]]; then
  echo "전체 Xcode 개발자 디렉터리를 찾을 수 없습니다." >&2
  echo "Xcode를 /Applications/Xcode.app에 설치하거나 DEVELOPER_DIR를 지정하세요." >&2
  exit 1
fi

echo "Xcode: $("${DEVELOPER_DIR}/usr/bin/xcodebuild" -version | tr '\n' ' ')"
echo "Archive: ${ARCHIVE_DIR}/Mac/AlpineMercenaries.app"

"${RUN_UAT}" BuildCookRun \
  -project="${UPROJECT}" \
  -nop4 \
  -platform=Mac \
  -clientconfig=Development \
  -build \
  -cook \
  -stage \
  -pak \
  -package \
  -archive \
  -archivedirectory="${ARCHIVE_DIR}" \
  -utf8output

APP_PATH="${ARCHIVE_DIR}/Mac/AlpineMercenaries.app"

if [[ ! -x "${APP_PATH}/Contents/MacOS/AlpineMercenaries" ]]; then
  echo "패키지 실행 파일을 찾을 수 없습니다: ${APP_PATH}" >&2
  exit 1
fi

if ! find "${APP_PATH}" -type f -name 'AlpineMercenaries-Mac.ucas' -print -quit | grep -q .; then
  echo "패키지에서 게임 콘텐츠 컨테이너를 찾지 못했습니다: ${APP_PATH}" >&2
  exit 1
fi

codesign --verify --deep --strict --verbose=2 "${APP_PATH}"
echo "Unreal Mac Development 패키지 생성 완료: ${APP_PATH}"
