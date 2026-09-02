import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'hangang-letter',
  brand: {
    displayName: '한강에서 온 편지',
    primaryColor: '#2E6F95',
    // 콘솔 등록 후 실제 서비스 아이콘 URL로 교체합니다.
    icon: 'https://static.toss.im/icons/png/4x/icon-letter.png',
  },
  web: {
    host: 'localhost',
    port: 5173,
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
