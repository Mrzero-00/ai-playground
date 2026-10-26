const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stubMapTiles } = require('./map-test-fixtures.cjs');

(async () => {
  const shots = path.resolve(__dirname, '../.build/map-home'); fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, geolocation: { latitude: 37.566, longitude: 126.977, accuracy: 6 }, permissions: ['geolocation'] });
  await stubMapTiles(context);
  const now = Date.now();
  const make = (id, title, offset, latitude, longitude, openedAt = null) => ({ id, title, placeName: 'UI 테스트 장소', createdAt: new Date(now - 999999 + offset).toISOString(), opensAt: new Date(now + offset).toISOString(), openedAt, latitude, longitude, radiusMeters: 50, hasPhoto: true, hasAudio: false, hasVideo: false });
  let fixtures = [], failApi = false, sensitiveCalls = 0;
  await context.route(/^http:\/\/(?:127\.0\.0\.1|localhost):878[78]\//, route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/sessions') return route.fulfill({ json: { token: 'isolated-map-ui-fixture' } });
    if (url.pathname === '/capsules' && route.request().method() === 'GET') return route.fulfill(failApi ? { status: 503, json: { error: { code: 'TEST_OFFLINE', message: '연결 실패 테스트' } } } : { json: { capsules: fixtures, serverNow: new Date().toISOString() } });
    sensitiveCalls++;
    return route.fulfill({ status: 400, json: { error: { code: 'UI_ONLY', message: '이 검사는 내용 API를 호출하지 않습니다.' } } });
  });
  await context.addInitScript(() => {
    window.__locationRequests = 0;
    const original = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    navigator.geolocation.getCurrentPosition = (...args) => { window.__locationRequests++; return original(...args); };
  });
  const page = await context.newPage();
  const errors = [], warnings = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('503')) errors.push(msg.text()); if (msg.type() === 'warning') warnings.push(msg.text()); });
  const button = name => page.getByRole('button', { name, exact: true });
  const drawer = page.getByTestId('capsule-list-drawer');
  const shot = name => page.screenshot({ path: path.join(shots, name + '.png') });
  try {
    await page.goto(process.env.PREVIEW_URL || 'http://localhost:8082', { waitUntil: 'networkidle' });
    await page.locator('.dooji-map-surface[data-ready="true"][data-tiles-ready="true"]').waitFor();
    assert.ok(Math.abs(Number(await page.locator('.dooji-map-surface').getAttribute('data-pitch')) - 55) < .001);
    assert.ok((await page.locator('.dooji-map-surface').boundingBox()).height > 800);
    assert.equal(await page.locator('.dooji-map-surface').getAttribute('data-bearing'), '-28');
    await page.getByText('아직은 깨끗한 땅이에요.', { exact: true }).waitFor();
    await page.getByText('기본 지도 · 서울', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__locationRequests), 0);
    assert.equal(await page.getByRole('textbox').count(), 0);
    await shot('01-map-empty');
    await button('지도를 평면으로 보기').click();
    assert.equal(await page.locator('.dooji-map-surface').getAttribute('data-pitch'), '0');
    assert.equal(await page.locator('.dooji-map-surface').getAttribute('data-bearing'), '0');
    await shot('01b-flat-map');
    await button('지도를 쿼터뷰로 보기').click();
    assert.ok(Math.abs(Number(await page.locator('.dooji-map-surface').getAttribute('data-pitch')) - 55) < .001);
    const collapsed = (await drawer.boundingBox()).height;
    const handle = await page.getByTestId('capsule-list-handle').boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + 19);
    await page.mouse.down(); await page.mouse.move(handle.x + handle.width / 2, handle.y - 380, { steps: 20 }); await page.mouse.up();
    await button('내 캡슐 목록 접기').waitFor();
    await page.waitForFunction(() => document.querySelector('[data-testid="capsule-list-drawer"]').getBoundingClientRect().height > 650);
    assert.ok((await drawer.boundingBox()).height > collapsed + 300);
    await page.getByRole('tab', { name: '전체', exact: true }).waitFor();
    await shot('02-drawer-expanded');
    await button('내 캡슐 목록 접기').click();
    await page.waitForFunction(() => document.querySelector('[data-testid="capsule-list-drawer"]').getBoundingClientRect().height < 200);

    fixtures = [make('waiting', '봄에 다시 모일 우리', 86400000, 37.5665, 126.978), make('ready', '이제 꺼낼 수 있는 편지', -1000, 37.568, 126.976), make('opened', '한 번 꺼내본 하루', -100000, 37.5649, 126.9784, new Date(now - 5000).toISOString())];
    await button('내 캡슐 목록 펼치기').click(); await button('캡슐 목록 새로고침').click();
    await page.getByRole('button', { name: '봄에 다시 모일 우리, UI 테스트 장소, 약속 보기', exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelectorAll('.dooji-map-pin').length === 3);
    const waitingMarker = page.locator('[data-capsule-id="waiting"]');
    const waitingClock = waitingMarker.getByRole('timer');
    const markerNode = await waitingMarker.elementHandle();
    const ground = waitingMarker.locator('.dooji-capsule-ground');
    const groundBefore = await ground.boundingBox();
    const firstClock = await waitingClock.innerText();
    assert.match(firstClock, /^\d+일 \d{2}시간 \d{2}분 \d{2}초$/);
    await page.waitForFunction(value => document.querySelector('[data-capsule-id="waiting"] [role="timer"]').textContent !== value, firstClock);
    assert.equal(await markerNode.evaluate(node => node.isConnected), true, 'clock ticks must not replace the marker');
    assert.deepEqual(await ground.boundingBox(), groundBefore, 'the saved ground point must not bob with the capsule');
    const gradientIds = await page.locator('.dooji-map-pin linearGradient').evaluateAll(nodes => nodes.map(node => node.id));
    assert.equal(new Set(gradientIds).size, gradientIds.length, 'capsule SVG gradients must have unique ids');
    assert.equal(await page.locator('[data-capsule-id="ready"] [role="timer"]').innerText(), '열어볼 시간!');
    assert.equal(await page.locator('[data-capsule-id="opened"] [role="timer"]').innerText(), '열어본 캡슐');
    const float = waitingMarker.locator('.dooji-capsule-float');
    const floatTransform = await float.evaluate(node => getComputedStyle(node).transform);
    await page.waitForFunction(value => getComputedStyle(document.querySelector('[data-capsule-id="waiting"] .dooji-capsule-float')).transform !== value, floatTransform);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await float.evaluate(node => getComputedStyle(node).animationName), 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    for (const filter of ['기다리는 중', '꺼낼 시간', '열어본 캡슐']) {
      await page.getByRole('tab', { name: filter, exact: true }).click();
      assert.equal(await page.getByRole('button', { name: /약속 보기$/ }).count(), 1);
    }
    await page.getByRole('tab', { name: '전체', exact: true }).click();
    await shot('03-list-fixtures');
    await page.getByRole('button', { name: '봄에 다시 모일 우리, UI 테스트 장소, 약속 보기', exact: true }).click();
    await page.getByText('두지가 지키는 중', { exact: true }).waitFor();
    assert.equal(await float.evaluate(node => getComputedStyle(node).animationPlayState), 'paused');
    assert.equal(await page.getByRole('textbox').count(), 0);
    await shot('04-detail-sheet'); await button('뒤로').click(); await button('내 캡슐 목록 접기').click();
    await page.waitForFunction(() => document.querySelector('[data-testid="capsule-list-drawer"]').getBoundingClientRect().height < 200);
    await shot('04b-floating-capsules');
    await button('봄에 다시 모일 우리, 지도에서 캡슐 보기').click();
    await page.getByText('두지가 지키는 중', { exact: true }).waitFor(); await button('뒤로').click();
    const surface = await page.locator('.dooji-map-surface').boundingBox();
    const transform = () => page.locator('.dooji-map-pin').first().evaluate(node => getComputedStyle(node).transform);
    const before = await transform();
    await page.mouse.move(surface.x + 60, surface.y + 340); await page.mouse.down(); await page.mouse.move(surface.x + 125, surface.y + 375, { steps: 15 }); await page.mouse.up();
    assert.notEqual(await transform(), before);
    const beforeZoom = Number(await page.locator('.dooji-map-surface').getAttribute('data-zoom'));
    await page.mouse.wheel(0, -160);
    await page.waitForFunction(before => Number(document.querySelector('.dooji-map-surface').dataset.zoom) > before, beforeZoom);
    assert.ok(Math.abs(Number(await page.locator('.dooji-map-surface').getAttribute('data-pitch')) - 55) < .001);
    await button('캡슐 묻기').click();
    await button('캡슐에 내용 넣기').waitFor();
    await shot('05-compose-sheet'); await button('뒤로').click();
    await button('현재 위치로 이동').click();
    await page.getByText('마지막으로 확인한 내 위치', { exact: true }).waitFor();
    assert.ok(await page.evaluate(() => window.__locationRequests) > 0);
    await shot('06-location-fixture');

    for (const viewport of [{ width: 320, height: 740 }, { width: 844, height: 390 }, { width: 1280, height: 900 }]) {
      await page.setViewportSize(viewport);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await button('내 캡슐 목록 펼치기').click();
      const credits = await page.locator('.dooji-map-credits').boundingBox();
      assert.ok(credits && credits.y >= 0 && credits.y + credits.height < viewport.height);
      await button('내 캡슐 목록 접기').click();
    }
    failApi = true;
    await button('내 캡슐 목록 펼치기').click(); await button('캡슐 목록 새로고침').click();
    await page.getByText('캡슐을 불러오지 못했어요', { exact: true }).waitFor();
    failApi = false; await button('다시 불러오기').click();
    await page.getByRole('button', { name: /봄에 다시 모일 우리.*약속 보기/ }).waitFor();

    // Deadline transition is visual only: no open/attendance/content request is sent.
    await page.setViewportSize({ width: 393, height: 852 });
    fixtures = [{ ...fixtures[0], title: '<img src=x onerror=alert(1)> 오래 기다리는 캡슐 이름', opensAt: new Date(Date.now() + 4000).toISOString() }];
    await button('캡슐 목록 새로고침').click();
    await page.waitForFunction(() => document.querySelectorAll('.dooji-map-pin').length === 1);
    assert.equal(await waitingMarker.locator('img, script').count(), 0, 'titles are rendered as text, never HTML');
    await page.waitForFunction(() => document.querySelector('[data-capsule-id="waiting"]').dataset.state === 'ready', null, { timeout: 10000 });
    assert.equal(await waitingClock.innerText(), '열어볼 시간!');
    await button('내 캡슐 목록 접기').click();
    await shot('07-countdown-finished');
    assert.equal(sensitiveCalls, 0); assert.deepEqual(errors, []); assert.deepEqual(warnings, []);
    const result = { passed: true, quarterPitch: 55, quarterBearing: -28, flatToggle: true, zoomKeepsPerspective: true, draggableDrawer: true, filters: true, mapAndListDetail: true, mapPan: true, liveFourUnitCountdown: true, stableMarkerOnTick: true, fixedGroundAnchor: true, uniqueSvgGradients: true, floatingAnimation: true, reducedMotion: true, pauseBehindSheet: true, deadlineTransition: true, escapedTitle: true, locationOnlyOnRequest: true, errorRecovery: true, sensitiveCalls, errors, warnings, tiles: 'labelled local SVG rasterized as PNG test double', gps: 'browser fixture; not real GPS', userDatabaseWrites: 0 };
    fs.writeFileSync(path.join(shots, 'result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    await shot('failure'); console.error((await page.locator('body').innerText()).slice(-5000)); console.error({ errors, warnings }); throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
