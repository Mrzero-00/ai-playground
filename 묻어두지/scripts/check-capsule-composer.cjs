// Real browser/file-picker checks against an isolated local API, never user capsules.
require('tsx/cjs');
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { createCapsuleServer } = require('../server/app.ts');
const { stubMapTiles } = require('./map-test-fixtures.cjs');

(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dooji-composer-ui-'));
  const app = createCapsuleServer({ databasePath: path.join(directory, 'test.sqlite') });
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const shots = path.resolve(__dirname, '../.build/capsule-composer');
  fs.mkdirSync(shots, { recursive: true });
  let browser, page;
  const errors = [], warnings = [];
  let seals = 0;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
    await stubMapTiles(context);
    await context.route(/^http:\/\/(?:127\.0\.0\.1|localhost):878[78]\//, route => {
      const url = new URL(route.request().url());
      if (route.request().method() === 'POST' && url.pathname === '/capsules') seals++;
      return route.continue({ url: base + url.pathname + url.search });
    });
    page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); if (msg.type() === 'warning') warnings.push(msg.text()); });
    await page.goto(process.env.PREVIEW_URL || 'http://localhost:8082', { waitUntil: 'networkidle' });
    const button = name => page.getByRole('button', { name, exact: true });
    const settle = () => page.evaluate(() => Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => undefined))));
    const openMenu = async () => { await button('캡슐에 내용 넣기').click(); await settle(); };
    const done = async () => { await button('완료').click(); await button('내용 담기 닫기').waitFor({ state: 'hidden' }); };
    const shoot = async name => { await settle(); await page.screenshot({ path: path.join(shots, name + '.png') }); };
    const seal = page.getByRole('button', { name: '현재 장소에서 AR로 묻기' });
    const chooseFile = async (label, file) => {
      const picker = page.waitForEvent('filechooser');
      await button(label).click(); await (await picker).setFiles(file);
    };
    await button('캡슐 묻기').click();
    assert.equal(await page.getByRole('textbox', { name: '편지 내용' }).count(), 0);
    assert.equal(await button('음성 파일 고르기').count(), 0);
    assert.equal(await button('영상 고르기').count(), 0);
    assert.equal(await seal.isDisabled(), true);
    await shoot('01-empty-capsule');
    const photoBytes = await button('캡슐에 내용 넣기').screenshot();
    await openMenu();
    for (const name of ['사진 넣기', '음성 넣기', '영상 넣기', '편지 넣기']) await button(name).waitFor();
    await shoot('02-menu');
    await button('사진 넣기').click();
    assert.equal(await page.getByRole('textbox', { name: '편지 내용' }).count(), 0);
    await button('내용 담기 닫기').click();
    assert.equal(await seal.isDisabled(), true);

    await openMenu(); await button('편지 넣기').click();
    await page.getByRole('textbox', { name: '편지 내용', exact: true }).fill('오늘의 우리는 정말 많이 웃었다. 다음에도 여기서 만나자!');
    await shoot('03-letter'); await done();
    await button('담은 편지 수정하기').waitFor();
    await button('담은 편지 수정하기').click();
    await settle();
    assert.match(await page.getByRole('textbox', { name: '편지 내용' }).inputValue(), /다음에도/);
    await page.keyboard.press('Escape');
    await button('내용 담기 닫기').waitFor({ state: 'hidden' });

    await openMenu(); await button('사진 넣기').click();
    await chooseFile('사진 고르기', { name: 'capsule-test.png', mimeType: 'image/png', buffer: photoBytes });
    await page.getByRole('img', { name: '담은 사진 미리보기' }).waitFor();
    await shoot('04-photo'); await done();
    await button('담은 사진 수정하기').waitFor();

    await openMenu(); await button('음성 넣기').click();
    await chooseFile('음성 파일 고르기', { name: 'unsupported.txt', mimeType: 'text/plain', buffer: Buffer.from('not audio') });
    await page.getByText('음성은 M4A, MP3, WAV 파일로 담아 주세요.', { exact: true }).last().waitFor();
    await chooseFile('음성 파일 고르기', path.resolve(__dirname, '../server/fixtures/tone.wav'));
    await button('음성 재생').waitFor();
    await shoot('05-audio'); await done();
    await button('담은 음성 수정하기').waitFor();
    assert.equal(await button('음성 재생').count(), 0);

    await openMenu(); await button('영상 넣기').click();
    await chooseFile('영상 고르기', path.resolve(__dirname, '../server/fixtures/blue.mp4'));
    await page.locator('video').waitFor();
    await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
    await shoot('06-video');
    const video = await page.locator('video').elementHandle();
    await video.evaluate(node => node.play());
    await done();
    assert.equal(await video.evaluate(node => node.paused), true);
    assert.equal(await page.locator('video').count(), 0);
    await page.getByText('4가지 기억이 담겨 있어요', { exact: true }).waitFor();
    await shoot('07-packed');

    await page.getByRole('textbox', { name: '캡슐 이름', exact: true }).fill('다음에도 우리 여기서');
    assert.equal(await seal.isEnabled(), true);
    await button('뒤로').click(); await button('실험실').click(); await button('뒤로').click(); await button('캡슐 묻기').click();
    await page.getByText('4가지 기억이 담겨 있어요', { exact: true }).waitFor();
    await seal.click();
    await page.getByText('AR은 휴대폰에서 확인해요', { exact: true }).waitFor();
    assert.equal(await page.locator('video').count(), 0);
    assert.equal(await page.getByRole('textbox', { name: '편지 내용' }).count(), 0);
    await button('돌아가기').click();
    await page.getByText('4가지 기억이 담겨 있어요', { exact: true }).waitFor();
    assert.equal(seals, 0);

    for (const viewport of [{ width: 320, height: 740 }, { width: 844, height: 390 }, { width: 1280, height: 900 }]) {
      await page.setViewportSize(viewport); await openMenu();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await button('편지 넣기').click();
      const box = await button('완료').boundingBox();
      assert.ok(box && box.y >= 0 && box.y + box.height <= viewport.height, 'Done must stay within the sheet viewport');
      await done();
    }
    await page.setViewportSize({ width: 393, height: 852 });
    for (const kind of ['사진', '음성', '영상', '편지']) {
      await button(`담은 ${kind} 수정하기`).click(); await button(`${kind} 빼기`).click(); await done();
      assert.equal(await button(`담은 ${kind} 수정하기`).count(), 0);
    }
    assert.equal(await seal.isDisabled(), true);
    assert.deepEqual(errors, []); assert.deepEqual(warnings, []);
    const result = { passed: true, errors, warnings, seals, allFourEditors: true, realFilePickers: true, draftRetention: true, removal: true, videoStopsOnClose: true, realAR: false, nativeRecording: false, isolatedTemporaryDatabase: true };
    fs.writeFileSync(path.join(shots, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    if (page) { await page.screenshot({ path: path.join(shots, 'failure.png') }); console.error((await page.locator('body').innerText()).slice(-7000)); }
    console.error({ errors, warnings }); throw error;
  } finally {
    if (browser) await browser.close();
    await app.close(); fs.rmSync(directory, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
