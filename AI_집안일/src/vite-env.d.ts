/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TOSS_SHOPPING_URL_TEMPLATE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
