// Exploratory UI review: drives the web preview against the local PoC server and
// reports overlap, clipping, overflow and tap-target problems the scripted checks miss.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { stubMapTiles } = require('./map-test-fixtures.cjs');

const TOKEN = process.env.REVIEW_TOKEN;
const OUT = process.env.REVIEW_OUT || path.resolve(__dirname, '../.build/ui-review');

const findings = [];
const note = (id, where, detail) => { findings.push({ id, where, detail }); console.log(`- [${id}] ${where} :: ${detail}`); };

const rect = async locator => (await locator.count()) ? locator.first().boundingBox() : null;
const overlaps = (a, b) => a && b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function audit(page, where) {
  const w = page.viewportSize().width;
  const over = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  if (over.scroll > over.inner + 1) note('overflow-x', where, `가로 스크롤 발생 (${over.scroll}px > ${over.inner}px)`);

  const small = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('[role="button"],[role="tab"],[role="radio"],button,a')) {
      if (el.closest('[aria-hidden="true"]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height < 44 || r.width < 44) out.push({ label: (el.getAttribute('aria-label') || el.innerText || '').trim().slice(0, 28), w: Math.round(r.width), h: Math.round(r.height) });
    }
    return out;
  });
  for (const s of small) {
    // 지도 저작자 표시는 지도를 가리지 않도록 작게 둔다. WCAG 2.5.8 AA 의 24px 는 넘긴다.
    if (s.label === 'OpenStreetMap' && s.h >= 24) continue;
    note('tap-target', where, `"${s.label}" ${s.w}×${s.h}px (44px 미만)`);
  }

  const clipped = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('[role="button"],[role="tab"],[role="radio"]')) {
      if (el.closest('[aria-hidden="true"]') || el.closest('.dooji-map-surface')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
      if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) continue;
      const top = document.elementFromPoint(cx, cy);
      if (top && !el.contains(top) && !top.contains(el)) {
        out.push({ label: (el.getAttribute('aria-label') || el.innerText || '').trim().slice(0, 28), covered: (top.className || top.tagName || '').toString().slice(0, 40) });
      }
    }
    return out;
  });
  for (const c of clipped) note('covered-control', where, `"${c.label}" 가 다른 요소에 덮임 (${c.covered})`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const results = {};
  for (const [name, viewport] of [['393', { width: 393, height: 852 }], ['320', { width: 320, height: 568 }]]) {
    const context = await browser.newContext({ viewport, geolocation: { latitude: 37.566, longitude: 126.977, accuracy: 6 }, permissions: ['geolocation'], locale: 'ko-KR' });
    await stubMapTiles(context);
    await context.addInitScript(token => { window.localStorage.setItem('mudeoduji.device-session.v1', token); }, TOKEN);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e.message)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const shot = n => page.screenshot({ path: path.join(OUT, `${name}-${n}.png`), fullPage: false });

    await page.goto(process.env.PREVIEW_URL || 'http://localhost:8082', { waitUntil: 'networkidle' });
    await page.locator('.dooji-map-surface[data-ready="true"]').waitFor({ timeout: 30000 });
    await page.getByText('내 캡슐', { exact: false }).first().waitFor();
    await page.waitForTimeout(600);
    await shot('01-home-collapsed');
    await audit(page, `${name}·홈(접힘)`);

    // 지도 캡션과 저작자 표시가 겹치는지
    const caption = await rect(page.locator('text=내 캡슐 주변 지도'));
    const credits = await rect(page.locator('.dooji-map-credits'));
    if (overlaps(caption, credits)) note('overlap', `${name}·홈(접힘)`, '지도 캡션 칩과 OpenStreetMap 저작자 표시가 겹침');

    await page.getByRole('button', { name: '내 캡슐 목록 펼치기' }).click();
    await page.waitForTimeout(700);
    await shot('02-home-expanded');
    await audit(page, `${name}·홈(펼침)`);
    const caption2 = await rect(page.locator('text=내 캡슐 주변 지도'));
    const credits2 = await rect(page.locator('.dooji-map-credits'));
    if (overlaps(caption2, credits2)) note('overlap', `${name}·홈(펼침)`, '지도 캡션 칩과 OpenStreetMap 저작자 표시가 겹침');
    // 펼친 상태에서도 기본 동작에 실제로 닿는지. 위치가 아니라 적중 여부로 본다.
    const buryHit = await page.evaluate(() => {
      const el = [...document.querySelectorAll('[role="button"]')].find(n => n.getAttribute('aria-label') === '캡슐 묻기' && n.getBoundingClientRect().width > 0);
      if (!el) return 'absent';
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return el.contains(top) ? 'ok' : 'covered';
    });
    if (buryHit !== 'ok') note('covered-cta', `${name}·홈(펼침)`, `기본 동작 '캡슐 묻기' 에 닿을 수 없음 (${buryHit})`);

    for (const tab of ['기다리는 중', '꺼낼 시간', '열어본 캡슐', '전체']) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      await page.waitForTimeout(350);
    }
    await shot('03-filters');

    await page.getByRole('button', { name: /약속 보기/ }).first().click();
    await page.waitForTimeout(700);
    await shot('04-detail');
    await audit(page, `${name}·상세`);

    await page.getByRole('button', { name: '뒤로', exact: true }).click();
    await page.waitForTimeout(500);
    // 서랍이 펼쳐진 채로는 '캡슐 묻기' 를 누를 수 없다(위 covered-cta). 접고 진행한다.
    const collapse = page.getByRole('button', { name: '내 캡슐 목록 접기' });
    if (await collapse.count()) { await collapse.click(); await page.waitForTimeout(700); }
    await page.getByRole('button', { name: '캡슐 묻기', exact: true }).click();
    await page.waitForTimeout(700);
    await shot('05-compose');
    await audit(page, `${name}·묻기`);
    const seal = page.getByRole('button', { name: /AR로 묻기/ });
    if (await seal.count() && await seal.first().isDisabled().catch(() => false)) {
      const hint = await page.getByText(/이름을 적으면|하나 이상을 담아|녹음을 끝낸|모임을 먼저|전원이 참여한/).count();
      if (!hint) note('silent-disabled', `${name}·묻기`, "봉인 버튼이 비활성인데 무엇이 빠졌는지 화면에 설명이 없음");
    }

    await page.getByRole('button', { name: '뒤로', exact: true }).click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: '함께 묻기', exact: true }).click();
    await page.waitForTimeout(700);
    await shot('06-groups');
    await audit(page, `${name}·함께`);

    await page.getByRole('button', { name: '뒤로', exact: true }).click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: '실험실', exact: true }).click();
    await page.waitForTimeout(700);
    await shot('07-lab');
    await audit(page, `${name}·실험실`);

    results[name] = { errors: [...new Set(errors)] };
    await context.close();
  }
  await browser.close();
  console.log('\n=== 콘솔 오류 ===');
  console.log(JSON.stringify(results, null, 2));
  console.log(`\n총 ${findings.length}건, 스크린샷: ${OUT}`);
  fs.writeFileSync(path.join(OUT, 'findings.json'), JSON.stringify({ findings, results }, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
