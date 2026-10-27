import { Platform } from 'react-native';

import type { Capsule, ItemKind, PlantedLocation } from '@/domain/capsule';
import { absolutize, capsuleClient } from '@/lib/capsule-client';
import type { CreateCapsuleInput, MediaUpload } from '@/shared/capsule-api';

import { BackendError, type CapsuleBackend, type ItemPatch, type NewItemInput } from './backend';

const FALLBACK_MIME: Record<Exclude<ItemKind, 'letter'>, MediaUpload['mimeType']> = {
  photo: 'image/jpeg',
  voice: Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4',
  video: Platform.OS === 'web' ? 'video/webm' : 'video/mp4',
};

/** 기기의 파일(file://, blob:, data:)을 읽어 base64 로 만든다. 서버는 바이트를 직접 검사하므로 mime 은 힌트일 뿐이다. */
async function readMedia(uri: string, kind: Exclude<ItemKind, 'letter'>): Promise<MediaUpload> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.readAsDataURL(blob);
  });
  if (!base64) throw new BackendError('MEDIA_INVALID', '파일을 읽지 못했어요. 다시 골라 주세요.');
  const mimeType = (blob.type && blob.type !== 'application/octet-stream' ? blob.type : FALLBACK_MIME[kind]) as MediaUpload['mimeType'];
  return { base64, mimeType };
}

/** 서버(src/shared/capsule-api.ts 계약)를 부르는 백엔드. 응답의 Capsule 을 그대로 신뢰한다. */
export class RemoteBackend implements CapsuleBackend {
  readonly source = 'remote' as const;

  async load() {
    const { capsules } = await capsuleClient.list();
    return capsules.map(absolutize);
  }

  async create(input: CreateCapsuleInput) {
    return absolutize((await capsuleClient.create(input)).capsule);
  }

  async join(code: string) {
    const { capsule, already } = await capsuleClient.join(code);
    return { capsule: absolutize(capsule), already };
  }

  async addItem(capsuleId: string, input: NewItemInput) {
    const media = input.kind !== 'letter' && input.uri ? await readMedia(input.uri, input.kind) : undefined;
    const { capsule, item } = await capsuleClient.addItem(capsuleId, { kind: input.kind, text: input.text, durationMs: input.durationMs, media });
    return { capsule: absolutize(capsule), item };
  }

  async updateItem(capsuleId: string, itemId: string, patch: ItemPatch) {
    // 서버에서 받은 uri(절대 주소)는 그대로 두고, 기기에서 새로 고른 파일만 올린다.
    const media = patch.kind !== 'letter' && patch.uri && !patch.uri.startsWith(API_PREFIX) ? await readMedia(patch.uri, patch.kind) : undefined;
    const { capsule, item } = await capsuleClient.updateItem(capsuleId, itemId, { text: patch.text, durationMs: patch.durationMs, media });
    return { capsule: absolutize(capsule), item };
  }

  async removeItem(capsuleId: string, itemId: string): Promise<Capsule> {
    return absolutize((await capsuleClient.removeItem(capsuleId, itemId)).capsule);
  }

  async seal(capsuleId: string) {
    return absolutize((await capsuleClient.seal(capsuleId)).capsule);
  }

  async open(capsuleId: string) {
    return absolutize((await capsuleClient.open(capsuleId)).capsule);
  }

  async setDisplayName(name: string) {
    await capsuleClient.setDisplayName(name);
  }

  async plant(capsuleId: string, location: PlantedLocation) {
    return absolutize((await capsuleClient.plant(capsuleId, location)).capsule);
  }
}

const API_PREFIX = 'http';
