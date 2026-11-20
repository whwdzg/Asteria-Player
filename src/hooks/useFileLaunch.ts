import { useEffect, useRef } from 'react';

interface LaunchFileHandle {
  getFile: () => Promise<File>;
}

interface LaunchParams {
  files?: LaunchFileHandle[];
}

interface LaunchQueue {
  setConsumer: (consumer: (params: LaunchParams) => void) => void;
}

type WindowWithLaunchQueue = Window & { launchQueue?: LaunchQueue };

/**
 * Receives media files opened through the installed PWA's OS file association.
 * Chromium queues the launch until setConsumer is called, so registering on
 * mount is enough even when the app is still restoring its library.
 */
export function useFileLaunch(onFiles: (files: File[]) => void, ready = true): void {
  const callback = useRef(onFiles);
  const readyRef = useRef(ready);
  const pending = useRef<File[] | null>(null);
  callback.current = onFiles;
  readyRef.current = ready;

  useEffect(() => {
    if (!ready || !pending.current) return;
    const files = pending.current;
    pending.current = null;
    callback.current(files);
  }, [ready]);

  useEffect(() => {
    const queue = (window as WindowWithLaunchQueue).launchQueue;
    if (!queue?.setConsumer) return;
    try {
      queue.setConsumer((params) => {
        const handles = params.files ?? [];
        if (!handles.length) return;
        void Promise.all(handles.map((handle) => handle.getFile().catch(() => null)))
          .then((files) => {
            const accepted = files.filter((file): file is File => file !== null);
            if (!accepted.length) return;
            if (readyRef.current) callback.current(accepted);
            else pending.current = accepted;
          })
          .catch(() => undefined);
      });
    } catch {
      // File launch is a Chromium-only progressive enhancement.
    }
  }, []);
}
