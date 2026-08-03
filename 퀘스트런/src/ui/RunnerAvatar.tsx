import React from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import lumiAnimeBase from '../../assets/avatar/lumi-anime-base-v1.png';
import { getItemById, type GameItem, type ItemSlot } from '../domain/game';

interface RunnerAvatarProps {
  equippedItemIds: Partial<Record<ItemSlot, string>>;
  pose?: 'stand' | 'run';
  size?: number;
  style?: StyleProp<ViewStyle>;
}

const FACE_SLOTS: ItemSlot[] = ['eyes', 'nose', 'mouth'];

const EYE_GLYPHS: Record<string, string> = {
  'round-eyes': '●  ●',
  'sparkle-eyes': '✦  ✦',
  'smiley-eyes': '⌒  ⌒',
  'sleepy-eyes': '—  —',
};

const NOSE_GLYPHS: Record<string, string> = {
  'bean-nose': '•',
  'peach-nose': '▼',
  'button-nose': '●',
  'leaf-nose': '◆',
};

const MOUTH_GLYPHS: Record<string, string> = {
  'soft-smile': '⌣',
  'cat-mouth': 'ω',
  'open-smile': '▽',
  'surprised-mouth': '○',
};

export function RunnerAvatar({
  equippedItemIds,
  pose = 'stand',
  size = 220,
  style,
}: RunnerAvatarProps) {
  const unit = size / 220;
  const height = size * 1.28;
  const eyeId = equippedItemIds.eyes ?? 'round-eyes';
  const noseId = equippedItemIds.nose ?? 'bean-nose';
  const mouthId = equippedItemIds.mouth ?? 'soft-smile';
  const equippedItems = Object.values(equippedItemIds)
    .map((itemId) => (itemId == null ? undefined : getItemById(itemId)))
    .filter((item): item is GameItem => item != null);
  const decorations = equippedItems.filter(
    (item) => !FACE_SLOTS.includes(item.slot) && item.source !== 'starter'
  );

  return (
    <View
      accessibilityLabel="애니메이션 일러스트 스타일의 새싹 러너 루미. 눈, 코, 입과 러닝 아이템을 꾸밀 수 있습니다."
      style={[{ height, width: size }, style]}
    >
      <Image
        resizeMode="contain"
        source={lumiAnimeBase}
        style={[
          styles.base,
          {
            height: 296 * unit,
            left: 18 * unit,
            top: -7 * unit,
            transform: [{ rotate: pose === 'run' ? '-3deg' : '0deg' }],
            width: 184 * unit,
          },
        ]}
      />

      <View
        pointerEvents="none"
        style={[
          styles.faceLayer,
          {
            height: 57 * unit,
            left: 74 * unit,
            top: 67 * unit,
            transform: [{ rotate: pose === 'run' ? '-3deg' : '0deg' }],
            width: 72 * unit,
          },
        ]}
      >
        <View
          style={[
            styles.blush,
            { height: 7 * unit, left: 3 * unit, top: 32 * unit, width: 16 * unit },
          ]}
        />
        <View
          style={[
            styles.blush,
            { height: 7 * unit, right: 3 * unit, top: 32 * unit, width: 16 * unit },
          ]}
        />
        {eyeId === 'round-eyes' ? (
          <>
            <View
              style={[
                styles.animeEye,
                { height: 20 * unit, left: 9 * unit, top: 7 * unit, width: 16 * unit },
              ]}
            >
              <View
                style={[
                  styles.irisGlow,
                  { bottom: 1 * unit, height: 8 * unit, left: 2 * unit, width: 12 * unit },
                ]}
              />
              <View
                style={[
                  styles.eyeSparkle,
                  { height: 5 * unit, left: 3 * unit, top: 3 * unit, width: 5 * unit },
                ]}
              />
            </View>
            <View
              style={[
                styles.animeEye,
                { height: 20 * unit, right: 9 * unit, top: 7 * unit, width: 16 * unit },
              ]}
            >
              <View
                style={[
                  styles.irisGlow,
                  { bottom: 1 * unit, height: 8 * unit, left: 2 * unit, width: 12 * unit },
                ]}
              />
              <View
                style={[
                  styles.eyeSparkle,
                  { height: 5 * unit, left: 3 * unit, top: 3 * unit, width: 5 * unit },
                ]}
              />
            </View>
          </>
        ) : (
          <Text style={[styles.eyes, { fontSize: 13 * unit, top: 10 * unit }]}>
            {EYE_GLYPHS[eyeId] ?? EYE_GLYPHS['round-eyes']}
          </Text>
        )}
        <Text
          style={[
            styles.nose,
            noseId === 'leaf-nose' && styles.noseLeaf,
            noseId === 'peach-nose' && styles.nosePeach,
            { fontSize: 8 * unit, top: 28 * unit },
          ]}
        >
          {NOSE_GLYPHS[noseId] ?? NOSE_GLYPHS['bean-nose']}
        </Text>
        <Text
          style={[
            styles.mouth,
            { fontSize: (mouthId === 'surprised-mouth' ? 10 : 13) * unit, top: 39 * unit },
          ]}
        >
          {MOUTH_GLYPHS[mouthId] ?? MOUTH_GLYPHS['soft-smile']}
        </Text>
      </View>

      {decorations.map((item) => (
        <Text
          key={item.id}
          style={[
            styles.decoration,
            decorationPosition(item.slot, unit),
            { fontSize: (item.slot === 'watch' ? 18 : 29) * unit },
          ]}
        >
          {item.icon}
        </Text>
      ))}
    </View>
  );
}

function decorationPosition(slot: ItemSlot, unit: number): ViewStyle {
  const positions: Partial<Record<ItemSlot, ViewStyle>> = {
    head: { left: 93 * unit, top: 6 * unit },
    top: { left: 96 * unit, top: 144 * unit },
    bottom: { left: 96 * unit, top: 190 * unit },
    shoes: { bottom: 3 * unit, left: 92 * unit },
    glasses: { left: 91 * unit, top: 76 * unit },
    bag: { right: 36 * unit, top: 145 * unit },
    watch: { right: 47 * unit, top: 167 * unit },
  };

  return positions[slot] ?? {};
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
  },
  faceLayer: {
    position: 'absolute',
  },
  blush: {
    backgroundColor: '#F49AAA',
    borderRadius: 999,
    opacity: 0.42,
    position: 'absolute',
  },
  eyes: {
    color: '#783C52',
    fontWeight: '900',
    left: 0,
    letterSpacing: 4,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
    textShadowColor: 'rgba(255,255,255,0.65)',
    textShadowOffset: { height: 0, width: 0 },
    textShadowRadius: 2,
  },
  animeEye: {
    backgroundColor: '#71354F',
    borderColor: '#4D283B',
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'absolute',
  },
  irisGlow: {
    backgroundColor: '#DF748F',
    borderRadius: 999,
    opacity: 0.85,
    position: 'absolute',
  },
  eyeSparkle: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    position: 'absolute',
  },
  nose: {
    color: '#B9665B',
    fontWeight: '900',
    left: 0,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
  },
  noseLeaf: {
    color: '#39966E',
  },
  nosePeach: {
    color: '#E77965',
  },
  mouth: {
    color: '#A95061',
    fontWeight: '900',
    left: 0,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
  },
  decoration: {
    position: 'absolute',
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { height: 2, width: 0 },
    textShadowRadius: 3,
    zIndex: 10,
  },
});
