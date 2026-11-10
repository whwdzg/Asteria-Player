import { useEffect, useRef, useState } from 'react';
import type { DanmakuComment, Track } from '../../lib/types';
import { lowerBound, parseDanmaku } from '../../lib/danmaku';
import { resolveDanmaku } from '../../lib/media';
import { useClockStore } from '../../state/clock';
import { useSettingsStore } from '../../state/settings';
import { usePlaybackStore } from '../../state/playback';

interface ActiveComment extends DanmakuComment {
  uid: string;
  duration: number;
  lane: number;
}

const SCROLL_LANES = 7;
const TOP_LANES = 3;
const MAX_ACTIVE = 50;

export function useDanmaku(track: Track | undefined): {
  comments: DanmakuComment[];
  active: ActiveComment[];
  remove: (uid: string) => void;
} {
  const enabled = useSettingsStore((state) => state.danmakuEnabled);
  const showTop = useSettingsStore((state) => state.danmakuTop);
  const showScroll = useSettingsStore((state) => state.danmakuScroll);
  const [comments, setComments] = useState<DanmakuComment[]>([]);
  const [active, setActive] = useState<ActiveComment[]>([]);
  const commentsRef = useRef<DanmakuComment[]>([]);
  const spawned = useRef(new Set<string>());
  const laneCursor = useRef({ scroll: 0, top: 0 });
  const lastTime = useRef(0);
  const sequence = useRef(0);

  useEffect(() => {
    if (!track) {
      setComments([]);
      commentsRef.current = [];
      setActive([]);
      spawned.current.clear();
      return;
    }
    let cancelled = false;
    const raw = track.danmakuText ?? track.danmakuUrl;
    if (!raw) {
      setComments([]);
      commentsRef.current = [];
      return;
    }
    if (track.danmakuText) {
      const parsed = parseDanmaku(track.danmakuText);
      commentsRef.current = parsed;
      setComments(parsed);
    } else {
      resolveDanmaku(track).then((result) => {
        if (cancelled) return;
        commentsRef.current = result ?? [];
        setComments(result ?? []);
      });
    }
    return () => { cancelled = true; };
  }, [track]);

  useEffect(() => {
    setActive([]);
    spawned.current.clear();
    lastTime.current = useClockStore.getState().time;
  }, [track?.id, enabled, showTop, showScroll]);

  useEffect(() => {
    if (!enabled || !showScroll && !showTop) {
      setActive([]);
      spawned.current.clear();
      return;
    }
    const apply = (time: number): void => {
      const list = commentsRef.current;
      if (!list.length) {
        lastTime.current = time;
        return;
      }
      const jumped = Math.abs(time - lastTime.current) > 1.6;
      if (jumped) {
        setActive([]);
        spawned.current.clear();
        lastTime.current = Math.max(0, time - 0.2);
      }
      const from = lowerBound(list, lastTime.current - 0.02);
      const to = lowerBound(list, time + 0.22);
      const additions: ActiveComment[] = [];
      for (let i = from; i < to; i += 1) {
        const comment = list[i];
        if (comment.mode === 'top' && !showTop) continue;
        if (comment.mode === 'scroll' && !showScroll) continue;
        const key = `${comment.id}:${comment.time}`;
        if (spawned.current.has(key)) continue;
        spawned.current.add(key);
        if (comment.mode === 'bottom') continue;
        const lane = comment.mode === 'top'
          ? laneCursor.current.top++ % TOP_LANES
          : laneCursor.current.scroll++ % SCROLL_LANES;
        sequence.current += 1;
        additions.push({
          ...comment,
          uid: `${key}:${sequence.current}`,
          duration: comment.mode === 'top' ? 4.4 : Math.min(14, Math.max(8, 8 + comment.text.length * 0.12)),
          lane,
        });
      }
      lastTime.current = time;
      if (additions.length) {
        setActive((current) => [...current, ...additions].slice(-MAX_ACTIVE));
      }
    };

    const unsubscribe = useClockStore.subscribe((state) => apply(state.time));
    apply(useClockStore.getState().time);
    return () => {
      unsubscribe();
      setActive([]);
    };
  }, [enabled, showTop, showScroll, track?.id, comments]);

  return {
    comments,
    active,
    remove: (uid) => setActive((current) => current.filter((item) => item.uid !== uid)),
  };
}

export function DanmakuLayer({ track }: { track: Track }): React.ReactElement {
  const { active, remove } = useDanmaku(track);
  const enabled = useSettingsStore((state) => state.danmakuEnabled);
  const isPlaying = usePlaybackStore((state) => state.isPlaying);
  if (!enabled) return <div className="danmaku-layer" aria-hidden="true" />;
  return (
    <div className={`danmaku-layer ${isPlaying ? '' : 'is-paused'}`.trim()} aria-hidden="true">
      {active.map((comment) => (
        <span
          key={comment.uid}
          className={`danmaku-item is-${comment.mode}`}
          style={{
            '--lane': comment.lane,
            '--danmaku-duration': `${comment.duration}s`,
            color: comment.color,
            fontSize: `${comment.size}px`,
          } as React.CSSProperties}
          onAnimationEnd={() => remove(comment.uid)}
        >
          {comment.text}
        </span>
      ))}
    </div>
  );
}
