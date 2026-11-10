export function ascii(bytes: Uint8Array, start: number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += String.fromCharCode(bytes[start + i] ?? 0);
  return out;
}

export function u16be(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

export function u24be(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 16) | ((bytes[offset + 1] ?? 0) << 8) | (bytes[offset + 2] ?? 0);
}

export function u32be(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) * 0x1000000) +
    (((bytes[offset + 1] ?? 0) << 16) | ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0))
  );
}

export function u32le(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] ?? 0) |
    ((bytes[offset + 1] ?? 0) << 8) |
    ((bytes[offset + 2] ?? 0) << 16) |
    ((bytes[offset + 3] ?? 0) * 0x1000000)
  );
}

export function u64be(bytes: Uint8Array, offset: number): number {
  return u32be(bytes, offset) * 0x100000000 + u32be(bytes, offset + 4);
}

export function syncSafe(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) & 0x7f) * 0x200000 +
    (((bytes[offset + 1] ?? 0) & 0x7f) << 14) +
    (((bytes[offset + 2] ?? 0) & 0x7f) << 7) +
    ((bytes[offset + 3] ?? 0) & 0x7f)
  );
}

const decoders = new Map<string, TextDecoder>();

function decoder(label: string): TextDecoder {
  let value = decoders.get(label);
  if (!value) {
    try {
      value = new TextDecoder(label);
    } catch {
      value = new TextDecoder('utf-8');
    }
    decoders.set(label, value);
  }
  return value;
}

const utf8 = decoder('utf-8');
const latin1 = decoder('iso-8859-1');

export function decodeText(bytes: Uint8Array, encoding: number): string {
  if (!bytes.length) return '';
  let text = '';
  switch (encoding) {
    case 0:
      text = latin1.decode(bytes);
      break;
    case 2:
      text = decoder('utf-16be').decode(bytes);
      break;
    case 1:
      if (bytes[0] === 0xff && bytes[1] === 0xfe) text = decoder('utf-16le').decode(bytes.subarray(2));
      else if (bytes[0] === 0xfe && bytes[1] === 0xff) text = decoder('utf-16be').decode(bytes.subarray(2));
      else text = decoder('utf-16le').decode(bytes);
      break;
    default:
      text = utf8.decode(bytes);
  }
  return text.replace(/\u0000+$/g, '').replace(/\u0000/g, '').trim();
}

export function findTerminator(bytes: Uint8Array, start: number, encoding: number): number {
  if (encoding === 1 || encoding === 2) {
    for (let i = start; i + 1 < bytes.length; i += 2) {
      if (bytes[i] === 0 && bytes[i + 1] === 0) return i;
    }
    return bytes.length;
  }
  for (let i = start; i < bytes.length; i += 1) {
    if (bytes[i] === 0) return i;
  }
  return bytes.length;
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64(bytes: Uint8Array): string {
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    output += BASE64_ALPHABET[a >> 2];
    output += BASE64_ALPHABET[((a & 0x03) << 4) | (b >> 4)];
    output += i + 1 < bytes.length ? BASE64_ALPHABET[((b & 0x0f) << 2) | (c >> 6)] : '=';
    output += i + 2 < bytes.length ? BASE64_ALPHABET[c & 0x3f] : '=';
  }
  return output;
}

export function dataUrl(mime: string, bytes: Uint8Array): string {
  return `data:${mime || 'image/jpeg'};base64,${base64(bytes)}`;
}

export function mimeFromBytes(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57) return 'image/webp';
  return 'image/jpeg';
}
