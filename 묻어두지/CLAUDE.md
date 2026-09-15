# 묻어두지 — 기능 검증 앱

- 앱 표시 이름과 원본 프로젝트 폴더는 사용자 요청대로 `묻어두지`, package name/앱 식별자는 `mudeoduji`다. React Native iOS prebuilt의 비 ASCII 경로 오류를 피하려고 iOS 빌드만 별도 실제 영문 경로 복사본에서 실행한다. 원본 폴더를 영문으로 다시 바꾸지 않는다.
- 목적: 사진 1장/편지/음성 1개(10MB)/영상 1개(25MB) → 실제 현재 위치에서 AR 봉인 → 서버 기준 개봉 시간 + 반경 50m → 현장 AR 개봉을 실기기에서 검증.
- Expo 55 / React Native 0.83 / TypeScript / ViroReact 2.57.3. 카메라 AR은 Development Build로 실행한다. Expo Go나 웹을 AR 검증 완료로 표현하지 않는다.
- PoC 서버는 Node 22.13+ `node:http`, `node:sqlite` 기반. Supabase는 아직 연결하지 않았으며 이후 운영 단계에서 이전할 수 있다.
- `src/shared/contracts.ts`가 앱/서버 계약. 메타데이터 API에 편지·사진·음성·영상·파일명·다운로드 경로를 포함하지 않는다. `/open`에서 권한·서버시각·fresh GPS·거리 재검증.
- 봉인은 불변. 네트워크 재전송은 Idempotency-Key 사용, 응답 유실 시 draft 화면을 감추고 봉인 복구 흐름으로 보낸다.
- AR은 현재 평면에 재배치한다. 과거의 정확한 점 복원/VPS/클라우드 앵커/위조 방지 보장을 하지 않는다.
- `.data`, `.build`, `.env`, native build outputs는 커밋하지 않는다. 개발 서버는 로컬/LAN 테스트 전용이며 사적 자료 대신 테스트 자료를 사용한다.
- 테스트: `npm run check`, `npx expo export --platform all`, native prebuild 및 iPhone 현장 테스트. 수행 여부와 한계를 README/docs에 정확히 기록한다.
- 음성 녹음은 expo-audio로 native 최대 60초, 웹은 파일 선택만 지원. 녹음 중 봉인 금지, 백그라운드/화면 이탈 시 녹음·재생 중단과 임시 파일 정리. 원본 파일 삭제 금지. 네이티브 미디어 동작은 실기기 검증 전까지 미검증으로 기록한다.
