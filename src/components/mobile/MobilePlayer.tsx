import {
  ArrowDown24Regular,
  ArrowLeft24Regular,
  ArrowRight24Regular,
  ArrowUp24Regular,
} from '@fluentui/react-icons';
import { useRef, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { useLibraryStore } from '../../state/library';
import { useUiStore } from '../../state/ui';
import { CoverArt } from '../common/CoverArt';
import { AlbumLink, ArtistLinks } from '../common/CollectionLinks';
import { LyricsView } from '../nowplaying/LyricsView';
import { MobileDetailsSheet } from './MobileDetailsSheet';

interface MobilePlayerProps {
  onToggleFullscreen: () => void;
}

type Sheet = 'none' | 'lyrics' | 'details';

/**
 * Portrait phone shell. The cover page is the hub; swiping right/left/up/down
 * opens lyrics, details, queue and settings respectively.
 */
export function MobilePlayer({ onToggleFullscreen }: MobilePlayerProps): React.ReactElement | null {
  const { t } = useI18n();
  const track = useLibraryStore((state) => state.tracks.find((item) => item.id === state.currentId));
  const [sheet, setSheet] = useState<Sheet>('none');
  const start = useRef<{ x: number; y: number } | null>(null);

  if (!track) return null;

  const openQueue = (): void => useUiStore.getState().openQueue('full');
  const openSettings = (): void => useUiStore.getState().setSettingsOpen(true);

  const onTouchStart = (event: React.TouchEvent): void => {
    if (sheet !== 'none' || event.touches.length !== 1) return;
    start.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  };

  const onTouchEnd = (event: React.TouchEvent): void => {
    const from = start.current;
    start.current = null;
    if (!from || sheet !== 'none') return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - from.x;
    const dy = touch.clientY - from.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 54) return;
    if (Math.abs(dx) > Math.abs(dy) * 1.15) {
      setSheet(dx > 0 ? 'lyrics' : 'details');
    } else if (dy < 0) {
      openQueue();
    } else {
      openSettings();
    }
  };

  return (
    <section
      className="mobile-player"
      aria-label={t('mobile.home')}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="mobile-home">
        <header className="mobile-home-head">
          <div>
            <h1 className="np-title">{track.title}</h1>
            <p>
              <ArtistLinks artist={track.artist} />
              {track.album ? <><span className="mobile-dot" aria-hidden="true">·</span><AlbumLink album={track.album} /></> : null}
            </p>
          </div>
          <button
            type="button"
            className="mobile-cast-button"
            aria-label={t('mobile.details')}
            onClick={() => setSheet('details')}
          >
            {t('mobile.more')}
          </button>
        </header>

        <button type="button" className="mobile-cover" onClick={() => setSheet('details')} aria-label={t('np.viewArtwork')}>
          <CoverArt track={track} className="mobile-cover-art" alt={t('a11y.cover', { title: track.title })} eager showKind />
          <span className="mobile-cover-glow" aria-hidden="true" />
        </button>

        <div className="mobile-lyric-preview">
          <LyricsView />
        </div>

        <div className="mobile-swipe-hints" aria-hidden="true">
          <span><ArrowLeft24Regular />{t('mobile.swipeDetails')}</span>
          <span><ArrowRight24Regular />{t('mobile.swipeLyrics')}</span>
          <span><ArrowUp24Regular />{t('mobile.swipeQueue')}</span>
          <span><ArrowDown24Regular />{t('mobile.swipeSettings')}</span>
        </div>
      </div>

      {sheet === 'lyrics' ? (
        <section className="mobile-sheet mobile-lyrics-sheet" aria-label={t('np.lyrics')}>
          <header className="mobile-sheet-head">
            <button type="button" className="icon-button subtle" onClick={() => setSheet('none')} aria-label={t('common.back')}>
              <ArrowLeft24Regular />
            </button>
            <strong>{t('np.lyrics')}</strong>
            <span aria-hidden="true" />
          </header>
          <div className="mobile-sheet-track">
            <h2>{track.title}</h2>
            <p><ArtistLinks artist={track.artist} /></p>
          </div>
          <div className="mobile-sheet-lyrics">
            <LyricsView />
          </div>
        </section>
      ) : null}

      {sheet === 'details' ? (
        <MobileDetailsSheet
          onClose={() => setSheet('none')}
          onImmersive={() => {
            setSheet('none');
            onToggleFullscreen();
          }}
        />
      ) : null}
    </section>
  );
}
