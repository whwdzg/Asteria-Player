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
import { fontStack } from '../../lib/fonts';

interface LyricLineProps {
  line: LyricLine;
  index: number;
  active: boolean;
  past: boolean;
  next: boolean;
  distance: number;
  blurEnabled: boolean;
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
  distance,
  blurEnabled,
  time,
  showTranslation,
  onClick,
  setRef,
}: LyricLineProps): React.ReactElement {
  const words = active ? getWordProgress(line, time) : null;
  const blur = blurEnabled && !active ? Math.min(2.8, Math.max(0, distance - 1) * 0.55) : 0;
  const opacity = active || (next && distance === 0)
    ? 1
    : Math.max(0.18, 0.78 - Math.max(0, distance - 1) * 0.13);
  return (
    <button
      type="button"
      ref={(element) => setRef(index, element)}
      className={`lyric-line ${active ? 'is-active' : ''} ${past ? 'is-past' : ''} ${next ? 'is-next' : ''}`.trim()}
      aria-current={active ? 'true' : undefined}
      onClick={() => onClick(line)}
      data-line-index={index}
      style={{ '--lyric-blur': `${blur}px`, '--line-opacity': opacity } as React.CSSProperties}
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

  return (
    <section
      className="lyrics-panel"
      aria-label={t('np.lyrics')}
      data-font={settings.lyricFont}
      style={{
        '--lyric-scale': settings.lyricSize,
        '--lyric-weight': settings.lyricWeight,
        '--lyric-translation-scale': settings.lyricTranslationSize,
        '--lyric-font-family': fontStack(settings.lyricFont),
      } as React.CSSProperties}
    >
      <header className="lyrics-header">
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
                  distance={Math.abs(index - Math.max(0, activeIndex))}
                  blurEnabled={settings.lyricBlur}
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
    </section>
  );
}
