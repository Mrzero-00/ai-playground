import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: '묻어두지',
  slug: 'mudeoduji',
  scheme: 'mudeoduji',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: 'com.mudeoduji.prototype',
    supportsTablet: false,
    infoPlist: {
      NSLocalNetworkUsageDescription: '같은 Wi-Fi에 있는 개발 서버에 추억을 보관하고 개봉 조건을 확인해요.',
      // Development API access is restricted to loopback and private LAN ranges.
      // Production must replace the local API with HTTPS and remove these exceptions.
      NSAppTransportSecurity: {
        NSAllowsLocalNetworking: true,
        NSExceptionDomains: Object.fromEntries(
          ['127.0.0.1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'].map(host => [host, {
            NSExceptionAllowsInsecureHTTPLoads: true,
          }]),
        ),
      },
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.mudeoduji.prototype',
    ...(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
      ? { config: { googleMaps: { apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY } } }
      : {}),
  },
  web: { name: '묻어두지 · 기능 검증', bundler: 'metro' },
  plugins: [
    'expo-dev-client',
    'expo-secure-store',
    ['expo-camera', { cameraPermission: '캡슐을 묻고 다시 찾을 때 AR 카메라를 사용해요.', recordAudioAndroid: false }],
    ['expo-location', { locationWhenInUsePermission: '캡슐을 묻은 장소를 기록하고, 같은 장소에 돌아왔는지 확인해요.' }],
    ['expo-image-picker', {
      photosPermission: '타임캡슐에 담을 사진과 영상을 선택해요.',
      cameraPermission: '캡슐을 묻고 다시 찾을 때 AR 카메라를 사용해요.',
      microphonePermission: '미래에 전할 목소리를 녹음할 때 마이크를 사용해요.',
    }],
    ['@reactvision/react-viro', {
      android: { xRMode: 'AR' },
      ios: {
        cameraUsagePermission: '캡슐을 묻고 다시 찾을 때 AR 카메라를 사용해요.',
        photosPermission: '타임캡슐에 담을 사진과 영상을 선택해요.',
      },
    }],
    ['expo-audio', {
      microphonePermission: '미래에 전할 목소리를 녹음할 때 마이크를 사용해요.',
      recordAudioAndroid: true,
      enableBackgroundPlayback: false,
      enableBackgroundRecording: false,
    }],
    ['expo-video', { supportsBackgroundPlayback: false, supportsPictureInPicture: false }],
    ['expo-build-properties', { android: { usesCleartextTraffic: true } }],
  ],
};

export default config;
