// Web smoke: seeds the local PoC server, walks every screen in the exported web
// build at phone width and saves screenshots. Reads a handful of real map tiles
// once (no pan/zoom loops), which is within OpenFreeMap's free use.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const PREVIEW = process.env.PREVIEW_URL || 'http://localhost:8082';
const API = process.env.API_URL || 'http://localhost:8787';
const OUT = process.env.SMOKE_OUT || path.resolve('.build/web-smoke');
const HERE = { latitude: 37.5556, longitude: 126.8998 }; // 망원한강공원
const PHOTO = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';

async function seed() {
  const token = (await (await fetch(`${API}/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).json()).token;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const fix = () => ({ ...HERE, accuracy: 6, timestamp: Date.now() });
  const make = async (title, placeName, unlockAfterSeconds, location, letter) => {
    const response = await fetch(`${API}/capsules`, { method: 'POST', headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ title, placeName, unlockAfterSeconds, location, fix: fix(), content: { letter, photo: { base64: PHOTO, mimeType: 'image/png' } } }) });
    if (!response.ok) throw new Error(`seed failed: ${response.status} ${await response.text()}`);
    return (await response.json()).capsule;
  };
  const made = [
    await make('한 달 뒤 우리 예언', '망원한강공원 벤치', 30 * 86400, HERE, '한 달 뒤 가장 많이 변해 있을 사람은…'),
    await make('부산 여행 구덩이', '해운대 입구', 100 * 86400, { latitude: 35.1587, longitude: 129.1604 }, '멀리서도 묻을 수 있어요.'),
    // 120m north-east: two capsules on one spot would cover each other (known limitation).
    await make('이제 꺼낼 수 있는 편지', '망원한강공원 잔디밭', 15, { latitude: HERE.latitude + 0.0008, longitude: HERE.longitude + 0.001 }, '15초면 충분해요.'),
  ];
  return { token, made };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { token, made } = await seed();
  await new Promise((resolve) => setTimeout(resolve, 16_000)); // let the 15-second capsule mature
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, geolocation: { ...HERE, accuracy: 6 }, permissions: ['geolocation'], locale: 'ko-KR' });
  await context.addInitScript((value) => { window.localStorage.setItem('mudeodooji.device-session.v1', value); }, token);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error.message)));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
  const findings = [];
  const check = (condition, note) => { if (!condition) findings.push(note); };

  await page.goto(PREVIEW, { waitUntil: 'networkidle' });
  await page.getByText('나의 구덩이').waitFor();
  check(await page.getByText('한 달 뒤 우리 예언').count() > 0, '홈 목록에 봉인한 구덩이가 없음');
  check(await page.getByText('공개 가능').count() > 0, '홈 목록에 공개 가능 표시가 없음');
  await shot('01-home');

  await page.getByRole('button', { name: '동네 지도 열기' }).click();
  await page.locator('.dooji-map-surface[data-ready="true"]').waitFor({ timeout: 30_000 });
  await page.waitForFunction(() => document.querySelector('.dooji-map-surface')?.dataset.tilesReady === 'true', null, { timeout: 30_000 }).catch(() => findings.push('지도 타일이 30초 안에 준비되지 않음'));
  await page.waitForTimeout(800);
  const pins = await page.locator('.dooji-floating-capsule').count();
  check(pins === made.length, `지도 캡슐 ${pins}개 (기대 ${made.length})`);
  check(Math.abs(Number(await page.locator('.dooji-map-surface').getAttribute('data-pitch')) - 55) < 0.01, '쿼터뷰 pitch 가 55 가 아님');
  await shot('02-map');

  // Tapping a capsule opens the encounter route; on the web that is the AR notice.
  await page.locator(`.dooji-floating-capsule[data-capsule-id="${made[2].id}"] .dooji-capsule-clock`).click();
  await page.getByText('AR은 휴대폰에서 꺼내요').waitFor({ timeout: 15_000 });
  await shot('03-open-web-notice');
  await page.getByRole('button', { name: '돌아가기' }).click();
  await page.locator('.dooji-map-surface[data-ready="true"]:visible').waitFor();

  await page.getByRole('button', { name: '새 구덩이 파기' }).click();
  await page.getByText('어디에 묻을까요?').first().waitFor();
  await shot('04-create-empty');
  check(await page.getByText('묻을 자리를 지도에서 골라 주세요.').count() > 0 || await page.getByText('구덩이 이름을 적어 주세요.').count() > 0, '봉인 버튼이 왜 비활성인지 설명이 없음');

  await page.getByText('지도에서 자리 고르기').click();
  // The map screen stays mounted (hidden) behind the modal: only the visible atlas counts.
  const picker = page.locator('.dooji-atlas:visible').last();
  await picker.locator('.dooji-map-surface[data-ready="true"]').waitFor({ timeout: 30_000 });
  await page.waitForTimeout(600);
  const surface = await picker.locator('.dooji-map-surface').boundingBox();
  await page.mouse.click(surface.x + surface.width * 0.3, surface.y + surface.height * 0.36);
  await page.getByText('여기에 묻을게요').waitFor();
  check(await picker.locator('.dooji-pick-pin').count() === 1, '지도에 핀이 찍히지 않음');
  await page.getByLabel('장소 이름').fill('우리 동네 놀이터');
  await shot('05-pick-spot');
  await page.getByRole('button', { name: '이 자리로 정하기' }).click();
  await page.getByText('우리 동네 놀이터').waitFor();
  await page.getByPlaceholder('미래의 우리에게 남길 한마디').fill('테스트 편지');
  await page.getByText('15초 · 테스트').click();
  await shot('06-create-ready');
  check(await page.getByRole('button', { name: '이대로 묻기' }).count() === 1, "'이대로 묻기' 버튼이 활성화되지 않음");
  await page.getByRole('button', { name: '이대로 묻기' }).click();
  await page.getByText('두지가 지하 2층에서 잘 지내고 있습니다.').waitFor({ timeout: 20_000 });
  await shot('07-pit-sealed');

  const capsules = await (await fetch(`${API}/capsules`, { headers: { Authorization: `Bearer ${token}` } })).json();
  const sealed = capsules.capsules.find((capsule) => capsule.placeName === '우리 동네 놀이터');
  check(!!sealed, '웹에서 봉인한 구덩이가 서버에 없음');
  check(sealed && Math.abs(sealed.latitude - HERE.latitude) > 0.0005, '지도에서 찍은 핀이 아니라 현재 위치로 저장됨');

  await browser.close();
  const result = { findings, errors: [...new Set(errors)], screenshots: OUT, sealedAt: sealed && { latitude: sealed.latitude, longitude: sealed.longitude } };
  console.log(JSON.stringify(result, null, 2));
  if (findings.length || result.errors.length) process.exit(1);
})().catch((error) => { console.error(error); process.exit(1); });
