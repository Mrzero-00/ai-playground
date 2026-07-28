/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ENABLE_DEMO_DATA?: string;
  readonly VITE_TERMS_URL?: string;
  readonly VITE_PRIVACY_URL?: string;
  readonly VITE_SUPPORT_URL?: string;
  readonly VITE_TOSS_SHOPPING_URL_TEMPLATE?: string;
  readonly VITE_PROFILE_SHARE_URL?: string;
  readonly VITE_TOSS_SHARE_DEEPLINK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
