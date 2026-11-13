import { chromium } from 'playwright-core';

const exe = process.env.EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const url = process.env.ASTERIA_URL ?? 'http://localhost:4173/';
const browser = await chromium.launch({
  executablePath: exe,
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  colorScheme: 'dark',
  locale: 'zh-CN',
  hasTouch: true,
  isMobile: true,
});
await context.addInitScript(() => localStorage.setItem('asteria-demo-preference', 'demo'));
const page = await context.newPage();
const check = (condition, message) => {
  if (!condition) throw new Error(`TOUCH CHECK FAILED: ${message}`);
  console.log('• ok:', message);
};

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForSelector('.np-title', { timeout: 20000 });
check(await page.locator('.mobile-player').count() === 1, 'mobile cover player renders on a phone');
await page.locator('.volume-slot > .icon-button').click();
await page.waitForTimeout(320);
const mobilePopover = await page.locator('.utility-popover').boundingBox();
check(Boolean(mobilePopover && mobilePopover.y > 0 && mobilePopover.y + mobilePopover.height <= 844), 'mobile utility popover renders above the bottom bar');
await page.locator('.volume-slot > .icon-button').click();
await page.waitForTimeout(200);
await page.locator('.queue-button').click();
await page.waitForSelector('.queue-panel');
await page.getByText('Chromatic Fields', { exact: true }).first().click();
await page.waitForTimeout(500);
check(await page.locator('.queue-panel').count() === 0, 'selecting a video returns to its main page');
if (await page.locator('.queue-panel').count()) {
  await page.locator('.queue-toolbar-actions button[aria-label="关闭"]').click();
}
await page.waitForTimeout(3700);

const appClass = () => page.locator('.app').getAttribute('class');
const playLabel = () => page.locator('.play-button').getAttribute('aria-label');
check(!(await appClass()).includes('chrome-hidden'), 'controls stay visible outside fullscreen');
check(await page.locator('.bottom-bar').evaluate((element) => getComputedStyle(element).opacity) === '1', 'bottom bar is visible outside fullscreen');

await page.touchscreen.tap(200, 300);
await page.waitForTimeout(500);
check(!(await appClass()).includes('chrome-hidden'), 'single tap does not hide the non-fullscreen bar');

const beforeTap = await playLabel();
await page.touchscreen.tap(200, 300);
await page.waitForTimeout(120);
await page.touchscreen.tap(200, 300);
await page.waitForTimeout(500);
check((await playLabel()) !== beforeTap, 'double tap toggles play / pause');
if ((await playLabel()).includes('播放')) {
  await page.touchscreen.tap(200, 300);
  await page.waitForTimeout(120);
  await page.touchscreen.tap(200, 300);
  await page.waitForTimeout(400);
}

const cdp = await context.newCDPSession(page);
const at = (x, y) => ({ x, y, id: 1, radiusX: 2, radiusY: 2, force: 1 });

await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(200, 300)] });
await page.waitForTimeout(700);
check(await page.locator('.gesture-hud.is-speed').count() === 1, 'long press shows 2x HUD');
check(await page.evaluate(() => {
  const hud = document.querySelector('.gesture-hud.is-speed').getBoundingClientRect();
  const frame = document.querySelector('.video-frame').getBoundingClientRect();
  return hud.top + hud.height / 2 < frame.top + frame.height / 2;
}), 'speed HUD sits above the video centre');
check((await page.locator('.player-video').evaluate((video) => video.playbackRate)) === 2, 'long press applies 2x rate');
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await page.waitForTimeout(300);
check((await page.locator('.player-video').evaluate((video) => video.playbackRate)) === 1, 'rate restores after long press');

const volumeBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('asteria-settings')).state.volume);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(335, 340)] });
for (let i = 1; i <= 8; i += 1) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at(335, 340 - i * 12)] });
  await page.waitForTimeout(25);
}
check(await page.locator('.gesture-hud.is-volume').count() === 1, 'right vertical swipe shows volume HUD');
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await page.waitForTimeout(250);
const volumeAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('asteria-settings')).state.volume);
check(volumeAfter > volumeBefore, 'right vertical swipe raises volume');

const brightnessBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('asteria-settings')).state.brightness);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(45, 330)] });
for (let i = 1; i <= 8; i += 1) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at(45, 330 + i * 13)] });
  await page.waitForTimeout(25);
}
check(await page.locator('.gesture-hud.is-brightness').count() === 1, 'left vertical swipe shows brightness HUD');
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await page.waitForTimeout(250);
const brightnessAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('asteria-settings')).state.brightness);
check(brightnessAfter < brightnessBefore, 'left downward swipe lowers brightness');

const timeBefore = Number(await page.locator('.progress-shell').getAttribute('aria-valuenow'));
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(130, 300)] });
for (let i = 1; i <= 9; i += 1) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at(130 + i * 16, 300)] });
  await page.waitForTimeout(30);
}
check(await page.locator('.gesture-hud.is-seek').count() === 1, 'horizontal swipe shows seek HUD');
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await page.waitForTimeout(450);
const timeAfter = Number(await page.locator('.progress-shell').getAttribute('aria-valuenow'));
check(timeAfter > timeBefore, 'horizontal swipe seeks forward');

await page.setViewportSize({ width: 844, height: 390 });
await page.waitForTimeout(700);
check((await appClass()).includes('is-video-fullscreen'), 'landscape rotation enters immersive fullscreen');
await page.waitForTimeout(3400);
check((await appClass()).includes('chrome-hidden'), 'fullscreen video chrome still auto-hides');
await page.touchscreen.tap(200, 180);
await page.waitForTimeout(500);
check((await appClass()).includes('chrome-visible'), 'tap reveals fullscreen chrome');
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(600);
check(!(await appClass()).includes('is-video-fullscreen'), 'portrait rotation leaves immersive fullscreen');

console.log('\nALL TOUCH QA CHECKS PASSED');
await context.close();
await browser.close();
