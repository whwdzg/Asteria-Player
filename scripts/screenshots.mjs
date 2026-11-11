import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const exe = process.env.EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const url = process.env.ASTERIA_URL ?? 'http://localhost:4173/';
const out = 'screenshots';
await mkdir(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: exe,
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--force-device-scale-factor=1'],
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: 'dark',
  locale: 'zh-CN',
});
const page = await context.newPage();
page.on('console', (message) => {
  if (message.type() === 'error') console.log('[console error]', message.text());
});
page.on('pageerror', (error) => console.log('[page error]', error.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForSelector('.bottom-bar', { timeout: 20000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/01-desktop-dark.png` });

await page.locator('.np-artwork-shell').click();
await page.waitForSelector('.artwork-lightbox');
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/01b-artwork-lightbox.png` });
await page.keyboard.press('Escape');

// Seek into the first track so the karaoke lyric is visible.
await page.locator('.play-button').click();
await page.waitForTimeout(500);
const bar = await page.locator('.progress-shell').boundingBox();
if (bar) {
  await page.mouse.click(bar.x + bar.width * 0.19, bar.y + bar.height / 2);
}
await page.waitForTimeout(1400);
await page.mouse.move(720, 70);
await page.waitForTimeout(420);
await page.screenshot({ path: `${out}/02-desktop-playing.png` });

await page.locator('.queue-button').click();
await page.waitForSelector('.queue-panel');
await page.waitForTimeout(500);
await page.mouse.move(720, 70);
await page.waitForTimeout(420);
await page.screenshot({ path: `${out}/03-queue-sidebar.png` });

await page.getByRole('button', { name: '展开' }).click();
await page.waitForTimeout(600);
await page.mouse.move(720, 70);
await page.waitForTimeout(420);
await page.screenshot({ path: `${out}/04-queue-full.png` });

await page.getByRole('button', { name: '关闭' }).last().click();
await page.waitForTimeout(400);
await page.locator('.settings-slot .icon-button').click();
await page.waitForSelector('.settings-panel');
await page.waitForTimeout(600);
await page.mouse.move(720, 70);
await page.waitForTimeout(420);
await page.screenshot({ path: `${out}/05-settings.png` });
await page.keyboard.press('Escape');

await page.locator('.volume-slot .icon-button').click();
await page.waitForTimeout(400);
await page.mouse.move(720, 70);
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/06-volume.png` });
await page.keyboard.press('Escape');

await page.locator('.speed-slot .icon-button').click();
await page.waitForTimeout(400);
await page.mouse.move(720, 70);
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/06b-speed.png` });
await page.keyboard.press('Escape');

// Light theme.
await page.evaluate(() => {
  const raw = localStorage.getItem('asteria-settings');
  if (!raw) return;
  const data = JSON.parse(raw);
  data.state.theme = 'light';
  data.state.liquidGlass = true;
  localStorage.setItem('asteria-settings', JSON.stringify(data));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/07-desktop-light.png` });

// Tablet.
await page.setViewportSize({ width: 1024, height: 768 });
await page.emulateMedia({ colorScheme: 'dark' });
await page.evaluate(() => {
  const raw = localStorage.getItem('asteria-settings');
  if (!raw) return;
  const data = JSON.parse(raw);
  data.state.theme = 'system';
  localStorage.setItem('asteria-settings', JSON.stringify(data));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${out}/08-tablet.png` });

// Mobile.
await page.setViewportSize({ width: 390, height: 844 });
await page.emulateMedia({ colorScheme: 'dark' });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.mouse.move(40, 70);
await page.waitForTimeout(420);
await page.screenshot({ path: `${out}/09-mobile.png` });
await page.locator('.queue-button').click();
await page.waitForTimeout(500);
await page.mouse.move(40, 70);
await page.waitForTimeout(420);
await page.screenshot({ path: `${out}/10-mobile-queue.png` });
await page.keyboard.press('Escape');
await page.locator('.settings-slot .icon-button').click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/11-mobile-settings.png` });
await page.keyboard.press('Escape');

// Mobile video card, with the compact layout.
await page.locator('.queue-button').click();
await page.waitForTimeout(400);
await page.locator('.queue-row').filter({ hasText: 'Chromatic Fields' }).first().locator('.queue-row-main').click();
await page.waitForTimeout(300);
await page.locator('.queue-toolbar-actions button[aria-label="关闭"]').click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/11b-mobile-video.png` });

// Video.
await page.setViewportSize({ width: 1440, height: 900 });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.locator('.queue-button').click();
await page.waitForTimeout(400);
await page.locator('.queue-row').filter({ hasText: 'Chromatic Fields' }).first().locator('.queue-row-main').click();
await page.waitForTimeout(300);
await page.locator('.queue-toolbar-actions button[aria-label="关闭"]').click();
await page.waitForTimeout(3200);
await page.mouse.move(720, 260);
await page.waitForTimeout(500);
const videoBar = await page.locator('.progress-shell').boundingBox();
if (videoBar) await page.mouse.move(videoBar.x + videoBar.width * 0.52, videoBar.y + videoBar.height / 2);
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/12-video.png` });
await page.locator('.fullscreen-button').click();
await page.waitForTimeout(700);
await page.mouse.move(720, 300);
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/13-video-fullscreen.png` });
if (await page.evaluate(() => Boolean(document.fullscreenElement))) await page.evaluate(() => document.exitFullscreen());
await page.waitForTimeout(400);

await context.close();
await browser.close();
console.log('screenshots written');
