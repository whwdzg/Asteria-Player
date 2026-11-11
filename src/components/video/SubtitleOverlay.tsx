import { useEffect, useMemo, useState } from 'react';
import type { SubtitleCue, SubtitleSource, Track } from '../../lib/types';
import { activeCue, pickSubtitleLanguage, parseSubtitle } from '../../lib/subtitles';
import { resolveSubtitle } from '../../lib/media';
import { fontStack } from '../../lib/fonts';
import { useClockStore } from '../../state/clock';
import { useSettingsStore } from '../../state/settings';
import { useI18n } from '../../i18n/I18nProvider';

export function useActiveSubtitle(track: Track | undefined): { source?: SubtitleSource; cues: SubtitleCue[] } {
  const subtitleLang = useSettingsStore((state) => state.subtitleLang);
  const [cues, setCues] = useState<SubtitleCue[]>([]);

  const source = useMemo(
    () => (track ? pickSubtitleLanguage(track.subtitles, subtitleLang, navigator.languages ?? [navigator.language]) : undefined),
    [track, subtitleLang],
  );

  useEffect(() => {
    if (!track || !source) {
      setCues([]);
      return;
    }
    let cancelled = false;
    setCues([]);
    if (source.text) {
      setCues(parseSubtitle(source.text, source.format).cues);
      return;
    }
    resolveSubtitle(track, source).then((result) => {
      if (!cancelled) setCues(result ?? []);
    });
    return () => { cancelled = true; };
  }, [track, source]);

  return { source, cues };
}

export function SubtitleOverlay({ track }: { track: Track }): React.ReactElement | null {
  const time = useClockStore((state) => state.time);
  const { cues } = useActiveSubtitle(track);
  const bgOpacity = useSettingsStore((state) => state.subtitleBgOpacity);
  const textOpacity = useSettingsStore((state) => state.subtitleTextOpacity);
  const subtitleFont = useSettingsStore((state) => state.subtitleFont);
  const { t } = useI18n();
  const cue = activeCue(cues, time);
  if (!cue) return null;
  return (
    <div className="subtitle-overlay" aria-label={t('a11y.subtitleOverlay')}>
      <span
        key={cue.id}
        className="subtitle-cue"
        style={{
          '--subtitle-bg': bgOpacity,
          '--subtitle-text-opacity': textOpacity,
          fontFamily: fontStack(subtitleFont),
        } as React.CSSProperties}
      >
        {cue.text.split('\n').map((line, index) => (
          <span key={index}>{line}</span>
        ))}
      </span>
    </div>
  );
}
