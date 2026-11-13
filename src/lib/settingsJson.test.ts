import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  parseSettingsJson,
  serializeSettings,
  settingsDocument,
} from './settingsJson';

describe('settings JSON', () => {
  it('loads the documented defaults file', () => {
    expect(DEFAULT_SETTINGS.theme).toBe('system');
    expect(DEFAULT_SETTINGS.eqGains).toHaveLength(5);
    expect(DEFAULT_SETTINGS.shortcuts.playPause?.code).toBe('Space');
    expect(DEFAULT_SETTINGS.bilibiliProxy).toBe('');
    expect(DEFAULT_SETTINGS.backgroundVideo).toBe(false);
    expect(DEFAULT_SETTINGS.audioVisualizer).toBe(false);
    expect(DEFAULT_SETTINGS.audioVisualizerHeight).toBe(0.8);
    expect(DEFAULT_SETTINGS.audioVisualizerOpacity).toBe(0.55);
    expect(DEFAULT_SETTINGS.lyricSize).toBe(1.1);
    expect(DEFAULT_SETTINGS.lyricWeight).toBe(700);
    expect(DEFAULT_SETTINGS.lyricTranslationSize).toBe(0.7);
    expect(DEFAULT_SETTINGS.lyricAlign).toBe('left');
    expect(DEFAULT_SETTINGS.danmakuSize).toBe(25);
    expect(DEFAULT_SETTINGS.danmakuArea).toBe('full');
    expect(DEFAULT_SETTINGS.autoPlayNext).toBe(true);
    expect(DEFAULT_SETTINGS.fullscreenClock).toBe(false);
    expect(DEFAULT_SETTINGS.fullscreenClockOpacity).toBe(0.72);
    expect(DEFAULT_SETTINGS.videoFit).toBe('contain');
    expect(DEFAULT_SETTINGS.videoHudPosition).toBe('centerTop');
    expect(DEFAULT_SETTINGS.showVideoPauseIcon).toBe(true);
    expect(DEFAULT_SETTINGS.danmuApiBase).toBe('');
  });

  it('exports a versioned, method-free document', () => {
    const document = settingsDocument(DEFAULT_SETTINGS);
    expect(document.version).toBe(1);
    expect(document.settings.theme).toBe('system');
    expect('patch' in document.settings).toBe(false);
    expect('lastTrackId' in document.settings).toBe(false);
    expect(JSON.parse(serializeSettings(DEFAULT_SETTINGS)).settings.volume).toBe(0.8);
  });

  it('accepts the wrapper and bare objects, clamping unsafe values', () => {
    const wrapped = parseSettingsJson(JSON.stringify({
      version: 1,
      settings: { theme: 'light', volume: 9, lyricSize: 0.1, shortcuts: {} },
    }));
    expect(wrapped.settings.theme).toBe('light');
    expect(wrapped.settings.volume).toBe(1.2);
    expect(wrapped.settings.lyricSize).toBe(0.7);
    expect(wrapped.settings.shortcuts.playPause?.code).toBe('Space');

    const bare = parseSettingsJson(JSON.stringify({ theme: 'dark', language: 'en', danmakuArea: 'half', videoFit: 'cover', autoPlayNext: false, audioVisualizer: true, audioVisualizerHeight: 9, audioVisualizerOpacity: 0, fullscreenClockOpacity: 0 }));
    expect(bare.settings.danmakuArea).toBe('half');
    expect(bare.settings.videoFit).toBe('cover');
    expect(bare.settings.autoPlayNext).toBe(false);
    expect(bare.settings.audioVisualizer).toBe(true);
    expect(bare.settings.audioVisualizerHeight).toBe(1);
    expect(bare.settings.audioVisualizerOpacity).toBe(0.1);
    expect(bare.settings.fullscreenClockOpacity).toBe(0.1);
    expect(bare.settings.theme).toBe('dark');
    expect(bare.settings.videoHudPosition).toBe('centerTop');
    expect(bare.settings.showVideoPauseIcon).toBe(true);
    expect(bare.settings.language).toBe('en');
  });

  it('rejects malformed or unsupported input', () => {
    expect(() => parseSettingsJson('{')).toThrow(/Invalid JSON/);
    expect(() => parseSettingsJson(JSON.stringify({ version: 99, settings: { theme: 'dark' } }))).toThrow(/Unsupported/);
    expect(() => parseSettingsJson('{}')).toThrow(/does not contain/);
  });

  it('keeps session fields out of imported settings', () => {
    const settings = normalizeSettings({ theme: 'dark' }, { ...DEFAULT_SETTINGS, lastTrackId: 'keep-me', lastPosition: 42 });
    expect(settings.lastTrackId).toBe('keep-me');
    expect(settings.lastPosition).toBe(42);
  });
});
