/** Extension → MIME, content sniffing, and the executable list that is never served inline. */
import { extname } from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html', '.htm': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.txt': 'text/plain', '.md': 'text/markdown', '.markdown': 'text/markdown', '.csv': 'text/csv',
  '.xml': 'application/xml', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.bmp': 'image/bmp',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.m4a': 'audio/mp4', '.flac': 'audio/flac', '.opus': 'audio/ogg', '.aac': 'audio/aac',
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.ogv': 'video/ogg',
  '.pdf': 'application/pdf', '.zip': 'application/zip', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.stl': 'model/stl', '.obj': 'model/obj', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.3mf': 'model/3mf',
  '.ics': 'text/calendar', '.gpx': 'application/gpx+xml', '.kml': 'application/vnd.google-earth.kml+xml',
};

export const EXECUTABLE_EXTENSIONS = new Set([
  '.exe', '.dll', '.msi', '.bat', '.cmd', '.com', '.scr', '.pif', '.ps1', '.psm1', '.vbs', '.vbe', '.js.exe', '.jse', '.wsf', '.wsh', '.hta',
  '.sh', '.bash', '.zsh', '.command', '.app', '.dmg', '.pkg', '.deb', '.rpm', '.appimage', '.run', '.bin',
  '.jar', '.apk', '.ipa', '.so', '.dylib', '.py', '.rb', '.pl', '.php',
]);

export function mimeFor(path: string): string {
  const ext = extname(path).toLowerCase();
  return MIME[ext] ?? 'application/octet-stream';
}

export function isExecutablePath(path: string): boolean {
  const lower = path.toLowerCase();
  const ext = extname(lower);
  if (EXECUTABLE_EXTENSIONS.has(ext)) return true;
  // "something.app/" bundles on macOS arrive as folders; any file inside is download-only too.
  return lower.split('/').some((seg) => seg.endsWith('.app'));
}

export interface ImageInfo {
  format: 'png' | 'jpeg' | 'gif' | 'webp' | 'svg' | 'bmp' | 'avif' | 'unknown';
  width?: number;
  height?: number;
}

/** Decode-free dimension sniffing for common formats. */
export function sniffImage(buf: Buffer): ImageInfo {
  if (buf.length >= 24 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { format: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length >= 10 && buf.subarray(0, 6).toString('latin1').match(/^GIF8[79]a$/)) {
    return { format: 'gif', width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  if (buf.length >= 30 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') {
    const chunk = buf.subarray(12, 16).toString('latin1');
    if (chunk === 'VP8 ') return { format: 'webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const b0 = buf[21]!, b1 = buf[22]!, b2 = buf[23]!, b3 = buf[24]!;
      return { format: 'webp', width: 1 + (((b1 & 0x3f) << 8) | b0), height: 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) };
    }
    if (chunk === 'VP8X') return { format: 'webp', width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    return { format: 'webp' };
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1]!;
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const len = buf.readUInt16BE(i + 2);
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        return { format: 'jpeg', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
    return { format: 'jpeg' };
  }
  if (buf.length >= 26 && buf[0] === 0x42 && buf[1] === 0x4d) {
    return { format: 'bmp', width: buf.readInt32LE(18), height: Math.abs(buf.readInt32LE(22)) };
  }
  if (buf.length >= 12 && buf.subarray(4, 12).toString('latin1') === 'ftypavif') return { format: 'avif' };
  const head = buf.subarray(0, 512).toString('utf8').trimStart();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) {
    const w = head.match(/\swidth="([\d.]+)/)?.[1];
    const h = head.match(/\sheight="([\d.]+)/)?.[1];
    return { format: 'svg', width: w ? Number(w) : undefined, height: h ? Number(h) : undefined };
  }
  return { format: 'unknown' };
}

export type MediaContainer = 'mp4' | 'webm' | 'ogg' | 'mp3' | 'wav' | 'flac' | 'quicktime' | 'unknown';

/** Container sniffing for audio and video. */
export function sniffMedia(buf: Buffer): MediaContainer {
  if (buf.length < 12) return 'unknown';
  const ftyp = buf.subarray(4, 8).toString('latin1');
  if (ftyp === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('latin1');
    return brand.startsWith('qt') ? 'quicktime' : 'mp4';
  }
  if (buf.readUInt32BE(0) === 0x1a45dfa3) return 'webm';
  if (buf.subarray(0, 4).toString('latin1') === 'OggS') return 'ogg';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WAVE') return 'wav';
  if (buf.subarray(0, 4).toString('latin1') === 'fLaC') return 'flac';
  if (buf.subarray(0, 3).toString('latin1') === 'ID3') return 'mp3';
  if (buf[0] === 0xff && (buf[1]! & 0xe0) === 0xe0) return 'mp3';
  return 'unknown';
}

/** Parse a WAV header: returns duration in seconds when the format is PCM. */
export function wavDuration(buf: Buffer): number | undefined {
  if (sniffMedia(buf) !== 'wav') return undefined;
  let offset = 12;
  let byteRate = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.subarray(offset, offset + 4).toString('latin1');
    const size = buf.readUInt32LE(offset + 4);
    if (id === 'fmt ') byteRate = buf.readUInt32LE(offset + 16);
    if (id === 'data') return byteRate > 0 ? size / byteRate : undefined;
    offset += 8 + size + (size % 2);
  }
  return undefined;
}
