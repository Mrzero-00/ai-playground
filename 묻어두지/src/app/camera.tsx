import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useCapsuleStore, type DraftPhoto } from '@/state/capsule-store';

/** One photo for the capsule being written. The bytes stay in memory until sealing. */
export default function CameraScreen() {
  const { draft, updateDraft } = useCapsuleStore();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [takingPhoto, setTakingPhoto] = useState(false);
  const [captured, setCaptured] = useState<DraftPhoto | null>(draft.photo);
  const [cameraError, setCameraError] = useState<string | null>(null);

  async function takePhoto() {
    if (!cameraReady || !cameraRef.current || takingPhoto) return;
    setTakingPhoto(true);
    setCameraError(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.72, base64: true, skipProcessing: Platform.OS === 'android' });
      if (!photo.base64) throw new Error('no base64');
      const base64 = photo.base64.replace(/^data:[^,]*,/, '').replace(/\s/g, '');
      setCaptured({ uri: Platform.OS === 'web' ? `data:image/jpeg;base64,${base64}` : photo.uri, base64, mimeType: 'image/jpeg' });
    } catch {
      setCameraError('사진을 찍지 못했어요. 카메라를 다시 열어볼까요?');
    } finally {
      setTakingPhoto(false);
    }
  }

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator color={Colors.earth} /></View>;
  }

  if (!permission.granted) {
    const askForPermission = permission.canAskAgain ? requestPermission : Linking.openSettings;
    return (
      <SafeAreaView style={styles.permissionPage} edges={['bottom']}>
        <View style={styles.permissionIcon}><Text style={styles.permissionIconText}>▣</Text></View>
        <Text style={styles.permissionTitle}>사진을 넣으려면{`\n`}카메라가 필요해요</Text>
        <Text style={styles.permissionBody}>찍은 사진은 봉인할 때 한 번 서버로 보내고, 꺼낼 때까지 아무도 볼 수 없어요.</Text>
        <Pressable accessibilityRole="button" onPress={askForPermission} style={({ pressed }) => [styles.permissionButton, pressed && styles.pressed]}>
          <Text style={styles.permissionButtonText}>{permission.canAskAgain ? '카메라 허용하기' : '설정에서 카메라 열기'}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (captured) {
    return (
      <View style={styles.reviewPage}>
        <View style={styles.reviewContent}>
          <Image source={{ uri: captured.uri }} style={styles.previewImage} resizeMode="cover" />
          <View style={styles.reviewCopy}>
            <Text style={styles.reviewEyebrow}>미래의 친구들에게</Text>
            <Text style={styles.reviewTitle}>이 사진으로 할까요?</Text>
          </View>
          <View style={styles.reviewActions}>
            <Pressable accessibilityRole="button" onPress={() => setCaptured(null)} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Text style={styles.secondaryButtonText}>다시 찍기</Text>
            </Pressable>
            <Pressable accessibilityRole="button"
              onPress={() => { updateDraft({ photo: captured }); router.back(); }}
              style={({ pressed }) => [styles.submitButton, pressed && styles.pressed]}>
              <Text style={styles.submitButtonText}>이 사진 넣기</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.cameraPage}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        onCameraReady={() => setCameraReady(true)}
        onMountError={() => setCameraError('카메라를 열지 못했어요. 권한과 다른 카메라 앱 사용 여부를 확인해주세요.')}
      />
      <View style={styles.cameraShade} pointerEvents="none" />
      <SafeAreaView style={styles.cameraOverlay} edges={['bottom']}>
        <View style={styles.cameraPrompt}>
          <Text style={styles.cameraPromptTitle}>증거 사진 한 장</Text>
          <Text style={styles.cameraPromptBody}>미래의 우리가 보고 웃을 장면이면 충분해요.</Text>
        </View>
        <View style={styles.shutterRow}>
          <View style={styles.shutterSpacer} />
          <Pressable accessibilityRole="button"
            accessibilityLabel="사진 촬영"
            disabled={!cameraReady || takingPhoto}
            onPress={() => void takePhoto()}
            style={({ pressed }) => [styles.shutterOuter, pressed && styles.shutterPressed]}>
            {takingPhoto ? <ActivityIndicator color={Colors.earthDark} /> : <View style={styles.shutterInner} />}
          </Pressable>
          <View style={styles.shutterSpacer}><Text style={styles.onePhoto}>1장만</Text></View>
        </View>
        {cameraError && (
          <View style={styles.cameraError}>
            <Text style={styles.cameraErrorText}>{cameraError}</Text>
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.cameraErrorButton}>
              <Text style={styles.cameraErrorButtonText}>돌아가기</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.canvas },
  permissionPage: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.canvas, padding: Spacing.xl },
  permissionIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.leafSoft, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  permissionIconText: { color: Colors.earthDark, fontSize: 34, fontWeight: '800' },
  permissionTitle: { color: Colors.ink, fontSize: 24, fontWeight: '900', lineHeight: 33, textAlign: 'center', letterSpacing: -0.7 },
  permissionBody: { maxWidth: 360, color: Colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: Spacing.md },
  permissionButton: { marginTop: Spacing.xl, minHeight: 56, width: '100%', maxWidth: 360, borderRadius: Radius.md, backgroundColor: Colors.earthDark, alignItems: 'center', justifyContent: 'center' },
  permissionButtonText: { color: Colors.white, fontSize: 15, fontWeight: '900' },
  cameraPage: { flex: 1, backgroundColor: '#000' },
  cameraShade: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.12)' },
  cameraOverlay: { flex: 1, justifyContent: 'space-between', padding: Spacing.lg },
  cameraPrompt: { alignSelf: 'center', marginTop: Spacing.md, backgroundColor: 'rgba(39,36,31,0.76)', borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, alignItems: 'center' },
  cameraPromptTitle: { color: Colors.white, fontSize: 17, fontWeight: '900' },
  cameraPromptBody: { color: '#EDE8DF', fontSize: 12, marginTop: 5 },
  shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  shutterSpacer: { flex: 1, alignItems: 'center' },
  shutterOuter: { width: 82, height: 82, borderRadius: 41, backgroundColor: 'rgba(255,255,255,0.88)', borderWidth: 4, borderColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: Colors.surface, borderWidth: 2, borderColor: '#CFC8BC' },
  shutterPressed: { transform: [{ scale: 0.94 }] },
  onePhoto: { color: Colors.white, fontSize: 12, fontWeight: '800', backgroundColor: 'rgba(39,36,31,0.65)', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14 },
  cameraError: { position: 'absolute', left: Spacing.lg, right: Spacing.lg, bottom: 130, borderRadius: Radius.md, backgroundColor: 'rgba(39,36,31,0.9)', padding: Spacing.md, gap: Spacing.sm },
  cameraErrorText: { color: Colors.white, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  cameraErrorButton: { alignSelf: 'flex-start', borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.white, paddingHorizontal: 12, paddingVertical: 7 },
  cameraErrorButtonText: { color: Colors.white, fontSize: 11, fontWeight: '900' },
  reviewPage: { flex: 1, backgroundColor: Colors.canvas, alignItems: 'center' },
  reviewContent: { width: '100%', maxWidth: MaxContentWidth, flex: 1, padding: Spacing.lg },
  previewImage: { width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.lg, backgroundColor: Colors.line },
  reviewCopy: { marginTop: Spacing.lg },
  reviewEyebrow: { color: Colors.leaf, fontSize: 12, fontWeight: '900' },
  reviewTitle: { color: Colors.ink, fontSize: 21, fontWeight: '900', marginTop: 5, letterSpacing: -0.4 },
  reviewActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 'auto', paddingTop: Spacing.lg },
  secondaryButton: { flex: 1, minHeight: 56, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.earthDark, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: Colors.earthDark, fontSize: 14, fontWeight: '900' },
  submitButton: { flex: 2, minHeight: 56, borderRadius: Radius.md, backgroundColor: Colors.earthDark, alignItems: 'center', justifyContent: 'center' },
  submitButtonText: { color: Colors.white, fontSize: 14, fontWeight: '900' },
  pressed: { opacity: 0.72 },
});
