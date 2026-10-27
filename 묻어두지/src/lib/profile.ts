import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const NAME_KEY = 'mudeodooji.display-name.v1';
const TONE_KEY = 'mudeodooji.avatar-tone.v1';
export const AVATAR_TONE_OPTIONS = ['yellow', 'sky', 'mint', 'coral'] as const;
export type AvatarTone = (typeof AVATAR_TONE_OPTIONS)[number];
export type Profile = { name: string; tone: AvatarTone };
export const NAME_MAX_CHARS = 12;
/** 이름을 아직 안 정했을 때 화면과 서버에 보이는 이름. */
export const FALLBACK_NAME = '나';

async function read(key: string) {
  try {
    return Platform.OS === 'web' ? globalThis.localStorage?.getItem(key) ?? null : await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function write(key: string, value: string | null) {
  try {
    if (Platform.OS === 'web') {
      if (value === null) globalThis.localStorage?.removeItem(key);
      else globalThis.localStorage?.setItem(key, value);
    } else if (value === null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // 저장이 막힌 환경(사생활 모드 등)에서는 조용히 넘어간다.
  }
}

function isTone(value: string | null): value is AvatarTone {
  return value !== null && (AVATAR_TONE_OPTIONS as readonly string[]).includes(value);
}

/** 캡슐에 보일 내 이름과 아바타 색. 아직 계정이 없어서 기기에만 저장한다. */
export const profile = {
  load: async (): Promise<Profile> => {
    const [name, tone] = await Promise.all([read(NAME_KEY), read(TONE_KEY)]);
    return { name: name?.trim() ?? '', tone: isTone(tone) ? tone : 'yellow' };
  },
  save: async ({ name, tone }: Profile) => {
    await Promise.all([write(NAME_KEY, name.trim() || null), write(TONE_KEY, tone)]);
  },
  /** 서버 세션을 만들 때 보낼 이름. */
  displayName: async () => (await read(NAME_KEY))?.trim() || FALLBACK_NAME,
  storage: { read, write },
};
