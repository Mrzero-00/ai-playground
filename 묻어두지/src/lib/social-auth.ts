import * as AppleAuthentication from 'expo-apple-authentication';
import { AuthRequest, ResponseType, exchangeCodeAsync, makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import type { LoginInput } from '@/shared/capsule-api';
import { BackendError } from '@/state/backend';

WebBrowser.maybeCompleteAuthSession();

export const GOOGLE_CLIENT_IDS = {
  web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
};
export const KAKAO_REST_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_KEY;

const KAKAO = { authorizationEndpoint: 'https://kauth.kakao.com/oauth/authorize', tokenEndpoint: 'https://kauth.kakao.com/oauth/token' };
const GOOGLE = { authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth', tokenEndpoint: 'https://oauth2.googleapis.com/token' };

/** 이 기기에서 쓸 수 있는 구글 클라이언트 ID. 플랫폼별로 따로 발급한다. */
export function googleClientId() {
  return Platform.OS === 'web' ? GOOGLE_CLIENT_IDS.web : Platform.OS === 'ios' ? GOOGLE_CLIENT_IDS.ios : GOOGLE_CLIENT_IDS.android;
}

export function redirectUri() {
  return makeRedirectUri({ scheme: 'mudeodooji', path: 'login' });
}

function cancelled(): never {
  throw new BackendError('AUTH_FAILED', '로그인을 취소했어요.');
}

/** 구글: 인가 코드 → id_token 교환(PKCE). 서버는 id_token 의 aud 를 확인한다. */
export async function signInWithGoogle(): Promise<LoginInput> {
  const clientId = googleClientId();
  if (!clientId) throw new BackendError('PROVIDER_DISABLED', '이 기기용 구글 클라이언트 ID 가 아직 없어요.');
  const request = new AuthRequest({ clientId, redirectUri: redirectUri(), responseType: ResponseType.Code, scopes: ['openid', 'profile', 'email'], usePKCE: true });
  const result = await request.promptAsync(GOOGLE);
  if (result.type !== 'success') cancelled();
  const token = await exchangeCodeAsync({ clientId, code: result.params.code, redirectUri: redirectUri(), extraParams: { code_verifier: request.codeVerifier ?? '' } }, GOOGLE);
  if (!token.idToken) throw new BackendError('AUTH_FAILED', '구글에서 id_token 을 받지 못했어요.');
  return { provider: 'google', idToken: token.idToken };
}

/** 카카오: 인가 코드 → access_token. 서버는 kapi 로 사용자 정보를 확인한다. */
export async function signInWithKakao(): Promise<LoginInput> {
  if (!KAKAO_REST_KEY) throw new BackendError('PROVIDER_DISABLED', '카카오 REST API 키가 아직 없어요.');
  const request = new AuthRequest({ clientId: KAKAO_REST_KEY, redirectUri: redirectUri(), responseType: ResponseType.Code, usePKCE: false });
  const result = await request.promptAsync(KAKAO);
  if (result.type !== 'success') cancelled();
  const token = await exchangeCodeAsync({ clientId: KAKAO_REST_KEY, code: result.params.code, redirectUri: redirectUri() }, KAKAO);
  return { provider: 'kakao', accessToken: token.accessToken };
}

/** 애플: iOS 네이티브 시트. identityToken 과(첫 로그인에만 오는) 이름을 서버로 보낸다. */
export async function signInWithApple(): Promise<LoginInput> {
  if (Platform.OS !== 'ios' || !(await AppleAuthentication.isAvailableAsync())) throw new BackendError('PROVIDER_DISABLED', 'Apple 로그인은 iPhone 에서만 돼요.');
  try {
    const credential = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL] });
    if (!credential.identityToken) throw new BackendError('AUTH_FAILED', 'Apple 에서 토큰을 받지 못했어요.');
    const fullName = [credential.fullName?.familyName, credential.fullName?.givenName].filter(Boolean).join('') || null;
    return { provider: 'apple', idToken: credential.identityToken, fullName };
  } catch (cause) {
    if (cause instanceof BackendError) throw cause;
    cancelled();
  }
}
