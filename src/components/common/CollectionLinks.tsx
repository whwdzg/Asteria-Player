import { Fragment } from 'react';
import { parseArtists } from '../../lib/artists';
import { useI18n } from '../../i18n/I18nProvider';
import { useUiStore } from '../../state/ui';

interface ArtistLinksProps {
  artist?: string;
  fallback?: string;
  className?: string;
}

/** Renders each co-artist as its own link, with separators normalised to " / ". */
export function ArtistLinks({ artist, fallback, className = '' }: ArtistLinksProps): React.ReactElement {
  const { t } = useI18n();
  const openCollection = useUiStore((state) => state.openCollection);
  const artists = parseArtists(artist);
  if (!artists.length) {
    return <span className={className}>{fallback ?? t('common.unknownArtist')}</span>;
  }
  return (
    <span className={`artist-links ${className}`.trim()}>
      {artists.map((name, index) => (
        <Fragment key={`${name}-${index}`}>
          {index > 0 ? <span className="artist-separator" aria-hidden="true"> / </span> : null}
          <button
            type="button"
            className="artist-link"
            onClick={(event) => {
              event.stopPropagation();
              openCollection('artist', name);
            }}
          >
            {name}
          </button>
        </Fragment>
      ))}
    </span>
  );
}

interface AlbumLinkProps {
  album?: string;
  fallback?: string;
  className?: string;
}

export function AlbumLink({ album, fallback, className = '' }: AlbumLinkProps): React.ReactElement {
  const { t } = useI18n();
  const openCollection = useUiStore((state) => state.openCollection);
  if (!album?.trim()) {
    return <span className={className}>{fallback ?? t('common.unknownAlbum')}</span>;
  }
  return (
    <button
      type="button"
      className={`album-link ${className}`.trim()}
      onClick={(event) => {
        event.stopPropagation();
        openCollection('album', album);
      }}
    >
      {album}
    </button>
  );
}
