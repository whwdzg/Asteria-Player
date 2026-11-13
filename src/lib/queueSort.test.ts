import { describe, expect, it } from 'vitest';
import type { Track } from './types';
import { sortQueueTracks } from './queueSort';

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

const tracks = [
  track({ id: 'b', title: 'Beta', artist: 'Zed', album: 'Second', addedAt: 200 }),
  track({ id: 'a', title: 'Alpha', artist: 'Amy', album: 'Third', addedAt: 100 }),
  track({ id: 'c', title: 'Gamma', artist: 'Amy', album: 'First', addedAt: 300 }),
];

describe('queue sorting', () => {
  it('sorts by title by default', () => {
    expect(sortQueueTracks(tracks, 'title').map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by added time, album and artist with title tie-breaks', () => {
    expect(sortQueueTracks(tracks, 'added').map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(sortQueueTracks(tracks, 'album').map((item) => item.id)).toEqual(['c', 'b', 'a']);
    expect(sortQueueTracks(tracks, 'artist').map((item) => item.id)).toEqual(['a', 'c', 'b']);
  });
});
