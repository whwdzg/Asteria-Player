import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowSync24Regular,
  CloudArrowDown24Regular,
  Dismiss24Regular,
  MusicNote224Regular,
  Search24Regular,
} from '@fluentui/react-icons';
import type { Track } from '../../lib/types';
import { formatDuration } from '../../lib/format';
import {
  applySongCandidate,
  completeCandidate,
  searchSongMatches,
  type SongMatchCandidate,
} from '../../lib/onlineMatch';
import { useI18n } from '../../i18n/I18nProvider';
import { useLibraryStore } from '../../state/library';
import { useUiStore } from '../../state/ui';
import { CoverArt } from '../common/CoverArt';
import { IconButton } from '../common/IconButton';

interface SongMatchPanelProps {
  track: Track;
}

/**
 * LDDC-style choose-a-candidate flow. If the current item has no artwork the
 * panel opens and searches immediately; otherwise it stays collapsed behind an
 * explicit "Match online" button so healthy items are not interrupted.
 */
export function SongMatchPanel({ track }: SongMatchPanelProps): React.ReactElement {
  const { t } = useI18n();
  const updateTrack = useLibraryStore((state) => state.updateTrack);
  const pushToast = useUiStore((state) => state.pushToast);
  const missingCover = !track.cover;
  const [open, setOpen] = useState(missingCover);
  const [title, setTitle] = useState(track.title);
  const [artist, setArtist] = useState(track.artist);
  const [results, setResults] = useState<SongMatchCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [applying, setApplying] = useState('');
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const autoSearched = useRef(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const runSearch = useCallback(async (): Promise<void> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const id = ++requestId.current;
    setSearching(true);
    setError('');
    try {
      const found = await searchSongMatches({ ...track, title, artist }, controller.signal);
      setResults(found);
    } catch (reason) {
      if (controller.signal.aborted) return;
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (id === requestId.current) setSearching(false);
    }
  }, [artist, title, track]);


  useEffect(() => {
    if (!open || autoSearched.current || track.cover) return;
    autoSearched.current = true;
    void runSearch();
  }, [open, runSearch, track.cover]);

  useEffect(() => {
    if (!results.length) return;
    // Wait one frame so the cards have laid out, then scroll only the modal
    // body (never the fixed header) to the result list.
    const frame = window.requestAnimationFrame(() => {
      const node = resultsRef.current;
      const body = node?.closest('.modal-body');
      if (!node || !(body instanceof HTMLElement)) return;
      const top = node.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 8;
      body.scrollTop = Math.max(0, top);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [results]);

  const apply = async (candidate: SongMatchCandidate): Promise<void> => {
    setApplying(candidate.id);
    setError('');
    try {
      const complete = await completeCandidate(candidate);
      updateTrack(track.id, applySongCandidate(track, complete));
      pushToast(t('match.applied'));
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setApplying('');
    }
  };

  return (
    <section className={`online-match ${open ? 'is-open' : ''}`} aria-label={t('match.songSection')}>
      <div className="online-match-heading">
        <div>
          <h3><MusicNote224Regular /> {t('match.songSection')}</h3>
          <p>{t('match.hint')}</p>
        </div>
        {open ? (
          <IconButton label={t('match.close')} variant="subtle" onClick={() => { abortRef.current?.abort(); setOpen(false); }}>
            <Dismiss24Regular />
          </IconButton>
        ) : (
          <button type="button" className="fluent-button" onClick={() => setOpen(true)}>
            <CloudArrowDown24Regular /> {t('match.open')}
          </button>
        )}
      </div>

      {missingCover && open ? (
        <div className="online-match-callout">
          <strong>{t('match.missingCover')}</strong>
          <span>{t('match.missingCoverHint')}</span>
        </div>
      ) : null}

      {open ? (
        <>
          <div className="online-match-query">
            <label>
              <span>{t('match.queryTitle')}</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label>
              <span>{t('match.queryArtist')}</span>
              <input value={artist} onChange={(event) => setArtist(event.target.value)} />
            </label>
            <button type="button" className="fluent-button primary" disabled={!title.trim()} onClick={() => void runSearch()}>
              {searching ? <ArrowSync24Regular className="spin-slow" /> : <Search24Regular />}
              {searching ? t('match.searching') : t('match.search')}
            </button>
          </div>

          {error ? <p className="online-match-error" role="alert">{t('match.error')}: {error}</p> : null}
          {!searching && !error && results.length === 0 ? <p className="online-match-empty">{t('match.noResults')}</p> : null}

          {results.length ? <p className="online-match-count">{t('match.candidateCount', { count: results.length })}</p> : null}
          <div className="online-match-results" ref={resultsRef}>
            {results.map((candidate) => (
              <article className="online-match-card" key={candidate.id}>
                <CoverArt
                  track={{ ...track, title: candidate.title, cover: candidate.cover }}
                  className="online-match-cover"
                  alt=""
                  eager
                />
                <div className="online-match-copy">
                  <strong>{candidate.title}</strong>
                  <span>{candidate.artist}</span>
                  <small>
                    {candidate.album || '—'}
                    {candidate.duration ? ` · ${formatDuration(candidate.duration)}` : ''}
                  </small>
                  <div className="online-match-badges">
                    {candidate.cover ? <span>{t('match.cover')}</span> : null}
                    {candidate.lyrics ? <span>{t('match.lyrics')}</span> : null}
                    <span>{candidate.providers.join(' + ')}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="fluent-button primary online-match-apply"
                  disabled={Boolean(applying)}
                  onClick={() => void apply(candidate)}
                >
                  {applying === candidate.id ? <ArrowSync24Regular className="spin-slow" /> : null}
                  {t('match.applyAll')}
                </button>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
