import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MusicNote224Regular, Translate24Regular } from '@fluentui/react-icons';
import type { LyricLine, LyricsDocument } from '../../lib/types';
import { findActiveLineIndex, getWordProgress } from '../../lib/lyrics';
import { resolveLyrics } from '../../lib/media';
import { useClockStore } from '../../state/clock';
import { useLibraryStore } from '../../state/library';
import { useSettingsStore } from '../../state/settings';
import { player } from '../../player/engine';
import { useI18n } from '../../i18n/I18nProvider';
import { formatTime } from '../../lib/format';

interface LyricLineProps {
  line: LyricLine;
  index: number;
  active: boolean;
  past: boolean;
  next: boolean;
  time: number;
  showTranslation: boolean;
  onClick: (line: LyricLine) => void;
  setRef: (index: number, element: HTMLButtonElement | null) => void;
}

const LyricLineItem = memo(function LyricLineItem({
  line,
  index,
  active,
  past,
  next,
  time,
  showTranslation,
  onClick,
  setRef,
}: LyricLineProps): React.ReactElement {
  const words = active ? getWordProgress(line, time) : null;
  return (
    <button
      type="button"
      ref={(element) => setRef(index, element)}
      className={`lyric-line ${active ? 'is-active' : ''} ${past ? 'is-past' : ''} ${next ? 'is-next' : ''}`.trim()}
      aria-current={active ? 'true' : undefined}
      onClick={() => onClick(line)}
      data-line-index={index}
    >
      <span className="lyric-text">
        {words
          ? words.map((word, wordIndex) => (
              <span
                // Word chunks are stable for the lifetime of a parsed line.
                key={wordIndex}
                className={`lyric-word is-${word.state}`}
              >
                {word.state === 'active' ? (
                  <span
                    className="lyric-word-fill"
                    style={{ backgroundSize: `${Math.max(0, Math.min(100, word.progress * 100))}% 100%` }}
                  >
                    {word.text}
                  </span>
                ) : word.text}
              </span>
            ))
          : line.text}
      </span>
      {showTranslation && line.translation ? (
        <span className="lyric-translation">{line.translation}</span>
      ) : null}
    </button>
  );
});

