import { chromium } from 'playwright-core';
import path from 'node:path';

const root = path.resolve('.');
const exe = process.env.EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({
  executablePath: exe,
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', locale: 'zh-CN' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
const log = (...args) => console.log('•', ...args);
const check = (condition, message) => {
  if (!condition) throw new Error(`CHECK FAILED: ${message}`);
  log('ok:', message);
};

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForSelector('.bottom-bar');
await page.waitForTimeout(800);

// -------- transport & modes
await page.locator('.play-button').click();
await page.waitForTimeout(500);
check(await page.locator('.play-button').getAttribute('aria-label') === '暂停', 'play toggles to pause');
const modes = [];
for (let i = 0; i < 4; i += 1) {
  await page.locator('.mode-button').click();
  modes.push(await page.locator('.mode-button').getAttribute('aria-label'));
}
check(new Set(modes).size === 4, `mode cycles through four states: ${modes.join(', ')}`);
await page.locator('.play-button').click();

// -------- volume and tuner
await page.locator('.volume-slot .icon-button').click();
check(await page.locator('.volume-panel').isVisible(), 'volume card opens');
await page.locator('.eq-header').click();
check(await page.locator('.eq-bands').isVisible(), 'tuner expands');
await page.getByRole('button', { name: '低音' }).click();
check(await page.locator('.eq-glyph.is-on').count() === 1, 'tuner preset enables EQ');
await page.keyboard.press('Escape');

// -------- settings + language
await page.getByRole('button', { name: '设置' }).click();
await page.waitForSelector('.settings-panel');
check(await page.locator('.settings-section').count() >= 4, 'settings sections render');
await page.getByRole('button', { name: '浅色' }).click();
await page.waitForTimeout(300);
check(await page.evaluate(() => document.documentElement.dataset.theme) === 'light', 'light theme applies');
const languageSelect = page.locator('.setting-row .fluent-select select').first();
await languageSelect.selectOption('en');
await page.waitForTimeout(700);
check((await page.locator('.settings-header h2').textContent()) === 'Settings', 'English language pack applies');
await page.screenshot({ path: 'screenshots/qa-english-settings.png' });
await languageSelect.selectOption('zh-CN');
await page.waitForTimeout(500);
await page.getByRole('button', { name: '深色' }).click();
await page.keyboard.press('Escape');

// -------- queue full + search + item menu
await page.locator('.queue-button').click();
await page.waitForSelector('.queue-panel');
check(await page.locator('.queue-panel.is-sidebar').count() === 1, 'queue opens as sidebar');
await page.getByRole('button', { name: '展开' }).click();
check(await page.locator('.queue-panel.is-full').count() === 1, 'queue expands to a full page');
await page.getByRole('button', { name: '搜索' }).click();
await page.locator('.queue-search-row input').fill('paper');
await page.waitForTimeout(250);
check(await page.locator('.queue-row').count() === 1, 'queue search filters rows');
await page.locator('.queue-search-row input').fill('');
await page.locator('.queue-toolbar-actions button[aria-label="关闭"]').click();
await page.waitForTimeout(200);

// -------- new sequence
await page.locator('.queue-button').click();
await page.locator('.sequence-button').click();
await page.getByRole('menuitem', { name: '新建播放序列' }).click();
await page.locator('#playlist-name').fill('QA Sequence');
await page.getByRole('button', { name: '创建' }).click();
await page.waitForTimeout(300);
await page.locator('.sequence-button').click();
check(await page.getByRole('menuitem', { name: 'QA Sequence' }).count() === 1, 'custom sequence appears in switcher');
await page.getByRole('menuitem', { name: 'QA Sequence' }).click();
check((await page.locator('.sequence-button').textContent()).includes('QA Sequence'), 'custom sequence can be selected');
await page.locator('.sequence-button').click();
await page.getByRole('menuitem', { name: '全部' }).click();
await page.waitForTimeout(200);
await page.locator('.queue-panel .queue-toolbar-actions .icon-button').last().click();

// -------- import local media with sidecars
await page.locator('input[type=file]').first().setInputFiles([
  path.join(root, 'public/demo/audio/aurora-drift.mp3'),
  path.join(root, 'public/demo/audio/aurora-drift.spl'),
  path.join(root, 'public/demo/covers/aurora-drift.jpg'),
]);
await page.waitForTimeout(2500);
await page.locator('.queue-button').click();
await page.waitForTimeout(300);
const rows = await page.locator('.queue-row').count();
check(rows >= 5, `local track imported (${rows} queue rows)`);
const localRow = page.locator('.queue-row').filter({ hasText: 'Aurora Drift' }).last();
await localRow.locator('.queue-row-main').click();
await page.waitForTimeout(1100);
await page.locator('.queue-panel .queue-toolbar-actions .icon-button').last().click();
await page.waitForTimeout(500);
check((await page.locator('.lyrics-badges').textContent()).includes('同名文件'), 'local SPL sidecar lyrics loaded');
check(await page.locator('.lyric-line').count() > 5, 'local lyrics render');

// -------- import embedded lyrics
await page.locator('input[type=file]').first().setInputFiles([
  path.join(root, 'public/demo/audio/liquid-glass.mp3'),
]);
await page.waitForTimeout(2500);
await page.locator('.queue-button').click();
const glassRow = page.locator('.queue-row').filter({ hasText: 'Liquid Glass' }).last();
await glassRow.locator('.queue-row-main').click();
await page.waitForTimeout(1000);
await page.locator('.queue-panel .queue-toolbar-actions .icon-button').last().click();
await page.waitForTimeout(500);
check((await page.locator('.lyrics-badges').textContent()).includes('音频标签'), 'embedded ID3 lyrics loaded');

// -------- item menu actions
await page.locator('.queue-button').click();
const firstRow = page.locator('.queue-row').first();
await firstRow.locator('.queue-more').click();
check(await page.getByRole('menuitem', { name: '下一个播放' }).count() === 1, 'item menu has play next');
await page.getByRole('menuitem', { name: '查看详细信息' }).click();
await page.waitForSelector('.modal-panel');
check(await page.locator('.details-grid').count() === 1, 'track details dialog opens');
await page.getByRole('button', { name: '关闭详细信息' }).click();
await page.keyboard.press('Escape');

// -------- video + subtitles + danmaku
await page.locator('.queue-button').click();
await page.waitForTimeout(300);
await page.getByText('Chromatic Fields', { exact: true }).first().click();
await page.waitForTimeout(500);
await page.locator('.queue-toolbar-actions button[aria-label="关闭"]').click();
await page.waitForTimeout(1400);
check(await page.locator('.danmaku-item').count() > 0, 'danmaku renders on video');
check(await page.locator('.subtitle-cue').count() === 1, 'default subtitle renders');
const ccButton = page.locator('.video-quick-tools .icon-button').first();
await ccButton.click();
await page.waitForTimeout(200);
const items = await page.getByRole('menuitem').allTextContents();
check(items.some((item) => item.includes('English')), 'subtitle language menu lists English');
await page.getByRole('menuitem', { name: 'English' }).click();
await page.waitForTimeout(700);
check((await page.locator('.subtitle-cue').textContent()).includes('Light flows'), 'subtitle language switch works');
await page.screenshot({ path: 'screenshots/qa-video-english-subtitle.png' });

// -------- fullscreen auto-hide
await page.getByRole('button', { name: '全屏' }).first().click();
await page.waitForTimeout(600);
check(await page.evaluate(() => Boolean(document.fullscreenElement)), 'native fullscreen entered');
await page.waitForTimeout(3300);
check((await page.locator('.app').getAttribute('class')).includes('chrome-hidden'), 'chrome auto-hides in fullscreen video');
await page.mouse.move(700, 860);
await page.waitForTimeout(400);
check((await page.locator('.app').getAttribute('class')).includes('chrome-visible'), 'chrome reveals near the bottom edge');
await page.mouse.move(700, 300);
await page.waitForTimeout(300);
check((await page.locator('.app').getAttribute('class')).includes('chrome-hidden'), 'chrome hides when the pointer leaves the bottom');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// -------- mobile layout
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(500);
check(await page.locator('.bottom-bar').boundingBox().then((box) => box.height) <= 145, 'mobile bottom bar keeps a compact height');
await page.screenshot({ path: 'screenshots/qa-mobile.png' });

check(errors.length === 0, `no runtime errors (${errors.length})`);
console.log('\nALL QA CHECKS PASSED');
if (errors.length) console.log(errors);
await context.close();
await browser.close();
