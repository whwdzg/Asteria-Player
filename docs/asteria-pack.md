# Asteria Player Pack (.astpp)

`.astpp` is an Asteria Player Pack. It is a standard ZIP archive with the `.astpp`
extension, containing one playlist and the selected source media.

## Archive layout

```text
manifest.json
media/001-track-id.mp3
media/002-other-track.flac
covers/001-track-id.webp
```

Media files are stored without recompression because audio and video are already
compressed. Cover images and source lyrics/subtitles/danmaku are included when
available.

## manifest.json

```json
{
  "format": "asteria-player-pack",
  "version": 1,
  "exportedAt": 1794934802490,
  "playlist": {
    "name": "All · 2026-11-18",
    "trackIds": ["track-id"]
  },
  "tracks": [
    {
      "id": "track-id",
      "kind": "audio",
      "title": "Track title",
      "artist": "Artist",
      "album": "Album",
      "duration": 78,
      "format": "FLAC",
      "media": "media/001-track-id.flac",
      "coverFile": "covers/001-track-id.webp",
      "lyrics": "[00:01.00]First line\n..."
    }
  ]
}
```

## Export

Open the play queue, choose **Export .astpp**, select a playback sequence and
the media to include, then export. Media, covers and inline sidecar text are
written into the archive; the playlist is restored when the pack is imported.

## Import

Use **Import files** (or drop the file onto the player) and select an `.astpp`
file. The player validates `manifest.json`, creates fresh library entries,
restores the playlist and makes the imported sequence active.

The pack format is intentionally data-only: importing never executes code from
the archive.
