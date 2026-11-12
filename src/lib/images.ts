/**
 * Keep embedded artwork bounded. Audio tags often carry multi-megabyte base64
 * data URLs; storing those for thousands of tracks is the main import-time
 * memory risk. Large covers are decoded once, resized and converted to a blob
 * URL so the original base64 string can be released.
 */
export async function compactImageDataUrl(
  dataUrl: string | undefined,
  maxDimension = 640,
  maxInlineLength = 320_000,
): Promise<string | undefined> {
  if (!dataUrl?.startsWith('data:image/')) return dataUrl;
  if (dataUrl.length <= maxInlineLength) return dataUrl;

  const image = new Image();
  image.decoding = 'async';
  const loaded = new Promise<boolean>((resolve) => {
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
  });
  image.src = dataUrl;
  if (!(await loaded) || !image.naturalWidth || !image.naturalHeight) return undefined;

  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return undefined;
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), 'image/jpeg', 0.82);
  });
  if (!blob) return undefined;
  return URL.createObjectURL(blob);
}
