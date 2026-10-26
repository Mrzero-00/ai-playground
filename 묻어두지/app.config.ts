import type { ExpoConfig } from 'expo/config';

// Google Maps keys are platform-restricted (iOS bundle ID, Android package + SHA-1).
// They are not secrets but they stay out of git: copy .env.example to .env.
const googleMapsIos = process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY;
const googleMapsAndroid = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY;

const config: ExpoConfig = {
  name: '묻어두지',
  slug: 'mudeodooji',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'mudeodooji',
  userInterfaceStyle: 'light',
  ios: {
    icon: './assets/expo.icon',
    bundleIdentifier: 'com.mudeodooji.app',
    supportsTablet: false,
    ...(googleMapsIos ? { config: { googleMapsApiKey: googleMapsIos } } : {}),
    infoPlist: {
      // The PoC API lives on the developer's Mac. Production replaces it with HTTPS
      // and removes these exceptions.
      NSLocalNetworkUsageDescription: '같은 Wi-Fi에 있는 개발 서버에 구덩이를 보관하고 공개 조건을 확인해요.',
      NSAppTransportSecurity: {
        NSAllowsLocalNetworking: true,
        NSExceptionDomains: Object.fromEntries(
          ['127.0.0.1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'].map((host) => [host, { NSExceptionAllowsInsecureHTTPLoads: true }]),
        ),
      },
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.mudeodooji.app',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    ...(googleMapsAndroid ? { config: { googleMaps: { apiKey: googleMapsAndroid } } } : {}),
  },
  web: { output: 'static', favicon: './assets/images/favicon.png' },
  plugins: [
    'expo-router',
    'expo-dev-client',
    ['expo-splash-screen', { backgroundColor: '#F6F0E3', image: './assets/images/splash-icon.png', imageWidth: 76 }],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
        locationWhenInUsePermission: '약속 장소를 등록하고 현장에서 확인하기 위해 현재 위치를 사용합니다.',
        motionUsagePermission: false,
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
        isAndroidMotionActivityEnabled: false,
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: '캡슐에 넣을 사진을 촬영하고, 현장에서 AR로 캡슐을 찾기 위해 카메라를 사용합니다.',
        microphonePermission: false,
        recordAudioAndroid: false,
        barcodeScannerEnabled: false,
      },
    ],
    // The device session token is stored without biometrics: no Face ID prompt.
    ['expo-secure-store', { configureAndroidBackup: true, faceIDPermission: false }],
    [
      '@reactvision/react-viro',
      {
        // No cloud anchors or geospatial API: the capsule is re-placed on the floor
        // the camera sees today. "none" also keeps ReactVision/ARCore keys out.
        provider: 'none',
        android: { xRMode: ['AR'] },
        ios: {
          cameraUsagePermission: '캡슐에 넣을 사진을 촬영하고, 현장에서 AR로 캡슐을 찾기 위해 카메라를 사용합니다.',
          // Viro fills every key it does not receive with English placeholder text.
          microphoneUsagePermission: '묻어두지는 마이크를 사용하지 않아요.',
          photosPermission: '캡슐에 넣을 사진을 고를 때 사진 보관함을 사용합니다.',
          savePhotosPermission: '꺼낸 캡슐의 사진을 기기에 저장할 때 사용합니다.',
          locationUsagePermission: '약속 장소를 등록하고 현장에서 확인하기 위해 현재 위치를 사용합니다.',
        },
      },
    ],
    ['expo-build-properties', { android: { usesCleartextTraffic: true } }],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
};

export default config;
