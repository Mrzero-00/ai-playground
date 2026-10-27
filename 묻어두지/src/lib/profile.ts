import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const NAME_KEY = 'mudeodooji.display-name.v1';
export const DEFAULT_DISPLAY_NAME = '상길';

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

/** 캡슐에 보일 내 이름. 아직 계정이 없어서 기기에만 저장한다. */
export const profile = {
  displayName: async () => (await read(NAME_KEY)) || DEFAULT_DISPLAY_NAME,
  setDisplayName: (name: string) => write(NAME_KEY, name.trim() || null),
  storage: { read, write },
};
