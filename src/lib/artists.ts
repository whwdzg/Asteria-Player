import type { Track } from './types';

/** Semicolon, comma and 顿号 all separate co-artists in imported tags. */
const ARTIST_SEPARATOR = /[;,、；，]/;

export function parseArtists(value: string | undefined): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  const artists: string[] = [];
  for (const part of value.split(ARTIST_SEPARATOR)) {
    const name = part.trim();
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    artists.push(name);
  }
  return artists;
}

/** Display form for the raw artist tag: separators become a spaced slash. */
export function displayArtists(value: string | undefined): string {
  return parseArtists(value).join(' / ');
}

export function trackHasArtist(track: Track, artist: string): boolean {
  const key = artist.trim().toLocaleLowerCase();
  return parseArtists(track.artist).some((name) => name.toLocaleLowerCase() === key);
}

export function albumKey(album: string | undefined): string {
  return (album ?? '').trim().toLocaleLowerCase();
}

export interface AlbumSummary {
  name: string;
  tracks: Track[];
  cover?: string;
}

/** Unique albums represented by the supplied tracks, preserving the first cover. */
export function albumsFromTracks(tracks: Track[]): AlbumSummary[] {
  const map = new Map<string, AlbumSummary>();
  for (const track of tracks) {
    if (!track.album?.trim()) continue;
    const key = albumKey(track.album);
    const existing = map.get(key);
    if (existing) {
      existing.tracks.push(track);
      if (!existing.cover && track.cover) existing.cover = track.cover;
    } else {
      map.set(key, { name: track.album.trim(), tracks: [track], cover: track.cover });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function tracksForArtist(tracks: Track[], artist: string): Track[] {
  return tracks.filter((track) => trackHasArtist(track, artist));
}

export function tracksForAlbum(tracks: Track[], album: string): Track[] {
  const key = albumKey(album);
  return tracks.filter((track) => albumKey(track.album) === key);
}

export interface AlbumEntry {
  track: Track;
  disc: number;
  number: number;
}

/**
 * Sort an album by disc/track. Missing numbers are filled from the current
 * order so imported or demo albums without tag numbers still show useful
 * "disc · track" labels.
 */
export function orderAlbumTracks(tracks: Track[]): AlbumEntry[] {
  const sorted = [...tracks].sort((a, b) => {
    const disc = (a.discNumber ?? 1) - (b.discNumber ?? 1);
    if (disc !== 0) return disc;
    const track = (a.trackNumber ?? Number.MAX_SAFE_INTEGER) - (b.trackNumber ?? Number.MAX_SAFE_INTEGER);
    if (track !== 0) return track;
    return a.title.localeCompare(b.title);
  });
  const counters = new Map<number, number>();
  return sorted.map((track) => {
    const disc = track.discNumber ?? 1;
    const next = (counters.get(disc) ?? 0) + 1;
    counters.set(disc, next);
    return { track, disc, number: track.trackNumber ?? next };
  });
}
