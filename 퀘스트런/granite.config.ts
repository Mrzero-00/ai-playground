import { appsInToss } from '@apps-in-toss/framework/plugins';
import { defineConfig } from '@granite-js/react-native/config';

const appName = process.env.AIT_APP_NAME ?? 'quest-run';
const brandIconUrl = process.env.AIT_BRAND_ICON_URL ?? '';

export default defineConfig({
  scheme: 'intoss',
  appName,
  plugins: [
    appsInToss({
      appType: 'general',
      brand: {
        displayName: '퀘스트런',
        primaryColor: '#16B87A',
        icon: brandIconUrl,
      },
      navigationBar: {
        theme: 'light',
        transparentBackground: false,
        withBackButton: true,
        withHomeButton: true,
        withTitle: true,
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
