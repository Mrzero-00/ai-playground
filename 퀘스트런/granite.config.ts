import { appsInToss } from '@apps-in-toss/framework/plugins';
import { defineConfig } from '@granite-js/react-native/config';

export default defineConfig({
  scheme: 'intoss',
  appName: 'quest-run',
  plugins: [
    appsInToss({
      appType: 'game',
      brand: {
        displayName: '퀘스트런',
        primaryColor: '#16B87A',
        icon: '',
      },
      navigationBar: {
        theme: 'dark',
        transparentBackground: true,
        withTitle: false,
      },
      permissions: [
        {
          name: 'geolocation',
          access: 'access',
        },
      ],
    }),
  ],
});
