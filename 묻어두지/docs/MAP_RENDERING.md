# 쿼터뷰 지도

웹 기본 시점은 pitch 55°, bearing −28°다. 오른쪽 `2D` 버튼은 pitch/bearing 모두 0으로, `3D` 버튼은 쿼터뷰로 되돌린다. 캡슐은 화면 정면 정렬(billboard), 바닥점은 원래 경위도에 붙어 있다. 지도 이동이나 시점 변경은 GPS 측정/봉인 좌표/시간/참석 조건을 바꾸지 않는다. 캡슐 선택은 상세 화면으로만 연결된다.

## 엔진과 범위

- 웹: MapLibre GL JS 6.10.0 + 기존 OpenStreetMap 256px 래스터 타일. CSS로 지도 전체를 기울이지 않고 지도 엔진의 카메라/투영을 사용하므로 드래그·확대·마커 위치가 같은 좌표계를 쓴다. 3D 건물/고도 데이터는 없다. 캡슐은 기존 SVG이며 캐릭터/Blender 작업은 재개하지 않았다.
- iOS: 기존 react-native-maps/MapKit의 initialCamera·setCamera·animateCamera. pitch 55°, heading 332°, mutedStandard 지도. altitude와 Google Maps의 zoom은 엔진별로 다르므로 실제 기기에서 최종 거리감을 조정해야 한다.
- Android: 기존 Google Maps + 설정된 지도 키. 마커 flat=false, 키가 없으면 기존 지도 연결 안내/목록을 유지한다.
- 현재 위치 범위는 최대 500m로 제한한 지리 좌표 다각형이다. 경위도와 측정 오차를 외부 지도에 업로드하지 않고 클라이언트 GeoJSON으로 그린다. 타일 제공자는 보이는 지역의 타일 요청을 받으므로 위치 관련 이용 고지는 운영 전에 확정해야 한다.

## 웹 실행과 내보내기

MapLibre 6 ESM의 import.meta와 worker를 Metro 안에서 변형하지 않도록 공식 배포 파일을 같은 출처에서 불러온다. `scripts/prepare-map-assets.mjs`가 설치 버전과 일치하는 main/shared/worker 모듈 및 전체 라이선스를 `public/maplibre/<version>/`에 복사한다. CDN 스크립트나 eval은 사용하지 않는다. 생성 디렉터리는 git에서 제외한다.

`npm install`/`npm ci`의 postinstall, `npm start`/`npm run web` 및 `npm run export`가 준비 작업을 수행한다. `--ignore-scripts`를 썼거나 직접 Expo를 실행하면 먼저 `npm run prepare:map`을 실행한다. 내보내기는 `npm run export -- --output-dir dist-preview --max-workers 2`; 결과에 `maplibre/<version>/` 파일이 함께 있어야 한다. 현재 배포 경로는 사이트 루트(`/`) 기준이며 하위 경로 배포는 별도 설정이 필요하다.

WebGL 미지원/컨텍스트 손실 또는 타일 실패 시 재시도 안내를 표시하고 목록/작성 기능은 유지한다. 타이머는 마커 재생성이나 지도 갱신을 유발하지 않는다. 화면 뒤/백그라운드와 동작 줄이기 규칙도 유지한다.

## 제공자/검증

OSM 출처는 항상 서랍 위에 표시한다. 브라우저의 기본 referrer와 HTTP 캐시를 유지하며 오프라인 다운로드/일괄 미리 가져오기는 없다. 자동 이동/확대 회귀 검사는 공용 타일을 요청하지 않고, ‘지도 대역’으로 명시한 로컬 PNG를 사용한다. 실제 인앱 화면 확인은 기본 서울 지도에서만 진행하고 사용자 GPS 권한은 요청하지 않았다.

호환 검토 중 MapLibre 5 계열의 sanitizer 보안 경고를 확인해 수정된 6.10.0을 최종 선택했다. 기존 Expo 계열 moderate 경고는 이 작업에서 무관한 강제 업데이트를 하지 않았다. 구 Leaflet 의존성과 미사용 스타일은 제거했고 이전 검증 기록과 라이선스 기록은 남겼다.

참고: [MapLibre 설치/worker 안내](https://maplibre.org/maplibre-gl-js/docs/), [카메라 시점](https://maplibre.org/maplibre-gl-js/docs/examples/set-perspective/), [마커 정렬](https://maplibre.org/maplibre-gl-js/docs/API/classes/Marker/), [OSM 타일 정책](https://operations.osmfoundation.org/policies/tiles/).
