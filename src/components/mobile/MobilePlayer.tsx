import {
  ArrowDown24Regular,
  ArrowLeft24Regular,
  ArrowRight24Regular,
  ArrowUp24Regular,
  ChevronDown24Regular,
  Info24Regular,
  MusicNote224Regular,
} from '@fluentui/react-icons';
import { useRef, useState } from 'react';
import { useDismiss } from '../../hooks/useDismiss';
import { useI18n } from '../../i18n/I18nProvider';
import { useLibraryStore } from '../../state/library';
import { useUiStore } from '../../state/ui';
import { CoverArt } from '../common/CoverArt';
import { AlbumLink, ArtistLinks } from '../common/CollectionLinks';
import { ScrollText } from '../common/ScrollText';
import { ArtworkLightbox } from '../nowplaying/ArtworkLightbox';
import { BlurredBackdrop } from '../common/BlurredBackdrop';
import { highResolutionCover } from '../../lib/cover';
import { AudioVisualizer } from '../nowplaying/AudioVisualizer';
import { LyricsView } from '../nowplaying/LyricsView';
import { MobileDetailsSheet } from './MobileDetailsSheet';

interface MobilePlayerProps {
  onToggleFullscreen: () => void;
}

type Sheet = 'none' | 'lyrics' | 'details';
type DragTarget = 'lyrics' | 'details' | 'queue' | 'settings';

interface DragState {
  dx: number;
  dy: number;
  target: DragTarget;
}

const SWIPE_THRESHOLD = 64;
const MAX_DRAG = 230;

/**
 * Portrait phone shell. The cover page is the hub; swiping left/right/up/down
 * opens lyrics, details, queue and settings respectively.
 */
