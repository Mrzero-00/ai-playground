import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'jiptori',
  brand: {
    displayName: '집토리',
    primaryColor: '#3182F6',
    // 콘솔에 아이콘을 등록한 뒤 이미지 URL을 입력하세요.
    icon: '',
  },
  web: {
    host: 'localhost',
    port: 5173,
    commands: {
      dev: 'vite',
      build: 'tsc -b && vite build',
    },
  },
  webViewProps: {
    type: 'partner',
  },
  navigationBar: {
    withBackButton: true,
    withHomeButton: true,
    withTitle: true,
    transparentBackground: false,
    theme: 'light',
  },
  permissions: [],
  outdir: 'dist',
});
