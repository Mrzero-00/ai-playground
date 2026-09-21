// Browser regression only. Uses three isolated sessions and a temporary API/DB.
// Supply Playwright through NODE_PATH or the test environment, not production deps.
require('tsx/cjs');
const { chromium } = require('playwright');
const { createCapsuleServer } = require('../server/app.ts');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { stubMapTiles } = require('./map-test-fixtures.cjs');

(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dooji-group-ui-'));
  const app = createCapsuleServer({ databasePath: path.join(directory, 'test.sqlite') });
  const shots = path.resolve(__dirname, '../.build/group-ui');
  fs.mkdirSync(shots, { recursive: true });
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  const base = `http://127.0.0.1:${app.server.address().port}`;
  let browser;
  const errors = [], warnings = [];
  let browserSeals = 0, browserOpens = 0, browserAttendance = 0;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    const pages = [];
    for (let i = 0; i < 3; i++) {
      const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
      await stubMapTiles(context);
      await context.route(/^http:\/\/(?:127\.0\.0\.1|localhost):878[78]\//, route => {
        const request = route.request(); const url = new URL(request.url());
        if (request.method() === 'POST' && url.pathname === '/capsules') browserSeals++;
        if (url.pathname.endsWith('/open')) browserOpens++;
        if (url.pathname.includes('/attendance/')) browserAttendance++;
        return route.continue({ url: base + url.pathname + url.search });
      });
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); if (msg.type() === 'warning') warnings.push(msg.text()); });
      await page.goto(process.env.PREVIEW_URL || 'http://localhost:8082', { waitUntil: 'networkidle' });
      await page.getByText('아직은 깨끗한 땅이에요.', { exact: true }).waitFor();
      pages.push(page);
    }
    const [host, b, c] = pages;
    const token = page => page.evaluate(() => localStorage.getItem('mudeoduji.device-session.v1'));
    const request = async (page, endpoint, body) => {
      const res = await fetch(base + endpoint, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${await token(page)}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      assert.ok(res.ok); return res.json();
    };
    await host.getByRole('button', { name: '함께 묻기', exact: true }).click();
    await host.getByRole('textbox', { name: '모임에서 부를 내 이름' }).fill('테스트 첫째');
    await host.getByRole('textbox', { name: '모임 이름', exact: true }).fill('세 명의 MVP 약속');
    await host.getByRole('textbox', { name: '전체 참여 인원' }).fill('3');
    await host.getByRole('button', { name: '초대 코드 만들기' }).click();
    await host.getByText('1 / 3명 참여', { exact: true }).waitFor();
    assert.equal(await host.getByRole('button', { name: '이 모임의 캡슐 담기' }).isDisabled(), true);
    const group = (await request(host, '/groups')).groups[0];
    await host.getByText(group.inviteCode, { exact: true }).waitFor();
    await host.screenshot({ path: path.join(shots, '01-invite.png') });
    for (const [i, page] of [b, c].entries()) {
      await page.getByRole('button', { name: '함께 묻기', exact: true }).click();
      await page.getByRole('textbox', { name: '모임에서 부를 내 이름' }).fill(`테스트 친구${i + 1}`);
      await page.getByRole('textbox', { name: '초대 코드', exact: true }).fill(group.inviteCode);
      await page.getByRole('button', { name: '초대 코드로 참여하기' }).click();
      await page.getByText('모임을 만든 사람이 내용을 담고 봉인하면 내 약속에도 나타나요.', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: '이 모임의 캡슐 담기' }).count(), 0);
    }
    await host.getByRole('button', { name: '모임 새로고침' }).click();
    await host.getByText('3 / 3명 참여', { exact: true }).waitFor();
    await host.getByRole('button', { name: '이 모임의 캡슐 담기' }).click();
    assert.equal(await host.getByRole('radio', { name: '모두 함께' }).getAttribute('aria-checked'), 'true');
    await host.getByText('3명 전원이 모여야 열려요.', { exact: false }).waitFor();
    await host.getByRole('textbox', { name: '캡슐 이름', exact: true }).fill('전원 모여서 열어보기');
    await host.getByRole('button', { name: '캡슐에 내용 넣기', exact: true }).click();
    await host.getByRole('button', { name: '편지 넣기', exact: true }).click();
    await host.getByRole('textbox', { name: '편지 내용', exact: true }).fill('UI 테스트 초안');
    await host.getByRole('button', { name: '완료', exact: true }).click();
    await host.screenshot({ path: path.join(shots, '02-group-compose.png') });
    await host.getByRole('button', { name: '현재 장소에서 AR로 묻기' }).click();
    await host.getByText('AR은 휴대폰에서 확인해요', { exact: true }).waitFor();
    await host.getByRole('button', { name: '돌아가기', exact: true }).click();
    assert.equal(await host.getByRole('textbox', { name: '캡슐 이름', exact: true }).inputValue(), '전원 모여서 열어보기');

    // Test fixture sealed through HTTP, never represented as a successful AR burial.
    await request(host, '/capsules', { groupId: group.id, title: 'HTTP로 만든 공동 테스트 캡슐', placeName: '합성 위치', unlockAfterSeconds: 15,
      location: { latitude: 37.5665, longitude: 126.978, accuracy: 5, timestamp: Date.now() }, content: { letter: '비공개 테스트 편지', photo: null } });
    await b.getByRole('button', { name: '모임 새로고침' }).click();
    await b.getByRole('button', { name: '묻어둔 캡슐 보기' }).click();
    await b.getByText('우리 3명, 모두 모이면', { exact: true }).waitFor();
    assert.equal(await b.getByText('비공개 테스트 편지', { exact: true }).count(), 0);
    await b.getByRole('button', { name: '함께 열기 참여', exact: true }).click();
    await b.getByText('AR은 휴대폰에서 확인해요', { exact: true }).waitFor();
    await b.getByRole('button', { name: '돌아가기', exact: true }).click();
    await b.getByText('우리 3명, 모두 모이면', { exact: true }).scrollIntoViewIfNeeded();
    await b.screenshot({ path: path.join(shots, '03-group-detail.png') });
    for (const page of [host, b, c]) {
      await page.setViewportSize({ width: 320, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    assert.equal(browserSeals, 0); assert.equal(browserOpens, 0); assert.equal(browserAttendance, 0);
    assert.deepEqual(errors, []); assert.deepEqual(warnings, []);
    const result = { passed: true, sessions: 3, errors, warnings, browserSeals, browserOpens, browserAttendance,
      screenshots: shots, realAR: false, realGPS: false, isolatedTemporaryDatabase: true };
    fs.writeFileSync(path.join(shots, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (browser) await browser.close();
    await app.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
