#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
UPROJECT="${PROJECT_ROOT}/unreal/AlpineMercenaries/AlpineMercenaries.uproject"
PYTHON_SCRIPT="${SCRIPT_DIR}/create-locomotion-assets.py"
DEFAULT_EDITOR="/Users/Shared/Epic Games/UE_5.8/Engine/Binaries/Mac/UnrealEditor-Cmd"
EDITOR_CMD="${AM_UNREAL_EDITOR_CMD:-${DEFAULT_EDITOR}}"
DEFAULT_XCODE_DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer"
LOG_PATH="${TMPDIR:-/tmp}/alpine-mercenaries-locomotion-assets.log"

if [[ -z "${DEVELOPER_DIR:-}" && -d "${DEFAULT_XCODE_DEVELOPER_DIR}" ]]; then
  export DEVELOPER_DIR="${DEFAULT_XCODE_DEVELOPER_DIR}"
fi

if [[ ! -x "${EDITOR_CMD}" ]]; then
  echo "UnrealEditor-Cmd를 찾을 수 없습니다: ${EDITOR_CMD}" >&2
  exit 1
fi

"${EDITOR_CMD}" "${UPROJECT}" \
  -ExecutePythonScript="${PYTHON_SCRIPT}" \
  -unattended \
  -nop4 \
  -nosplash \
  -NullRHI \
  -NoAudio \
  -abslog="${LOG_PATH}"

if ! grep -Fq "Generated crouch locomotion assets" "${LOG_PATH}"; then
  echo "앉기 애니메이션 생성 성공 기록을 찾지 못했습니다: ${LOG_PATH}" >&2
  tail -120 "${LOG_PATH}" >&2
  exit 1
fi

if grep -Eq "LogPython: Error|Fatal error" "${LOG_PATH}"; then
  echo "앉기 애니메이션 생성에 실패했습니다: ${LOG_PATH}" >&2
  exit 1
fi

grep -E "Validated AM_Crouch|Generated crouch locomotion assets" "${LOG_PATH}" || true
echo "Unreal 앉기 애니메이션 생성 완료: ${LOG_PATH}"
