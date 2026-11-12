import { describe, expect, it } from 'vitest';
import type { Track } from './types';
import {
  albumsFromTracks,
  displayArtists,
  orderAlbumTracks,
  parseArtists,
  tracksForAlbum,
  tracksForArtist,
} from './artists';

function track(partial: Partial<Track> & Pick<Track, 'id' | 'title'>): Track {
  return {
    kind: 'audio',
    artist: '',
    src: `memory://${partial.id}`,
    duration: 60,
    source: 'local',
    ...partial,
  };
}

describe('artist and album grouping', () => {
  it('splits semicolons, commas and 顿号 and normalises the display separator', () => {
    expect(parseArtists('Alice; Bob、Carol, Dave；Eve，Frank')).toEqual([
      'Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank',
    ]);
    expect(parseArtists('Alice; alice ; Bob')).toEqual(['Alice', 'Bob']);
    expect(parseArtists('Alice / Bob \\ Carol')).toEqual(['Alice', 'Bob', 'Carol']);
    expect(parseArtists('Alice feat. Bob')).toEqual(['Alice', 'Bob']);
    expect(parseArtists('Alice FEAT Bob、Carol')).toEqual(['Alice', 'Bob', 'Carol']);
    expect(parseArtists('Defeat Artist')).toEqual(['Defeat Artist']);
    expect(displayArtists('Alice; Bob、Carol')).toBe('Alice / Bob / Carol');
    expect(displayArtists('Alice feat. Bob / Carol')).toBe('Alice / Bob / Carol');
    expect(parseArtists('')).toEqual([]);
  });

  it('groups songs by exact album and finds all co-artist appearances', () => {
    const tracks = [
      track({ id: '1', title: 'One', artist: 'Alice; Bob', album: 'Record' }),
      track({ id: '2', title: 'Two', artist: 'Alice', album: 'Record' }),
      track({ id: '3', title: 'Three', artist: 'Bob', album: 'Other' }),
      track({ id: '4', title: 'Four', artist: 'Carol', album: 'Record' }),
    ];
    expect(tracksForArtist(tracks, 'Bob').map((item) => item.id)).toEqual(['1', '3']);
    expect(tracksForAlbum(tracks, 'record').map((item) => item.id)).toEqual(['1', '2', '4']);
    expect(albumsFromTracks(tracks).map((album) => [album.name, album.tracks.length])).toEqual([
      ['Other', 1],
      ['Record', 3],
    ]);
  });

  it('orders disc/track numbers and fills missing values from album order', () => {
    const tracks = [
      track({ id: 'b', title: 'B', album: 'Record', discNumber: 1, trackNumber: 2 }),
      track({ id: 'a', title: 'A', album: 'Record', discNumber: 1, trackNumber: 1 }),
      track({ id: 'c', title: 'C', album: 'Record', discNumber: 2 }),
    ];
    expect(orderAlbumTracks(tracks).map(({ track: item, disc, number }) => [
      item.id, disc, number,
    ])).toEqual([
      ['a', 1, 1],
      ['b', 1, 2],
      ['c', 2, 1],
    ]);
  });
});
