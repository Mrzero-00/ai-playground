import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'ppira-ppira-ppi',
  brand: {
    displayName: '삐라삐라삐',
    primaryColor: '#3D5AFE',
    // 콘솔 등록 후 실제 서비스 아이콘 URL로 교체합니다.
    icon: 'https://static.toss.im/icons/png/4x/icon-letter.png',
  },
  web: {
    host: 'localhost',
    port: 5174,
    commands: {
      dev: 'vite --host',
      build: 'vite build',
    },
  },
  permissions: [
    { name: 'geolocation', access: 'access' },
    { name: 'camera', access: 'access' },
  ],
  outdir: 'dist',
  webViewProps: {
    type: 'partner',
  },
});
