import {
  MEDIA_LIMITS_BYTES,
  type PhotoMimeType,
  type VideoMimeType,
  type VoiceMimeType,
} from '../src/shared/capsule-api';

export type MediaKind = 'photo' | 'voice' | 'video';
export type ParsedMedia = { mimeType: PhotoMimeType | VoiceMimeType | VideoMimeType; bytes: Buffer };

export const MEDIA_MIME_TYPES: Record<MediaKind, readonly string[]> = {
  photo: ['image/jpeg', 'image/png', 'image/webp'],
  voice: ['audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/webm'],
  video: ['video/mp4', 'video/quicktime', 'video/webm'],
};

const LABEL: Record<MediaKind, string> = { photo: '사진', voice: '음성', video: '동영상' };

/** Thrown for a structurally wrong upload; the server maps the reason to an HTTP error. */
export class MediaError extends Error {
  constructor(readonly reason: 'VALIDATION' | 'MEDIA_INVALID' | 'TOO_LARGE', message: string) {
    super(message);
  }
}

// These are bounded container checks, not a codec decoder. Device playback is
// still the final compatibility check for the user's particular media codec.
function isoMediaKind(bytes: Buffer): { quickTime: boolean; audio: boolean; video: boolean } | null {
  const handlers = new Set<string>();
  let quickTime = false;
  let supportedBrand = false;
  let hasMediaData = false;
  let boxCount = 0;
  function boxes(start: number, end: number, depth: number): boolean {
    if (depth > 3) return false;
    let offset = start;
    while (offset < end) {
      if (offset + 8 > end || ++boxCount > 100_000) return false;
      let size = bytes.readUInt32BE(offset);
      let header = 8;
      const type = bytes.toString('ascii', offset + 4, offset + 8);
      if (size === 1) {
        if (offset + 16 > end) return false;
        const extended = bytes.readBigUInt64BE(offset + 8);
        if (extended > BigInt(Number.MAX_SAFE_INTEGER)) return false;
        size = Number(extended);
        header = 16;
      } else if (size === 0) {
        size = end - offset;
      }
      if (size < header || size > end - offset) return false;
      const payload = offset + header;
      const boxEnd = offset + size;
      if (depth === 0 && type === 'ftyp') {
        if (boxEnd - payload < 8 || (boxEnd - payload) % 4 !== 0) return false;
        for (let i = payload; i < boxEnd; i += 4) {
          if (i === payload + 4) continue; // minor version, not a brand
          const brand = bytes.toString('ascii', i, i + 4);
          if (brand === 'qt  ') quickTime = true;
          if (/^(?:isom|iso[2-9]|mp4[12]|M4[AV] |avc1|dash|MSNV)$/.test(brand)) supportedBrand = true;
        }
      } else if (depth === 0 && type === 'mdat' && boxEnd > payload) {
        hasMediaData = true;
      } else if ((depth === 0 && type === 'moov') || (depth === 1 && type === 'trak') || (depth === 2 && type === 'mdia')) {
        if (!boxes(payload, boxEnd, depth + 1)) return false;
      } else if (depth === 3 && type === 'hdlr') {
        if (boxEnd - payload < 12) return false;
        handlers.add(bytes.toString('ascii', payload + 8, payload + 12));
      }
      offset = boxEnd;
    }
    return offset === end;
  }
  if (!boxes(0, bytes.length, 0) || !hasMediaData || (!supportedBrand && !quickTime)) return null;
  return { quickTime, audio: handlers.has('soun'), video: handlers.has('vide') };
}

