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
    usesAppleSignIn: true,
    ...(googleMapsIos ? { config: { googleMapsApiKey: googleMapsIos } } : {}),
    infoPlist: {
      // The PoC API lives on the developer's Mac. Production replaces it with HTTPS
      // and removes these exceptions.
      NSLocalNetworkUsageDescription: '같은 Wi-Fi에 있는 개발 서버에 캡슐을 보관하고 공개 조건을 확인해요.',
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
      backgroundColor: '#FFF6E5',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    ...(googleMapsAndroid ? { config: { googleMaps: { apiKey: googleMapsAndroid } } } : {}),
  },
  // single: 클라이언트 라우팅. static 내보내기는 시간 의존 화면에서 하이드레이션 불일치를 낸다.
  web: { output: 'single', favicon: './assets/images/favicon.png' },
  plugins: [
    'expo-router',
    'expo-dev-client',
    'expo-apple-authentication',
    ['expo-splash-screen', { backgroundColor: '#FFF6E5', image: './assets/images/splash-icon.png', imageWidth: 76 }],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
        locationWhenInUsePermission: '캡슐을 심은 자리를 저장하고 현장에서 확인하기 위해 현재 위치를 사용합니다.',
        motionUsagePermission: false,
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
        isAndroidMotionActivityEnabled: false,
      },
    ],
    ['expo-audio', { microphonePermission: '캡슐에 넣을 목소리를 녹음하기 위해 마이크를 사용합니다.' }],
    ['expo-video', { supportsBackgroundPlayback: false, supportsPictureInPicture: false }],
    [
      'expo-image-picker',
      {
        photosPermission: '캡슐에 넣을 사진과 동영상을 고르기 위해 사진 보관함을 사용합니다.',
        cameraPermission: '캡슐에 넣을 사진과 동영상을 찍고, 현장에서 AR로 캡슐을 찾기 위해 카메라를 사용합니다.',
        microphonePermission: '동영상의 소리를 녹음하기 위해 마이크를 사용합니다.',
      },
    ],
    // The device session token is stored without biometrics: no Face ID prompt.
    ['expo-secure-store', { configureAndroidBackup: true, faceIDPermission: false }],
    [
      '@reactvision/react-viro',
      {
        // No cloud anchors or geospatial API yet: the capsule is re-placed on the floor
        // the camera sees today. "none" also keeps ReactVision/ARCore keys out.
        provider: 'none',
        android: { xRMode: ['AR'] },
        iosLinkage: 'static',
        ios: {
          cameraUsagePermission: '캡슐에 넣을 사진과 동영상을 찍고, 현장에서 AR로 캡슐을 찾기 위해 카메라를 사용합니다.',
          // Viro fills every key it does not receive with English placeholder text.
          microphoneUsagePermission: '캡슐에 넣을 목소리를 녹음하기 위해 마이크를 사용합니다.',
          photosPermission: '캡슐에 넣을 사진과 동영상을 고르기 위해 사진 보관함을 사용합니다.',
          savePhotosPermission: '꺼낸 캡슐의 사진을 기기에 저장할 때 사용합니다.',
          locationUsagePermission: '캡슐을 심은 자리를 저장하고 현장에서 확인하기 위해 현재 위치를 사용합니다.',
        },
      },
    ],
    ['expo-build-properties', { android: { usesCleartextTraffic: true } }],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
};

export default config;
