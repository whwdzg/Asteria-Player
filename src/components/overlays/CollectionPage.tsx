import '../../styles/collection.css';
import { ArrowLeft24Regular, ArrowShuffle24Regular, ChevronDown24Regular, Play24Filled } from '@fluentui/react-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Track } from '../../lib/types';
import {
  albumsFromTracks,
  orderAlbumTracks,
  parseArtists,
  tracksForAlbum,
  tracksForArtist,
} from '../../lib/artists';
import { formatDuration } from '../../lib/format';
import { useI18n } from '../../i18n/I18nProvider';
import { useLibraryStore } from '../../state/library';
import { useUiStore } from '../../state/ui';
import { player } from '../../player/engine';
import { ArtistLinks, AlbumLink } from '../common/CollectionLinks';
import { Menu, type MenuAnchor } from '../common/Menu';
import { CoverArt } from '../common/CoverArt';
import { ScrollText } from '../common/ScrollText';
import { BlurredBackdrop } from '../common/BlurredBackdrop';

function TrackRow({ track, entry }: { track: Track; entry?: { disc: number; number: number } }): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="collection-track">
      <span className="collection-track-index">
        {entry ? `${entry.disc} · ${String(entry.number).padStart(2, '0')}` : '—'}
      </span>
      <div className="collection-track-copy">
        <span className="collection-track-title" title={track.title}>{track.title}</span>
        <span className="collection-track-meta">
          {track.kind === 'audio'
            ? <ArtistLinks artist={track.artist} />
            : <span>{track.artist || t('common.unknownArtist')}</span>}
          {track.album ? <><span className="artist-separator" aria-hidden="true"> / </span><AlbumLink album={track.album} /></> : null}
        </span>
      </div>
      <span className="collection-track-duration">{formatDuration(track.duration)}</span>
      <button
        type="button"
        className="icon-button subtle size-sm collection-play"
        aria-label={t('player.play')}
        onClick={() => player.playTrack(track.id)}
      >
        <Play24Filled />
      </button>
    </div>
  );
}

