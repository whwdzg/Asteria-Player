import { useRef, useState } from 'react';
import {
  ArrowSync24Regular,
  Chat24Regular,
  ClosedCaption24Regular,
  ArrowRight24Regular,
  Search24Regular,
} from '@fluentui/react-icons';
import type { Track } from '../../lib/types';
import { formatDuration } from '../../lib/format';
import {
  bilibiliSearchUrl,
  bilibiliVideoUrl,
  fetchBilibiliDanmaku,
  fetchBilibiliPages,
  fetchBilibiliSubtitles,
  mergeSubtitles,
  pickBilibiliPage,
  searchBilibiliVideos,
  type BilibiliVideo,
} from '../../lib/bilibili';
import { useI18n } from '../../i18n/I18nProvider';
import { useLibraryStore } from '../../state/library';
import { useSettingsStore } from '../../state/settings';
import { useUiStore } from '../../state/ui';

interface BilibiliMatchPanelProps {
  track: Track;
}

/**
 * Search Bilibili by the video title and import its XML danmaku or WebVTT
 * subtitle tracks. Bilibili's API is cross-origin restricted, so the optional
 * proxy field is part of the persisted settings JSON rather than hard-coded.
 */
export function BilibiliMatchPanel({ track }: BilibiliMatchPanelProps): React.ReactElement {
  const { t } = useI18n();
  const updateTrack = useLibraryStore((state) => state.updateTrack);
  const proxy = useSettingsStore((state) => state.bilibiliProxy);
  const patch = useSettingsStore((state) => state.patch);
  const pushToast = useUiStore((state) => state.pushToast);
  const [query, setQuery] = useState(track.title);
  const [results, setResults] = useState<BilibiliVideo[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const search = async (): Promise<void> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearching(true);
    setError('');
    try {
      setResults(await searchBilibiliVideos(query, proxy, controller.signal));
    } catch (reason) {
      if (controller.signal.aborted) return;
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  };

  const match = async (video: BilibiliVideo, target: 'danmaku' | 'subtitle'): Promise<void> => {
    const key = `${video.bvid}:${target}`;
    setBusy(key);
    setError('');
    try {
      const { pages } = await fetchBilibiliPages(video.bvid, proxy);
      const page = pickBilibiliPage(pages, track.subtitle);
      if (!page) throw new Error('No playable page found.');
      if (target === 'danmaku') {
        const danmakuText = await fetchBilibiliDanmaku(page.cid, proxy);
        updateTrack(track.id, { danmakuText });
        patch({ danmakuEnabled: true });
        pushToast(t('match.danmakuApplied'));
      } else {
        const subtitles = await fetchBilibiliSubtitles(video.bvid, page.cid, proxy);
        updateTrack(track.id, { subtitles: mergeSubtitles(track.subtitles, subtitles) });
        patch({ subtitleLang: 'auto' });
        pushToast(t('match.subtitleApplied'));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="online-match bilibili-match" aria-label={t('match.videoSection')}>
      <div className="online-match-heading">
        <div>
          <h3><Chat24Regular /> {t('match.videoSection')}</h3>
          <p>{t('match.videoHint')}</p>
        </div>
        <a className="text-button" href={bilibiliSearchUrl(query)} target="_blank" rel="noreferrer">
          {t('match.bilibiliOpen')} <ArrowRight24Regular />
        </a>
      </div>

      <label className="bilibili-proxy">
        <span>{t('match.bilibiliProxy')}</span>
        <input
          value={proxy}
          onChange={(event) => patch({ bilibiliProxy: event.target.value })}
          placeholder="https://proxy.example/?url={url}"
        />
        <small>{t('match.bilibiliProxyHint')}</small>
      </label>

      <div className="online-match-query">
        <label>
          <span>{t('match.videoQuery')}</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <button type="button" className="fluent-button primary" disabled={!query.trim()} onClick={() => void search()}>
          {searching ? <ArrowSync24Regular className="spin-slow" /> : <Search24Regular />}
          {searching ? t('match.searching') : t('match.bilibiliSearch')}
        </button>
      </div>

      {error ? <p className="online-match-error" role="alert">{t('match.fetchError')}: {error}</p> : null}
      {!searching && !error && results.length === 0 ? <p className="online-match-empty">{t('match.bilibiliNoResults')}</p> : null}
      {results.length ? <p className="online-match-count">{t('match.candidateCount', { count: results.length })}</p> : null}

      <div className="online-match-results">
        {results.map((video) => (
          <article className="online-match-card bilibili-card" key={video.bvid}>
            <a className="bilibili-cover" href={bilibiliVideoUrl(video.bvid)} target="_blank" rel="noreferrer" aria-label={video.title}>
              {video.cover ? <img src={video.cover} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span>B</span>}
            </a>
            <div className="online-match-copy">
              <strong>{video.title}</strong>
              <span>{video.author}</span>
              <small>
                {video.duration ? formatDuration(video.duration) : '—'}
                {typeof video.play === 'number' ? ` · ${t('match.views', { count: video.play })}` : ''}
              </small>
            </div>
            <div className="bilibili-actions">
              <button
                type="button"
                className="fluent-button"
                disabled={Boolean(busy)}
                onClick={() => void match(video, 'danmaku')}
              >
                {busy === `${video.bvid}:danmaku` ? <ArrowSync24Regular className="spin-slow" /> : <Chat24Regular />}
                {t('match.matchDanmaku')}
              </button>
              <button
                type="button"
                className="fluent-button"
                disabled={Boolean(busy)}
                onClick={() => void match(video, 'subtitle')}
              >
                {busy === `${video.bvid}:subtitle` ? <ArrowSync24Regular className="spin-slow" /> : <ClosedCaption24Regular />}
                {t('match.matchSubtitle')}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