function isWave(bytes: Buffer): boolean {
  if (bytes.length < 44 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') return false;
  const end = bytes.readUInt32LE(4) + 8;
  if (end !== bytes.length) return false;
  let hasFormat = false;
  let hasData = false;
  for (let offset = 12; offset < end;) {
    if (offset + 8 > end) return false;
    const type = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    if (size > end - offset - 8) return false;
    if (type === 'fmt ' && size >= 16) hasFormat = true;
    if (type === 'data' && size > 0) hasData = true;
    offset += 8 + size + (size % 2);
    if (offset > end) return false;
  }
  return hasFormat && hasData;
}

function isMp3(bytes: Buffer): boolean {
  let offset = 0;
  if (bytes.length >= 10 && bytes.toString('ascii', 0, 3) === 'ID3') {
    if (bytes[3] < 2 || bytes[3] > 4 || bytes.subarray(6, 10).some(value => value > 127)) return false;
    const tagSize = bytes[6] * 2 ** 21 + bytes[7] * 2 ** 14 + bytes[8] * 128 + bytes[9];
    offset = 10 + tagSize + (bytes[3] === 4 && (bytes[5] & 0x10) ? 10 : 0);
  }
  if (offset + 4 >= bytes.length) return false;
  const [first, second, third] = bytes.subarray(offset, offset + 3);
  // MPEG audio sync, valid version/layer, bitrate and sample-rate indices.
  return first === 0xff && (second & 0xe0) === 0xe0 && (second & 0x18) !== 0x08
    && (second & 0x06) !== 0 && (third & 0xf0) !== 0 && (third & 0xf0) !== 0xf0 && (third & 0x0c) !== 0x0c;
}

function isJpeg(bytes: Buffer): boolean {
  return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

const PNG_HEADER = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
function isPng(bytes: Buffer): boolean {
  return bytes.length > 8 && bytes.subarray(0, 8).equals(PNG_HEADER);
}

function isWebp(bytes: Buffer): boolean {
  return bytes.length >= 16 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
    && /^VP8[ LX]$/.test(bytes.toString('ascii', 12, 16));
}

/** Matroska/WebM: EBML magic, and a `webm` DocType inside the EBML header. */
function isWebm(bytes: Buffer): boolean {
  if (bytes.length < 16 || bytes.readUInt32BE(0) !== 0x1a45dfa3) return false;
  return bytes.subarray(0, Math.min(bytes.length, 64)).includes('webm', 0, 'ascii');
}

function sniff(mimeType: string, bytes: Buffer): boolean {
  switch (mimeType) {
    case 'image/jpeg': return isJpeg(bytes);
    case 'image/png': return isPng(bytes);
    case 'image/webp': return isWebp(bytes);
    case 'audio/wav': return isWave(bytes);
    case 'audio/mpeg': return isMp3(bytes);
    case 'audio/webm':
    case 'video/webm': return isWebm(bytes);
    case 'audio/mp4': {
      const media = isoMediaKind(bytes);
      return !!media && media.audio && !media.video && !media.quickTime;
    }
    case 'video/mp4':
    case 'video/quicktime': {
      const media = isoMediaKind(bytes);
      return !!media && media.video && media.quickTime === (mimeType === 'video/quicktime');
    }
    default: return false;
  }
}

/**
 * Validates a `MediaUpload` for an item kind: mime family, Base64 shape, decoded size
 * (MEDIA_LIMITS_BYTES) and the leading bytes of the file itself.
 */
export function parseMedia(value: unknown, kind: MediaKind): ParsedMedia {
  const label = LABEL[kind];
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new MediaError('VALIDATION', `${label} 파일을 넣어 주세요.`);
  const { base64, mimeType } = value as Record<string, unknown>;
  if (typeof mimeType !== 'string' || !MEDIA_MIME_TYPES[kind].includes(mimeType)) {
    throw new MediaError('VALIDATION', `${label}에는 ${MEDIA_MIME_TYPES[kind].join(', ')} 파일만 넣을 수 있어요.`);
  }
  const limit = MEDIA_LIMITS_BYTES[kind];
  const megabytes = limit / 1024 / 1024;
  if (typeof base64 !== 'string' || base64.length === 0 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    throw new MediaError('MEDIA_INVALID', `${label} 파일을 읽을 수 없어요. 다시 골라 주세요.`);
  }
  if (base64.length > Math.ceil(limit / 3) * 4) throw new MediaError('TOO_LARGE', `${label}은(는) ${megabytes}MB 이하로 넣어 주세요.`);
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > limit) throw new MediaError('TOO_LARGE', `${label}은(는) ${megabytes}MB 이하로 넣어 주세요.`);
  if (!sniff(mimeType, bytes)) {
    throw new MediaError('MEDIA_INVALID', `${label} 파일과 형식이 맞지 않거나 파일이 손상됐어요. 다른 파일로 다시 넣어 주세요.`);
  }
  return { mimeType: mimeType as ParsedMedia['mimeType'], bytes };
}