export function LyricsView(): React.ReactElement {
  const track = useLibraryStore((state) => state.tracks.find((item) => item.id === state.currentId));
  const settings = useSettingsStore();
  const time = useClockStore((state) => state.time);
  const { t } = useI18n();
  const [document, setDocument] = useState<LyricsDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const viewportRef = useRef<HTMLDivElement>(null);
  const lineElements = useRef(new Map<number, HTMLButtonElement>());
  const manualUntil = useRef(0);
  const manualTimer = useRef(0);
  const scrollToActiveRef = useRef<(behavior?: ScrollBehavior) => void>(() => {});

  useEffect(() => {
    if (!track) {
      setDocument(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    resolveLyrics(track, track.duration)
      .then((result) => {
        if (cancelled) return;
        setDocument(result);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setDocument(null);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [track?.id, track?.lyrics, track?.embeddedLyrics, track?.lyricsUrl, track?.translation, track?.duration]);

  useEffect(() => {
    manualUntil.current = 0;
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollTop = 0;
  }, [track?.id]);

  const activeIndex = useMemo(() => {
    if (!document?.synced) return -1;
    return findActiveLineIndex(document.lines, time);
  }, [document, time]);

  const scrollToActive = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const viewport = viewportRef.current;
    const line = activeIndex >= 0 ? lineElements.current.get(activeIndex) : null;
    if (!viewport) return;
    if (!line) {
      viewport.scrollTo({ top: 0, behavior });
      return;
    }
    const target = line.offsetTop - viewport.clientHeight / 2 + line.clientHeight / 2;
    viewport.scrollTo({ top: Math.max(0, target), behavior });
  }, [activeIndex]);

  useEffect(() => {
    scrollToActiveRef.current = scrollToActive;
  }, [scrollToActive]);

  useEffect(() => {
    if (!document?.synced) return;
    if (Date.now() < manualUntil.current) return;
    const raf = requestAnimationFrame(() => scrollToActive('smooth'));
    return () => cancelAnimationFrame(raf);
  }, [activeIndex, document, settings.showTranslation, settings.lyricSize, scrollToActive]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (Date.now() >= manualUntil.current) scrollToActive('auto');
      });
    });
    observer.observe(viewport);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [scrollToActive]);

  const beginManualScroll = (): void => {
    manualUntil.current = Date.now() + 4200;
    window.clearTimeout(manualTimer.current);
    manualTimer.current = window.setTimeout(() => {
      manualUntil.current = 0;
      scrollToActiveRef.current('smooth');
    }, 4200);
  };

  useEffect(() => () => window.clearTimeout(manualTimer.current), []);

  const setLineRef = useCallback((index: number, element: HTMLButtonElement | null) => {
    if (element) lineElements.current.set(index, element);
    else lineElements.current.delete(index);
  }, []);

  const seekToLine = useCallback((line: LyricLine) => {
    player.seek(line.start);
  }, []);

  const translationVisible = settings.showTranslation && Boolean(document?.lines.some((line) => line.translation));
  const wordTimed = Boolean(document?.lines.some((line) => line.words.length > 1));
  const sourceLabel = document?.source === 'embedded' ? t('np.embedded') : t('np.sidecar');

  return (
    <section
      className="lyrics-panel"
      aria-label={t('np.lyrics')}
      style={{
        '--lyric-scale': settings.lyricSize,
        '--lyric-weight': settings.lyricWeight,
      } as React.CSSProperties}
    >
      <header className="lyrics-header">
        <div className="lyrics-heading">
          <span className="section-eyebrow">{t('np.lyrics')}</span>
          <div className="lyrics-badges">
            {document ? <span className="soft-badge">{sourceLabel}</span> : null}
            {wordTimed ? <span className="soft-badge accent">{t('np.wordByWord')}</span> : null}
            {translationVisible ? <span className="soft-badge">{t('np.translation')}</span> : null}
          </div>
        </div>
        <button
          type="button"
          className={`lyrics-translate-toggle ${settings.showTranslation ? 'is-on' : ''}`.trim()}
          aria-pressed={settings.showTranslation}
          aria-label={t('settings.showTranslation')}
          data-tooltip={t('settings.showTranslation')}
          onClick={() => settings.patch({ showTranslation: !settings.showTranslation })}
        >
          <Translate24Regular />
        </button>
      </header>

      <div className="lyrics-body">
        {loading ? (
          <div className="lyrics-skeleton" aria-hidden="true">
            {[82, 64, 74, 56, 78, 48].map((width, index) => (
              <span key={index} style={{ width: `${width}%` }} />
            ))}
          </div>
        ) : !document || (!document.synced && !document.plainText.trim()) ? (
          <div className="lyrics-empty">
            <span className="lyrics-empty-icon"><MusicNote224Regular /></span>
            <h2>{t('np.noLyrics')}</h2>
            <p>{t('np.noLyricsHint')}</p>
          </div>
        ) : !document.synced ? (
          <div className="lyrics-viewport is-static" ref={viewportRef}>
            <div className="lyrics-static">
              {document.plainText.split('\n').map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>
          </div>
        ) : (
          <div
            className="lyrics-viewport"
            ref={viewportRef}
            onWheel={beginManualScroll}
            onTouchMove={beginManualScroll}
          >
            <div className="lyrics-list">
              {document.lines.map((line, index) => (
                <LyricLineItem
                  key={line.id}
                  line={line}
                  index={index}
                  active={index === activeIndex}
                  past={index < activeIndex}
                  next={index === activeIndex + 1}
                  time={index === activeIndex ? time : 0}
                  showTranslation={settings.showTranslation}
                  onClick={seekToLine}
                  setRef={setLineRef}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <footer className="lyrics-footer">
        <span>{activeIndex >= 0 && document?.lines[activeIndex] ? formatTime(document.lines[activeIndex].start) : '—'}</span>
        <span className="lyrics-progress-line" aria-hidden="true">
          <i style={{ width: `${document?.synced && activeIndex >= 0 ? Math.min(100, Math.max(0, ((time - document.lines[activeIndex].start) / Math.max(0.1, document.lines[activeIndex].end - document.lines[activeIndex].start)) * 100)) : 0}%` }} />
        </span>
        <span>{document?.synced ? formatTime(document.lines[document.lines.length - 1]?.end ?? 0) : '—'}</span>
      </footer>
    </section>
  );
}
