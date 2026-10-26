import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { Colors } from '@/constants/theme';
import { CapsuleStoreProvider } from '@/state/capsule-store';

export default function RootLayout() {
  return (
    <CapsuleStoreProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: Colors.canvas },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: Colors.canvas },
          headerTintColor: Colors.ink,
          headerTitleStyle: { fontWeight: '800' },
          headerBackButtonDisplayMode: 'minimal',
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="map" options={{ headerShown: false }} />
        <Stack.Screen name="create" options={{ title: '새 구덩이' }} />
        <Stack.Screen name="pick-spot" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="camera" options={{ title: '사진 넣기', presentation: 'modal' }} />
        <Stack.Screen name="pit/[id]" options={{ title: '구덩이' }} />
        <Stack.Screen name="open/[id]" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      </Stack>
    </CapsuleStoreProvider>
  );
}
