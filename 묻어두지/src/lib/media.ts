import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import {
  MAX_AUDIO_BYTES, MAX_VIDEO_BYTES,
  type AudioAttachment, type AudioMimeType, type MediaAttachment, type VideoAttachment, type VideoMimeType,
} from '../shared/contracts';

export type DraftMedia<T extends MediaAttachment = MediaAttachment> = T & {
  previewUri: string;
  sizeBytes: number;
  temporaryUris: string[];
};
export type DraftAudio = DraftMedia<AudioAttachment>;
export type DraftVideo = DraftMedia<VideoAttachment>;
export type PlaybackFile = { uri: string; dispose: () => Promise<void> };

function audioType(name: string, mime?: string): AudioMimeType {
  const type = mime?.split(';')[0].toLowerCase();
  if (['audio/mp4', 'audio/x-m4a', 'audio/m4a'].includes(type || '') || /\.m4a$/i.test(name)) return 'audio/mp4';
  if (type === 'audio/mpeg' || type === 'audio/mp3' || /\.mp3$/i.test(name)) return 'audio/mpeg';
  if (['audio/wav', 'audio/x-wav', 'audio/wave'].includes(type || '') || /\.wav$/i.test(name)) return 'audio/wav';
  throw new Error('음성은 M4A, MP3, WAV 파일로 담아 주세요.');
}
function videoType(name: string, mime?: string): VideoMimeType {
  const type = mime?.split(';')[0].toLowerCase();
  if (type === 'video/quicktime' || /\.mov$/i.test(name)) return 'video/quicktime';
  if (['video/mp4', 'video/x-m4v'].includes(type || '') || /\.(mp4|m4v)$/i.test(name)) return 'video/mp4';
  throw new Error('영상은 MP4 또는 MOV 파일로 담아 주세요.');
}
function safeName(value: string) {
  return value.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, 120) || '첨부 파일';
}
function checkSize(bytes: number, max: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) throw new Error('비어 있거나 읽을 수 없는 파일이에요.');
  if (bytes > max) throw new Error(`이 파일은 ${(bytes / 1024 / 1024).toFixed(1)}MB예요. ${max / 1024 / 1024}MB 이하 파일을 골라 주세요.`);
}
async function readFile(uri: string, max: number, file?: File): Promise<{ base64: string; sizeBytes: number }> {
  if (Platform.OS === 'web') {
    const blob = file || await (await fetch(uri)).blob();
    checkSize(blob.size, max);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 32768) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
    }
    return { base64: btoa(binary), sizeBytes: blob.size };
  }
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.isDirectory) throw new Error('선택한 파일을 읽을 수 없어요. 파일을 다시 선택해 주세요.');
  checkSize(info.size, max);
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return { base64, sizeBytes: info.size };
}

export async function pickAudio(): Promise<DraftAudio | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['audio/*'], multiple: false, copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  try {
    const mimeType = audioType(asset.name, asset.mimeType);
    if (asset.size !== undefined) checkSize(asset.size, MAX_AUDIO_BYTES);
    const data = await readFile(asset.uri, MAX_AUDIO_BYTES, asset.file);
    return { ...data, mimeType, fileName: safeName(asset.name), previewUri: asset.uri, temporaryUris: Platform.OS === 'web' ? [] : [asset.uri] };
  } catch (cause) { await discardTemporaryUris([asset.uri]); throw cause; }
}

export async function createRecordedAudio(uri: string): Promise<DraftAudio> {
  if (!FileSystem.cacheDirectory) throw new Error('녹음을 담을 임시 저장소를 사용할 수 없어요.');
  const copyUri = `${FileSystem.cacheDirectory}mudeoduji-voice-${Date.now()}-${Math.random().toString(36).slice(2)}.m4a`;
  try {
    // The recorder owns and disposes its output after this callback. Keep a
    // separate draft copy so the user can preview until sealing or removing it.
    await FileSystem.copyAsync({ from: uri, to: copyUri });
    const data = await readFile(copyUri, MAX_AUDIO_BYTES);
    return { ...data, mimeType: 'audio/mp4', fileName: '미래에 전할 목소리.m4a', previewUri: copyUri, temporaryUris: [copyUri] };
  } catch (cause) { await discardTemporaryUris([copyUri]); throw cause; }
}

export async function pickVideo(): Promise<DraftVideo | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsMultipleSelection: false });
  if (result.canceled) return null;
  const asset = result.assets[0];
  try {
    const name = asset.fileName || asset.uri.split('?')[0].split('/').pop() || '추억.mp4';
    const mimeType = videoType(name, asset.mimeType);
    if (asset.fileSize !== undefined) checkSize(asset.fileSize, MAX_VIDEO_BYTES);
    const data = await readFile(asset.uri, MAX_VIDEO_BYTES, asset.file);
    return { ...data, mimeType, fileName: safeName(name), previewUri: asset.uri, temporaryUris: Platform.OS === 'web' ? [] : [asset.uri] };
  } catch (cause) { await discardTemporaryUris([asset.uri]); throw cause; }
}

async function discardTemporaryUris(uris: string[]) {
  if (Platform.OS === 'web') return;
  await Promise.all(uris.map(async uri => {
    if (FileSystem.cacheDirectory && uri.startsWith(FileSystem.cacheDirectory)) {
      await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
    }
  }));
}
export async function discardMedia(media: DraftMedia | null) {
  if (media) await discardTemporaryUris(media.temporaryUris);
}

/** Materialize only content already returned by the authorized /open API. */
export async function createPlaybackFile(attachment: MediaAttachment): Promise<PlaybackFile> {
  if (Platform.OS === 'web') {
    const binary = atob(attachment.base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    const uri = URL.createObjectURL(new Blob([bytes], { type: attachment.mimeType }));
    return { uri, dispose: async () => URL.revokeObjectURL(uri) };
  }
  if (!FileSystem.cacheDirectory) throw new Error('재생용 임시 저장소를 사용할 수 없어요.');
  const directory = `${FileSystem.cacheDirectory}mudeoduji-playback/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const extension = { 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'video/mp4': 'mp4', 'video/quicktime': 'mov' }[attachment.mimeType];
  const uri = `${directory}${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  try { await FileSystem.writeAsStringAsync(uri, attachment.base64, { encoding: FileSystem.EncodingType.Base64 }); }
  catch (cause) { await discardTemporaryUris([uri]); throw cause; }
  return { uri, dispose: () => discardTemporaryUris([uri]) };
}

export async function clearStalePlaybackFiles() {
  if (Platform.OS !== 'web' && FileSystem.cacheDirectory) {
    await FileSystem.deleteAsync(`${FileSystem.cacheDirectory}mudeoduji-playback/`, { idempotent: true }).catch(() => undefined);
  }
}

/** Strip preview paths and file metadata that should never be persisted. */
export function mediaPayload<T extends MediaAttachment>(media: DraftMedia<T> | null): T | null {
  if (!media) return null;
  return { base64: media.base64, mimeType: media.mimeType, fileName: media.fileName } as T;
}
