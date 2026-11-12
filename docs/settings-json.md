# Settings JSON format

Asteria Player stores every user preference as JSON. The shipped defaults live
in [`src/config/default-settings.json`](../src/config/default-settings.json);
the same document shape is used by the in-app JSON editor and by file
import/export.

## Where to find it

- Defaults: `src/config/default-settings.json`
- Current settings: **Settings → Data & backup → Open JSON editor**
- Persisted copy: `localStorage["asteria-settings"]` (managed by Zustand)

The in-app editor shows the current values, not the file defaults. Applying the
editor replaces the current settings immediately and writes them to
`localStorage`. "Insert defaults" only fills the editor; it does not apply until
you choose **Apply JSON**.

## Document shape

```json
{
  "version": 1,
  "settings": {
    "theme": "system",
    "language": "zh-CN",
    "volume": 0.8,
    "shortcuts": {
      "playPause": {
        "code": "Space",
        "ctrl": false,
        "alt": false,
        "shift": false,
        "meta": false
      }
    }
  }
}
```

`version` is optional on import. A bare settings object is also accepted:

```json
{ "theme": "light", "volume": 0.55 }
```

Missing fields inherit their normal defaults. Unknown fields are ignored, which
keeps older and newer files interoperable.

## Fields

| Group | Keys |
| --- | --- |
| Appearance | `theme`, `language`, `liquidGlass`, `dynamicBackground`, `backgroundBpm`, `backgroundVideo`, `reduceMotion` |
| Lyrics | `lyricSize`, `lyricWeight`, `lyricTranslationSize`, `lyricBlur`, `lyricFont`, `showTranslation` |
| Video | `subtitleLang`, `subtitleBgOpacity`, `subtitleTextOpacity`, `subtitleFont`, `danmakuEnabled`, `danmakuTop`, `danmakuScroll`, `danmakuWeight`, `danmakuSize` (12–48 px), `danmakuArea`, `danmakuOpacity`, `danmakuSpeed`, `danmakuFont`; `fullscreenClock`, `fullscreenClockHours`, `fullscreenClockSeconds`, `fullscreenClockDate`, `mirrorVideo`, `colorVisionAssist`, `videoFit` |
| Playback | `volume` (0–1.2), `brightness` (0–1), `muted`, `playMode`, `playbackRate` (0.25–4), `eqEnabled`, `eqGains` (five numbers, −12–12), `autoPlayNext` |
| Online | `bilibiliProxy` — optional Bilibili CORS proxy prefix or `{url}` template; `danmuApiBase` — optional self-hosted open-source danmu_api root URL |
| Shortcuts | `shortcuts` — one entry per action, or `null` to disable |

### Enumerations

- `theme`: `dark`, `light`, `system`
- `language`: `system`, a language-pack code such as `zh-CN`, or an imported code
- `playMode`: `one`, `all`, `none`, `shuffle`
- `danmakuArea`: `quarter`, `half`, `threeQuarter`, `full`
- `videoFit`: `contain`, `cover`, `fill`
- `lyricFont` / `subtitleFont` / `danmakuFont`: `display`, `sans`, `serif`,
  `rounded`, `mono`

### Shortcuts

Each shortcut has a `KeyboardEvent.code`, plus the four modifier flags:

```json
{
  "code": "KeyF",
  "ctrl": false,
  "alt": false,
  "shift": false,
  "meta": false
}
```

Use `null` to leave an action unbound. Invalid or duplicate values are
normalised on import; assigning the same key to two actions in the UI clears
the older binding.

## Validation and safety

- Numeric fields are clamped to the ranges shown above.
- Enum values outside the documented list fall back to the current/default value.
- `eqGains` must contain exactly five entries; otherwise defaults are used.
- Session state (`lastTrackId`, `lastPosition`) is intentionally excluded from
  exported files. It is preserved when the persisted store is restored.
- Import never executes code. JSON is parsed as data and only known fields are
  copied into the settings store.

## Import / export

1. Open **Settings → Data & backup**.
2. Choose **Open JSON editor**.
3. Edit, **Import file**, **Download file**, **Copy JSON**, or **Insert defaults**.
4. Choose **Apply JSON** to commit the draft.

The download is named `asteria-settings.json`. A file can also be dropped into
the editor with the import button; it is previewed first and only applied when
you confirm.

## Defaults file

`src/config/default-settings.json` is the single source of the shipped defaults.
Changing it requires a rebuild (`npm run build`) because it is bundled into the
application. Existing users keep their persisted values until they reset or
import another document.
