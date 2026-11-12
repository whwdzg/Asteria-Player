import { useEffect, useRef, useState } from 'react';
import type { DanmakuComment, Track } from '../../lib/types';
import { lowerBound, parseDanmaku } from '../../lib/danmaku';
import { resolveDanmaku } from '../../lib/media';
import { useClockStore } from '../../state/clock';
import { useSettingsStore } from '../../state/settings';
import { usePlaybackStore } from '../../state/playback';
import { fontStack } from '../../lib/fonts';

interface ActiveComment extends DanmakuComment {
  uid: string;
  duration: number;
  lane: number;
}

const SCROLL_LANES = 7;
const TOP_LANES = 3;
const MAX_ACTIVE = 50;
const AREA_FRACTION = { quarter: 0.25, half: 0.5, threeQuarter: 0.75, full: 1 } as const;

export function useDanmaku(track: Track | undefined): {
  comments: DanmakuComment[];
  active: ActiveComment[];
  remove: (uid: string) => void;
} {
  const enabled = useSettingsStore((state) => state.danmakuEnabled);
  const showTop = useSettingsStore((state) => state.danmakuTop);
  const showScroll = useSettingsStore((state) => state.danmakuScroll);
  const speed = useSettingsStore((state) => state.danmakuSpeed);
  const area = useSettingsStore((state) => state.danmakuArea);
  const laneCounts = {
    scroll: Math.max(2, Math.round(SCROLL_LANES * AREA_FRACTION[area])),
    top: Math.max(1, Math.round(TOP_LANES * AREA_FRACTION[area])),
  };
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
  }, [track?.id, enabled, showTop, showScroll, speed, area]);

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
          ? laneCursor.current.top++ % laneCounts.top
          : laneCursor.current.scroll++ % laneCounts.scroll;
        sequence.current += 1;
        const baseDuration = comment.mode === 'top' ? 4.4 : Math.min(14, Math.max(8, 8 + comment.text.length * 0.12));
        additions.push({
          ...comment,
          uid: `${key}:${sequence.current}`,
          duration: baseDuration / Math.max(0.5, speed),
          lane,
        });
      }
      lastTime.current = time;
      if (additions.length) {
        setActive((current) => {
          // Never drop comments that are still crossing the video; simply wait
          // for room instead of slicing the animation queue.
          const room = Math.max(0, MAX_ACTIVE - current.length);
          return room > 0 ? [...current, ...additions.slice(0, room)] : current;
        });
      }
    };

    const unsubscribe = useClockStore.subscribe((state) => apply(state.time));
    apply(useClockStore.getState().time);
    return () => {
      unsubscribe();
      setActive([]);
    };
  }, [enabled, showTop, showScroll, speed, area, laneCounts.scroll, laneCounts.top, track?.id, comments]);

  return {
    comments,
    active,
    remove: (uid) => setActive((current) => current.filter((item) => item.uid !== uid)),
  };
}

export function DanmakuLayer({ track }: { track: Track }): React.ReactElement {
  const { active, remove } = useDanmaku(track);
  const enabled = useSettingsStore((state) => state.danmakuEnabled);
  const weight = useSettingsStore((state) => state.danmakuWeight);
  const size = useSettingsStore((state) => state.danmakuSize);
  const opacity = useSettingsStore((state) => state.danmakuOpacity);
  const font = useSettingsStore((state) => state.danmakuFont);
  const isPlaying = usePlaybackStore((state) => state.isPlaying);
  const area = useSettingsStore((state) => state.danmakuArea);
  const areaFraction = AREA_FRACTION[area];
  const scrollLanes = Math.max(2, Math.round(SCROLL_LANES * areaFraction));
  const topLanes = Math.max(1, Math.round(TOP_LANES * areaFraction));
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
            top: `${comment.mode === 'top'
              ? 7 + (comment.lane / Math.max(1, topLanes - 1)) * (areaFraction * 78)
              : 9 + (comment.lane / Math.max(1, scrollLanes - 1)) * (areaFraction * 80)}%`,
            '--danmaku-weight': weight,
            '--danmaku-opacity': opacity,
            color: comment.color,
            fontSize: `${((comment.size > 0 ? comment.size : 25) * size / 25).toFixed(1)}px`,
            fontFamily: fontStack(font),
          } as React.CSSProperties}
          onAnimationEnd={() => remove(comment.uid)}
        >
          {comment.text}
        </span>
      ))}
    </div>
  );
}
