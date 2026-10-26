import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import type { CapsuleContent } from '../shared/contracts';

export type DraftPhoto = NonNullable<CapsuleContent['photo']> & { previewUri: string; temporaryUris: string[] };

export async function pickPhoto(): Promise<DraftPhoto | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 0.8 });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const processed = await ImageManipulator.manipulateAsync(
    asset.uri,
    asset.width > 1600 ? [{ resize: { width: 1600 } }] : [],
    { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  if (!processed.base64) throw new Error('사진을 준비하지 못했어요. 다른 사진으로 다시 시도해 주세요.');
  return { base64: processed.base64, mimeType: 'image/jpeg', previewUri: processed.uri, temporaryUris: [asset.uri, processed.uri] };
}

export async function discardPhoto(photo: DraftPhoto | null) {
  if (!photo || Platform.OS === 'web') return;
  await Promise.all(photo.temporaryUris.map(async uri => {
    // Delete only app-owned temporary copies, never the user's photo-library original.
    if (FileSystem.cacheDirectory && uri.startsWith(FileSystem.cacheDirectory)) {
      await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
    }
  }));
}
