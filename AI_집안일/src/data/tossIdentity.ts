import { getAnonymousKey } from '@apps-in-toss/web-framework';

let userKeyPromise: Promise<string | null> | null = null;

function isTossWebView(): boolean {
  if (typeof window === 'undefined') return false;
  return 'ReactNativeWebView' in window || '__granite' in window;
}

async function readTossAnonymousKey(): Promise<string | null> {
  if (!isTossWebView()) return null;
  try {
    const result = await getAnonymousKey();
    return result && result !== 'ERROR' && result.type === 'HASH' ? result.hash : null;
  } catch {
    return null;
  }
}

export function getTossAnonymousKey(): Promise<string | null> {
  userKeyPromise ??= readTossAnonymousKey();
  return userKeyPromise;
}
