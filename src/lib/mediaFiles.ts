import type { Track } from './types';

export function revokeTrackUrls(track: Track): void {
  if (track.src.startsWith('blob:')) URL.revokeObjectURL(track.src);
  if (track.cover?.startsWith('blob:')) URL.revokeObjectURL(track.cover);
}

export async function collectDroppedFiles(dataTransfer: DataTransfer): Promise<File[]> {
  const files: File[] = [];
  const items = Array.from(dataTransfer.items);
  const entries = items
    .map((item) => (item.webkitGetAsEntry ? item.webkitGetAsEntry() : null))
    .filter((entry): entry is FileSystemEntry => entry !== null);
  if (!entries.length) return Array.from(dataTransfer.files);

  const readEntry = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => {
        (entry as FileSystemFileEntry).file(resolve, reject);
      });
      files.push(file);
      return;
    }
    if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      for (;;) {
        const children = await new Promise<FileSystemEntry[]>((resolve, reject) => {
          reader.readEntries(resolve, reject);
        });
        if (!children.length) break;
        for (const child of children) await readEntry(child);
      }
    }
  };

  for (const entry of entries) await readEntry(entry);
  return files.length ? files : Array.from(dataTransfer.files);
}
