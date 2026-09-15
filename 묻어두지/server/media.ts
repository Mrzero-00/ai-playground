import {
  MAX_AUDIO_BYTES,
  MAX_VIDEO_BYTES,
  type AudioAttachment,
  type VideoAttachment,
} from '../src/shared/contracts';

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

export function parseMedia(value: unknown, kind: 'audio', reject: (message: string) => never): AudioAttachment | null;
export function parseMedia(value: unknown, kind: 'video', reject: (message: string) => never): VideoAttachment | null;
export function parseMedia(value: unknown, kind: 'audio' | 'video', reject: (message: string) => never): AudioAttachment | VideoAttachment | null {
  if (value === undefined || value === null) return null;
  const label = kind === 'audio' ? '음성' : '영상';
  const limit = kind === 'audio' ? MAX_AUDIO_BYTES : MAX_VIDEO_BYTES;
  if (typeof value !== 'object' || Array.isArray(value)) reject(`${label} 파일 형식이 올바르지 않습니다.`);
  const { base64, mimeType, fileName } = value as Record<string, unknown>;
  const allowed = kind === 'audio' ? ['audio/mp4', 'audio/mpeg', 'audio/wav'] : ['video/mp4', 'video/quicktime'];
  if (typeof mimeType !== 'string' || !allowed.includes(mimeType)) {
    reject(kind === 'audio' ? 'M4A, MP3 또는 WAV 음성 파일을 넣어 주세요.' : 'MP4 또는 MOV 영상 파일을 넣어 주세요.');
  }
  if (typeof fileName !== 'string' || !fileName.trim() || fileName.length > 160
    || /[\\/\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(fileName)
    || fileName === '.' || fileName === '..') {
    reject(`${label} 파일 이름이 올바르지 않습니다.`);
  }
  if (typeof base64 !== 'string' || base64.length === 0 || base64.length > Math.ceil(limit / 3) * 4
    || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    reject(`${label} 파일은 ${limit / 1024 / 1024}MB 이하의 올바른 Base64 파일이어야 합니다.`);
  }
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > limit || bytes.toString('base64') !== base64) reject(`${label} 파일은 ${limit / 1024 / 1024}MB 이하여야 합니다.`);
  let matches: boolean;
  if (mimeType === 'audio/wav') matches = isWave(bytes);
  else if (mimeType === 'audio/mpeg') matches = isMp3(bytes);
  else {
    const media = isoMediaKind(bytes);
    matches = !!media && (kind === 'audio'
      ? media.audio && !media.video && !media.quickTime
      : media.video && media.quickTime === (mimeType === 'video/quicktime'));
  }
  if (!matches) reject(`${label} 파일과 선택한 형식이 일치하지 않거나 파일이 손상되었습니다.`);
  return { base64, mimeType, fileName } as AudioAttachment | VideoAttachment;
}
