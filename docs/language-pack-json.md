# Language pack JSON format

Language packs are external JSON dictionaries. Built-in packs live in
`public/locales/` and are listed by `public/locales/manifest.json`; additional
packs can be imported at runtime from **Settings → Appearance → Import language
pack**.

## Document shape

```json
{
  "version": 1,
  "code": "ja",
  "label": "日本語",
  "nativeLabel": "日本語",
  "translations": {
    "app.name": "Asteria",
    "app.tagline": "音楽と映像を、光の中へ。",
    "settings.title": "設定",
    "settings.theme": "テーマ",
    "player.play": "再生"
  }
}
```

A `{ "pack": { ... } }` wrapper is also accepted for future compatibility.

A bare dictionary such as the built-in `public/locales/en.json` is accepted too. In that case the filename supplies the language code (`ja.json` → `ja`), and the label defaults to the upper-cased code.

## Fields

| Field | Required | Description |
| --- | --- | --- |
| `version` | no | Format version. Currently `1`. |
| `code` | yes | BCP-47-like code: `ja`, `ko`, `pt-BR`. Pattern: `^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$`. |
| `label` | yes | Display name used in the language dropdown. |
| `nativeLabel` | no | Native-language label; shown when present. |
| `translations` | yes* | Flat object of string keys to translated strings. At least one entry. Alternatively use a bare dictionary and name the file with the language code. |

Keys are the same dotted keys used by the application, for example
`player.play`, `settings.language` or `match.title`. Values must be strings.
Non-string values and empty keys are ignored.

## Partial packs and fallback

A pack does not have to be complete. Missing keys fall back to English, then to
the key name itself. This makes it practical to translate the interface
incrementally. For a release-quality pack, copy `public/locales/en.json` and
translate all values.

Placeholders use braces and must be preserved:

```json
{
  "common.count": "{count} items",
  "toast.imported": "Imported {count} items"
}
```

## Importing

1. Open **Settings → Appearance**.
2. Choose **Import language pack**.
3. Select a `.json` file matching the shape above.
4. The pack is validated, registered in the language dropdown, persisted in
   `localStorage["asteria-language-packs"]`, and selected immediately.

The imported pack survives a reload. Importing the same `code` again replaces
the previous version. Built-in codes can be overridden by an imported pack; the
imported entry wins in the dropdown.

## Installing as a built-in pack

To ship a pack with the application instead of importing it:

1. Add `public/locales/<code>.json` using this format (the file itself is the
   dictionary, without the wrapper).
2. Add an entry to `public/locales/manifest.json`:

```json
{
  "code": "ja",
  "label": "日本語",
  "nativeLabel": "日本語",
  "file": "ja.json"
}
```

The I18n provider fetches packs at runtime, so no application rebuild is needed
when deploying a new locale file and manifest.

## Safety

- The parser accepts only string values in `translations`; there is no HTML
  injection or code execution.
- `code` is restricted to a small, safe character set.
- Imported packs are stored under a separate localStorage key, not inside the
  settings document.
- Very large dictionaries can exceed localStorage quota; the import then works
  for the current session but may not survive a reload.

See [settings-json.md](./settings-json.md) for the other JSON format used by the
player.