export function CollectionPage(): React.ReactElement | null {
  const view = useUiStore((state) => state.collectionView);
  const close = useUiStore((state) => state.closeCollection);
  const openCollection = useUiStore((state) => state.openCollection);
  const tracks = useLibraryStore((state) => state.tracks);
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [allMenu, setAllMenu] = useState<MenuAnchor | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [view?.kind, view?.name]);

  const data = useMemo(() => {
    if (!view) return null;
    if (view.kind === 'artist') {
      const artistTracks = tracksForArtist(tracks, view.name);
      const albums = albumsFromTracks(artistTracks).map((album) => {
        const all = tracksForAlbum(tracks, album.name);
        return {
          ...album,
          tracks: all,
          cover: all.find((track) => track.cover)?.cover ?? album.cover,
        };
      });
      return {
        kind: 'artist' as const,
        title: view.name,
        tracks: artistTracks,
        albums,
        cover: artistTracks.find((track) => track.cover)?.cover,
      };
    }
    const albumTracks = tracksForAlbum(tracks, view.name);
    return {
      kind: 'album' as const,
      title: view.name,
      tracks: albumTracks,
      entries: orderAlbumTracks(albumTracks),
      cover: albumTracks.find((track) => track.cover)?.cover,
      artists: [...new Set(albumTracks.flatMap((track) => parseArtists(track.artist)))],
    };
  }, [tracks, view]);

  if (!view || !data) return null;

  const playAll = (shuffle = false): void => {
    const ids = data.tracks.map((track) => track.id);
    if (!ids.length) return;
    if (shuffle) {
      for (let index = ids.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(Math.random() * (index + 1));
        [ids[index], ids[swap]] = [ids[swap], ids[index]];
      }
    }
    const playlist = useLibraryStore.getState().addPlaylist(
      t('collection.playAllName', { name: data.title }),
      ids,
    );
    useLibraryStore.getState().setSequence(playlist.id);
    player.playTrack(ids[0]);
    useUiStore.getState().pushToast(t('collection.playAllCreated', { count: ids.length }));
    setAllMenu(null);
  };

  const artistMeta = data.kind === 'artist'
    ? `${t('collection.songCount', { count: data.tracks.length })} · ${t('collection.albumCount', { count: data.albums.length })}`
    : t('collection.songCount', { count: data.tracks.length });

  return (
    <section className="collection-page" aria-label={t('collection.page')}>
      <BlurredBackdrop cover={data.cover} />
      <div className="collection-scroll" ref={scrollRef}>
        <header className="collection-header">
          <button type="button" className="fluent-button" onClick={close}>
            <ArrowLeft24Regular /> {t('common.back')}
          </button>
          <div className="collection-play-all">
            <button type="button" className="fluent-button primary" onClick={() => playAll()} disabled={!data.tracks.length}>
              <Play24Filled /> {t('collection.playAll')}
            </button>
            <button
              type="button"
              className="fluent-button primary collection-play-more"
              aria-label={t('collection.playAllOptions')}
              aria-haspopup="menu"
              aria-expanded={Boolean(allMenu)}
              disabled={!data.tracks.length}
              onClick={(event) => setAllMenu({ rect: event.currentTarget.getBoundingClientRect(), element: event.currentTarget })}
            >
              <ChevronDown24Regular />
            </button>
          </div>
        </header>

        <div className="collection-hero">
          <div className="collection-artwork">
            {data.cover && data.tracks[0] ? (
              <CoverArt
                track={{ ...data.tracks[0], cover: data.cover }}
                className="collection-cover"
                alt={data.title}
                eager
              />
            ) : (
              <div className="collection-cover collection-cover-empty" aria-hidden="true">
                {data.kind === 'artist' ? data.title.slice(0, 1) : 'A'}
              </div>
            )}
          </div>
          <div className="collection-heading">
            <span className="soft-badge">{data.kind === 'artist' ? t('collection.artist') : t('collection.album')}</span>
            <h1><ScrollText text={data.title} /></h1>
            <p>{artistMeta}</p>
            {data.kind === 'album' ? (
              <p className="collection-artists">
                <ArtistLinks artist={data.artists.join(';')} />
              </p>
            ) : (
              <p className="collection-artists">{t('collection.artistHint')}</p>
            )}
          </div>
        </div>

        {data.kind === 'artist' && data.albums.length ? (
          <section className="collection-section">
            <div className="collection-section-heading">
              <h2>{t('collection.albums')}</h2>
              <span>{data.albums.length}</span>
            </div>
            <div className="collection-albums">
              {data.albums.map((album) => (
                <button
                  key={album.name}
                  type="button"
                  className="collection-album-card"
                  onClick={() => openCollection('album', album.name)}
                >
                  <div className="collection-album-art">
                    {album.cover && album.tracks[0] ? (
                      <CoverArt
                        track={{ ...album.tracks[0], cover: album.cover }}
                        className="collection-album-cover"
                        alt={album.name}
                      />
                    ) : <div className="collection-album-cover collection-cover-empty">A</div>}
                  </div>
                  <strong>{album.name}</strong>
                  <span>{t('collection.songCount', { count: album.tracks.length })}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="collection-section">
          <div className="collection-section-heading">
            <h2>{data.kind === 'artist' ? t('collection.songs') : t('collection.tracklist')}</h2>
            <span>{data.tracks.length}</span>
          </div>
          {data.kind === 'artist' ? (
            <div className="collection-tracks">
              {data.tracks.map((track) => <TrackRow key={track.id} track={track} />)}
            </div>
          ) : (
            [...new Set(data.entries.map((entry) => entry.disc))].map((disc) => (
              <div className="collection-disc" key={disc}>
                <h3>{t('collection.disc', { disc })}</h3>
                <div className="collection-tracks">
                  {data.entries
                    .filter((entry) => entry.disc === disc)
                    .map((entry) => (
                      <TrackRow
                        key={entry.track.id}
                        track={entry.track}
                        entry={{ disc: entry.disc, number: entry.number }}
                      />
                    ))}
                </div>
              </div>
            ))
          )}
          {!data.tracks.length ? <p className="collection-empty">{t('collection.empty')}</p> : null}
        </section>
      </div>
      <Menu
        open={Boolean(allMenu)}
        anchor={allMenu}
        label={t('collection.playAllOptions')}
        onClose={() => setAllMenu(null)}
        items={[{
          id: 'shuffle',
          label: t('collection.playAllShuffle'),
          icon: <ArrowShuffle24Regular />,
          onSelect: () => playAll(true),
        }]}
      />
    </section>
  );
}
