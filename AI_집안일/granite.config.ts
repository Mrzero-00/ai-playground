import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  // 앱인토스 콘솔에서 미니앱을 만든 뒤 콘솔의 appName과 동일하게 변경하세요.
  appName: 'ai-housework',
  brand: {
    displayName: 'AI 집안일',
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
  permissions: [],
  outdir: 'dist',
});
