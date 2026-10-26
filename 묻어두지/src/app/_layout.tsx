import { GowunDodum_400Regular } from '@expo-google-fonts/gowun-dodum';
import { Jua_400Regular } from '@expo-google-fonts/jua';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Colors } from '@/constants/theme';
import { CapsuleStoreProvider } from '@/state/capsule-store';
import { SEED_CAPSULES } from '@/state/seed';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Jua_400Regular, GowunDodum_400Regular });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <CapsuleStoreProvider initialCapsules={SEED_CAPSULES}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.cream } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="create" />
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
