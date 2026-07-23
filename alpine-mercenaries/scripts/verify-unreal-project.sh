#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
UPROJECT="${PROJECT_ROOT}/unreal/AlpineMercenaries/AlpineMercenaries.uproject"
DEFAULT_EDITOR="/Users/Shared/Epic Games/UE_5.8/Engine/Binaries/Mac/UnrealEditor-Cmd"
EDITOR_CMD="${AM_UNREAL_EDITOR_CMD:-${DEFAULT_EDITOR}}"
LOG_PATH="${TMPDIR:-/tmp}/alpine-mercenaries-data-validation.log"
DEFAULT_XCODE_DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer"

if [[ -z "${DEVELOPER_DIR:-}" && -d "${DEFAULT_XCODE_DEVELOPER_DIR}" ]]; then
  export DEVELOPER_DIR="${DEFAULT_XCODE_DEVELOPER_DIR}"
fi

if [[ ! -x "${EDITOR_CMD}" ]]; then
  echo "UnrealEditor-Cmd를 찾을 수 없습니다: ${EDITOR_CMD}" >&2
  echo "다른 위치를 사용하려면 AM_UNREAL_EDITOR_CMD를 지정하세요." >&2
  exit 1
fi

"${EDITOR_CMD}" "${UPROJECT}" \
  -run=DataValidation \
  -IncludeOnlyOnDiskAssets \
  -unattended \
  -NullRHI \
  -NoAudio \
  -NoShaderCompile \
  -abslog="${LOG_PATH}"

if grep -Eq "LoadErrors:|does not exist either on disk|Success - [1-9][0-9]* error\(s\)" "${LOG_PATH}"; then
  echo "Unreal 에셋 검증에서 오류를 발견했습니다: ${LOG_PATH}" >&2
  exit 1
fi

if ! grep -q "Starting to validate" "${LOG_PATH}"; then
  echo "Unreal 에셋 검증이 실행된 흔적을 찾지 못했습니다: ${LOG_PATH}" >&2
  exit 1
fi

grep -E "Starting to validate|Success - [0-9]+ error\(s\), [0-9]+ warning\(s\)" "${LOG_PATH}" || true
echo "Unreal 프로젝트 검증 통과: ${LOG_PATH}"
