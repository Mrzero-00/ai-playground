import React from 'react';
import { render } from '@testing-library/react-native';
import { AVATAR_FACE_LAYOUTS, RunnerAvatar } from './RunnerAvatar';
import type { AvatarPreset, ItemSlot } from '../domain/game';

const FACE_VARIANTS: Array<Partial<Record<ItemSlot, string>>> = [
  { eyes: 'round-eyes', mouth: 'soft-smile', nose: 'bean-nose' },
  { eyes: 'sparkle-eyes', mouth: 'cat-mouth', nose: 'peach-nose' },
  { eyes: 'smiley-eyes', mouth: 'open-smile', nose: 'button-nose' },
  { eyes: 'sleepy-eyes', mouth: 'surprised-mouth', nose: 'leaf-nose' },
];

describe('RunnerAvatar 얼굴 정렬', () => {
  it.each(['lumi', 'mori'] as AvatarPreset[])('%s의 양쪽 눈을 얼굴 중심에 대칭 배치한다', (preset) => {
    const { features, frame } = AVATAR_FACE_LAYOUTS[preset];
    const faceCenterX = frame.left + frame.width / 2;
    const leftEyeCenterX = frame.left + features.eyeInset + 15 / 2;
    const rightEyeCenterX = frame.left + frame.width - features.eyeInset - 15 / 2;

    expect((leftEyeCenterX + rightEyeCenterX) / 2).toBe(faceCenterX);
    expect(rightEyeCenterX - leftEyeCenterX).toBeGreaterThanOrEqual(27);
    expect(rightEyeCenterX - leftEyeCenterX).toBeLessThanOrEqual(29);
  });

  it.each(['lumi', 'mori'] as AvatarPreset[])('%s의 눈·코·입을 위에서 아래 순서로 정렬한다', (preset) => {
    const { features, frame } = AVATAR_FACE_LAYOUTS[preset];
    const eyeCenterY = frame.top + features.roundEyeTop + 19 / 2;
    const noseCenterY = frame.top + features.noseTop + 8 / 2;
    const mouthLineY = frame.top + features.mouthTop + 6;

    expect(eyeCenterY).toBeLessThan(noseCenterY);
    expect(noseCenterY).toBeLessThan(mouthLineY);
    expect(mouthLineY - eyeCenterY).toBeGreaterThanOrEqual(13);
    expect(mouthLineY - eyeCenterY).toBeLessThanOrEqual(15);
  });

  it.each(['lumi', 'mori'] as AvatarPreset[])('%s에서 모든 얼굴 파츠 조합을 렌더링한다', (preset) => {
    const view = render(<RunnerAvatar avatarPreset={preset} equippedItemIds={FACE_VARIANTS[0]!} size={220} />);

    for (const equippedItemIds of FACE_VARIANTS) {
      view.rerender(<RunnerAvatar avatarPreset={preset} equippedItemIds={equippedItemIds} size={220} />);
      expect(view.toJSON()).not.toBeNull();
    }
  });
});
