import { GowunDodum_400Regular } from '@expo-google-fonts/gowun-dodum';
import { Jua_400Regular } from '@expo-google-fonts/jua';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { Colors } from '@/constants/theme';
import { API_URL } from '@/lib/capsule-client';
import { CapsuleStoreProvider } from '@/state/capsule-store';
import { LocalBackend } from '@/state/local-backend';
import { RemoteBackend } from '@/state/remote-backend';
import { SEED_CAPSULES } from '@/state/seed';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Jua_400Regular, GowunDodum_400Regular });
  // 서버 주소가 있으면 서버, 없으면(배포 웹 미리보기) 시드 데이터를 가진 로컬 백엔드.
  const [backend] = useState(() => (API_URL ? new RemoteBackend() : new LocalBackend({ initial: SEED_CAPSULES })));

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <CapsuleStoreProvider backend={backend}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.cream } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="map" />
        <Stack.Screen name="capsules" />
        <Stack.Screen name="create" />
        <Stack.Screen name="join" options={{ presentation: 'modal' }} />
        <Stack.Screen name="capsule/[id]/index" />
        <Stack.Screen name="capsule/[id]/add/[kind]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="capsule/[id]/invite" />
        <Stack.Screen name="capsule/[id]/seal" />
        <Stack.Screen name="capsule/[id]/countdown" options={{ gestureEnabled: false }} />
        <Stack.Screen name="capsule/[id]/next" />
        <Stack.Screen name="capsule/[id]/plant" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="capsule/[id]/find" options={{ presentation: 'fullScreenModal' }} />
      </Stack>
    </CapsuleStoreProvider>
  );
}