export function MobilePlayer({ onToggleFullscreen }: MobilePlayerProps): React.ReactElement | null {
  const { t } = useI18n();
  const track = useLibraryStore((state) => state.tracks.find((item) => item.id === state.currentId));
  const [sheet, setSheet] = useState<Sheet>('none');
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragging, setDragging] = useState(false);
  const [techOpen, setTechOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const lyricBackStart = useRef<{ x: number; y: number } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fromLyrics = useRef(false);
  const techRef = useRef<HTMLDivElement>(null);
  useDismiss(techRef, () => setTechOpen(false), techOpen);

  if (!track) return null;

  const openQueue = (): void => useUiStore.getState().openQueue('full');
  const openSettings = (): void => useUiStore.getState().setSettingsOpen(true);

  const onTouchStart = (event: React.TouchEvent): void => {
    if (sheet !== 'none' || techOpen || lightboxOpen || event.touches.length !== 1) return;
    // Vertical swipes over the lyric preview scroll lyrics instead of opening
    // a different page. Horizontal swipes can still navigate.
    fromLyrics.current = Boolean((event.target as HTMLElement).closest('.mobile-lyric-preview'));
    start.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  };

  const onTouchMove = (event: React.TouchEvent): void => {
    const from = start.current;
    if (!from || sheet !== 'none' || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const dx = touch.clientX - from.x;
    const dy = touch.clientY - from.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
    if (fromLyrics.current && Math.abs(dy) >= Math.abs(dx)) {
      start.current = null;
      fromLyrics.current = false;
      return;
    }
    const horizontal = Math.abs(dx) > Math.abs(dy) * 1.12;
    const target: DragTarget = horizontal
      ? (dx > 0 ? 'details' : 'lyrics')
      : (dy < 0 ? 'queue' : 'settings');
    if (horizontal) event.preventDefault();
    setDragging(true);
    setDrag({
      dx: Math.max(-MAX_DRAG, Math.min(MAX_DRAG, dx * 0.72)),
      dy: Math.max(-MAX_DRAG, Math.min(MAX_DRAG, dy * 0.72)),
      target,
    });
  };

  const onTouchEnd = (event: React.TouchEvent): void => {
    const from = start.current;
    const current = drag;
    start.current = null;
    fromLyrics.current = false;
    setDragging(false);
    setDrag(null);
    if (!from || !current || sheet !== 'none') return;
    const touch = event.changedTouches[0];
    const dx = touch ? touch.clientX - from.x : current.dx;
    const dy = touch ? touch.clientY - from.y : current.dy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return;
    if (current.target === 'lyrics') setSheet('lyrics');
    else if (current.target === 'details') setSheet('details');
    else if (current.target === 'queue') openQueue();
    else openSettings();
  };

  const onLyricBackStart = (event: React.TouchEvent): void => {
    if (event.touches.length !== 1) return;
    lyricBackStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  };

  const onLyricBackEnd = (event: React.TouchEvent): void => {
    const from = lyricBackStart.current;
    lyricBackStart.current = null;
    if (!from) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - from.x;
    const dy = touch.clientY - from.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 60 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    // Lyrics were entered with a left swipe, so the opposite swipe goes back.
    if (dx > 0) setSheet('none');
  };

  const targetLabel = drag ? t(`mobile.swipe${drag.target[0].toUpperCase()}${drag.target.slice(1)}`) : '';
  const progress = drag ? Math.min(1, Math.max(Math.abs(drag.dx), Math.abs(drag.dy)) / 220) : 0;
  const tech = [
    { label: t('np.sampleRate'), value: track.sampleRate ? `${(track.sampleRate / 1000).toFixed(track.sampleRate % 1000 === 0 ? 0 : 1)} kHz` : '—' },
    { label: t('np.bitDepth'), value: track.bitDepth ? `${track.bitDepth}-bit` : '—' },
    { label: t('np.bitrate'), value: track.bitrate ? `${Math.round(track.bitrate / 1000)} kbps` : '—' },
    { label: t('np.format'), value: track.format ?? '—' },
  ];

  return (
    <section
      className={`mobile-player ${dragging ? 'is-dragging' : ''} ${drag ? `drag-${drag.target}` : ''}`.trim()}
      aria-label={t('mobile.home')}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <AudioVisualizer />

      {drag ? (
        <div className={`mobile-swipe-preview is-${drag.target}`} style={{ opacity: 0.25 + progress * 0.75 }} aria-hidden="true">
          <span className="mobile-swipe-preview-icon">
            {drag.target === 'queue' ? <ArrowUp24Regular /> : drag.target === 'settings' ? <ArrowDown24Regular /> : drag.target === 'lyrics' ? <ArrowLeft24Regular /> : <ArrowRight24Regular />}
          </span>
          <strong>{targetLabel}</strong>
        </div>
      ) : null}

      <div
        className="mobile-home"
        style={drag ? {
          transform: `translate3d(${drag.dx * 0.42}px, ${drag.dy * 0.42}px, 0) scale(${1 - progress * 0.025})`,
          opacity: 1 - progress * 0.12,
        } : undefined}
      >
        <header className="mobile-home-head">
          <div>
            <h1 className="np-title"><ScrollText text={track.title} /></h1>
            <p>
              <ArtistLinks artist={track.artist} />
              {track.album ? <><span className="mobile-dot" aria-hidden="true">·</span><AlbumLink album={track.album} /></> : null}
            </p>
          </div>
          <div className="mobile-head-actions" ref={techRef}>
            <button
              type="button"
              className={`mobile-tech-toggle ${techOpen ? 'is-open' : ''}`.trim()}
              aria-label={t('mobile.audioOptions')}
              aria-expanded={techOpen}
              onClick={() => setTechOpen((value) => !value)}
            >
              <ChevronDown24Regular />
            </button>
            {techOpen ? (
              <div className="mobile-tech-popover">
                <span className="mobile-tech-heading">{t('mobile.audioParams')}</span>
                <div className="mobile-tech-grid">
                  {tech.map((item) => (
                    <div key={item.label} className="mobile-tech-item">
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
                <div className="mobile-tech-actions">
                  <button type="button" onClick={() => { setTechOpen(false); useUiStore.getState().setDetailsTrackId(track.id); }}>
                    <Info24Regular /> {t('np.trackInfo')}
                  </button>
                  <button type="button" onClick={() => { setTechOpen(false); setSheet('details'); }}>
                    <MusicNote224Regular /> {t('mobile.details')}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </header>

        <button type="button" className="mobile-cover" onClick={() => setLightboxOpen(true)} aria-label={t('np.viewArtwork')}>
          <CoverArt track={track} className="mobile-cover-art" alt={t('a11y.cover', { title: track.title })} eager showKind />
          <span className="mobile-cover-glow" aria-hidden="true" />
        </button>

        <div className="mobile-lyric-preview">
          <LyricsView />
        </div>

        <div className="mobile-swipe-hints" aria-hidden="true">
          <span><ArrowLeft24Regular />{t('mobile.swipeLyrics')}</span>
          <span><ArrowRight24Regular />{t('mobile.swipeDetails')}</span>
          <span><ArrowUp24Regular />{t('mobile.swipeQueue')}</span>
          <span><ArrowDown24Regular />{t('mobile.swipeSettings')}</span>
        </div>
      </div>

      {lightboxOpen ? (
        <ArtworkLightbox
          track={track}
          source={highResolutionCover(track.cover)}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}

      {sheet === 'lyrics' ? (
        <section
          className="mobile-sheet mobile-lyrics-sheet"
          aria-label={t('np.lyrics')}
          onTouchStart={onLyricBackStart}
          onTouchEnd={onLyricBackEnd}
          onTouchCancel={() => { lyricBackStart.current = null; }}
        >
          <BlurredBackdrop cover={track.cover} />
          <header className="mobile-sheet-head">
            <button type="button" className="icon-button subtle" onClick={() => setSheet('none')} aria-label={t('common.back')}>
              <ArrowLeft24Regular />
            </button>
            <strong>{t('np.lyrics')}</strong>
            <span aria-hidden="true" />
          </header>
          <div className="mobile-sheet-track">
            <h2><ScrollText text={track.title} /></h2>
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
          onSwipeBack={() => setSheet('none')}
          onImmersive={() => {
            setSheet('none');
            onToggleFullscreen();
          }}
        />
      ) : null}
    </section>
  );
}
