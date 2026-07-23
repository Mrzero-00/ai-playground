#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
UPROJECT="${PROJECT_ROOT}/unreal/AlpineMercenaries/AlpineMercenaries.uproject"
DEFAULT_EDITOR="/Users/Shared/Epic Games/UE_5.8/Engine/Binaries/Mac/UnrealEditor-Cmd"
EDITOR_CMD="${AM_UNREAL_EDITOR_CMD:-${DEFAULT_EDITOR}}"
DEFAULT_BUILD_TOOL="/Users/Shared/Epic Games/UE_5.8/Engine/Build/BatchFiles/Mac/Build.sh"
BUILD_TOOL="${AM_UNREAL_BUILD_TOOL:-${DEFAULT_BUILD_TOOL}}"
DEFAULT_XCODE_DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer"
LOG_PATH="${TMPDIR:-/tmp}/alpine-mercenaries-gameplay-tests.log"

if [[ -z "${DEVELOPER_DIR:-}" && -d "${DEFAULT_XCODE_DEVELOPER_DIR}" ]]; then
  export DEVELOPER_DIR="${DEFAULT_XCODE_DEVELOPER_DIR}"
fi

if [[ ! -x "${EDITOR_CMD}" ]]; then
  echo "UnrealEditor-Cmd를 찾을 수 없습니다: ${EDITOR_CMD}" >&2
  exit 1
fi

if [[ ! -x "${BUILD_TOOL}" ]]; then
  echo "Unreal Build Tool 실행 스크립트를 찾을 수 없습니다: ${BUILD_TOOL}" >&2
  exit 1
fi

"${BUILD_TOOL}" \
  AlpineMercenariesEditor \
  Mac \
  Development \
  "${UPROJECT}" \
  -WaitMutex

"${EDITOR_CMD}" "${UPROJECT}" \
  -ExecCmds="Automation RunTests AlpineMercenaries" \
  -TestExit="Automation Test Queue Empty" \
  -unattended \
  -NullRHI \
  -NoAudio \
  -abslog="${LOG_PATH}"

if ! grep -Eq "Test Completed.*Result=\\{Success\\}|Automation Test Succeeded" "${LOG_PATH}"; then
  echo "게임플레이 자동화 테스트 성공 기록을 찾지 못했습니다: ${LOG_PATH}" >&2
  tail -120 "${LOG_PATH}" >&2
  exit 1
fi

if grep -Eq "Result=\\{Fail\\}|Automation Test Failed|Fatal error" "${LOG_PATH}"; then
  echo "게임플레이 자동화 테스트가 실패했습니다: ${LOG_PATH}" >&2
  exit 1
fi

for EXPECTED_TEST in \
  "AlpineMercenaries.Locomotion.Configuration" \
  "AlpineMercenaries.Vitals.Resources" \
  "AlpineMercenaries.Weapons.Foundation" \
  "AlpineMercenaries.Combat.TrainingTarget"; do
  if ! grep -Fq "${EXPECTED_TEST}" "${LOG_PATH}"; then
    echo "예상한 자동화 테스트를 찾지 못했습니다: ${EXPECTED_TEST}" >&2
    exit 1
  fi
done

grep -E "AlpineMercenaries\\.(Locomotion|Vitals|Weapons|Combat)|Test Completed|Automation Test Succeeded" "${LOG_PATH}" || true
echo "Unreal 게임플레이 자동화 테스트 통과: ${LOG_PATH}"
