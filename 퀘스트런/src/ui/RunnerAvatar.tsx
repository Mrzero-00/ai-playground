import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
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
  const height = size * 1.14;
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
      accessibilityLabel="눈, 코, 입과 러닝 아이템을 꾸밀 수 있는 숲마을 치비 러너 루미"
      style={[{ height, width: size }, style]}
    >
      <View
        style={[
          styles.shadow,
          {
            bottom: 3 * unit,
            height: 25 * unit,
            left: 30 * unit,
            width: 160 * unit,
          },
        ]}
      />

      <View
        style={[
          styles.backEar,
          {
            height: 54 * unit,
            left: 24 * unit,
            top: 61 * unit,
            transform: [{ rotate: '-18deg' }],
            width: 43 * unit,
          },
        ]}
      />
      <View
        style={[
          styles.backEar,
          {
            height: 54 * unit,
            right: 24 * unit,
            top: 61 * unit,
            transform: [{ rotate: '18deg' }],
            width: 43 * unit,
          },
        ]}
      />

      <View
        style={[
          styles.body,
          {
            height: 91 * unit,
            left: 59 * unit,
            top: 139 * unit,
            width: 102 * unit,
          },
        ]}
      >
        <View
          style={[
            styles.shirtCollar,
            {
              height: 15 * unit,
              left: 31 * unit,
              top: 4 * unit,
              width: 40 * unit,
            },
          ]}
        />
        <View
          style={[
            styles.shorts,
            {
              bottom: 0,
              height: 34 * unit,
              left: 5 * unit,
              width: 92 * unit,
            },
          ]}
        />
      </View>

      <View
        style={[
          styles.arm,
          {
            height: 62 * unit,
            left: 45 * unit,
            top: 145 * unit,
            transform: [{ rotate: pose === 'run' ? '34deg' : '13deg' }],
            width: 27 * unit,
          },
        ]}
      />
      <View
        style={[
          styles.arm,
          {
            height: 62 * unit,
            right: 45 * unit,
            top: 145 * unit,
            transform: [{ rotate: pose === 'run' ? '-38deg' : '-13deg' }],
            width: 27 * unit,
          },
        ]}
      />

      <View
        style={[
          styles.leg,
          {
            bottom: 19 * unit,
            height: 44 * unit,
            left: 72 * unit,
            transform: [{ rotate: pose === 'run' ? '22deg' : '4deg' }],
            width: 28 * unit,
          },
        ]}
      />
      <View
        style={[
          styles.leg,
          {
            bottom: 19 * unit,
            height: 44 * unit,
            right: 72 * unit,
            transform: [{ rotate: pose === 'run' ? '-27deg' : '-4deg' }],
            width: 28 * unit,
          },
        ]}
      />
      <View
        style={[
          styles.shoe,
          {
            bottom: 9 * unit,
            height: 24 * unit,
            left: pose === 'run' ? 55 * unit : 65 * unit,
            transform: [{ rotate: pose === 'run' ? '-8deg' : '0deg' }],
            width: 48 * unit,
          },
        ]}
      />
      <View
        style={[
          styles.shoe,
          {
            bottom: 9 * unit,
            height: 24 * unit,
            right: pose === 'run' ? 55 * unit : 65 * unit,
            transform: [{ rotate: pose === 'run' ? '8deg' : '0deg' }],
            width: 48 * unit,
          },
        ]}
      />

      <View
        style={[
          styles.head,
          {
            height: 139 * unit,
            left: 34 * unit,
            top: 31 * unit,
            width: 152 * unit,
          },
        ]}
      >
        <View
          style={[
            styles.facePatch,
            {
              height: 105 * unit,
              left: 15 * unit,
              top: 25 * unit,
              width: 122 * unit,
            },
          ]}
        />
        <View
          style={[
            styles.blush,
            {
              height: 12 * unit,
              left: 23 * unit,
              top: 80 * unit,
              width: 24 * unit,
            },
          ]}
        />
        <View
          style={[
            styles.blush,
            {
              height: 12 * unit,
              right: 23 * unit,
              top: 80 * unit,
              width: 24 * unit,
            },
          ]}
        />
        <Text
          style={[
            styles.eyes,
            {
              fontSize: (eyeId === 'round-eyes' ? 24 : 20) * unit,
              top: 48 * unit,
            },
          ]}
        >
          {EYE_GLYPHS[eyeId] ?? EYE_GLYPHS['round-eyes']}
        </Text>
        {eyeId === 'round-eyes' ? (
          <Text style={[styles.eyeShine, { fontSize: 10 * unit, top: 52 * unit }]}>•       •</Text>
        ) : null}
        <Text
          style={[
            styles.nose,
            noseId === 'leaf-nose' && styles.noseLeaf,
            noseId === 'peach-nose' && styles.nosePeach,
            {
              fontSize: 16 * unit,
              top: 76 * unit,
            },
          ]}
        >
          {NOSE_GLYPHS[noseId] ?? NOSE_GLYPHS['bean-nose']}
        </Text>
        <Text
          style={[
            styles.mouth,
            {
              fontSize: (mouthId === 'surprised-mouth' ? 17 : 22) * unit,
              top: 92 * unit,
            },
          ]}
        >
          {MOUTH_GLYPHS[mouthId] ?? MOUTH_GLYPHS['soft-smile']}
        </Text>
      </View>

      <View
        style={[
          styles.sproutStem,
          {
            height: 30 * unit,
            left: 107 * unit,
            top: 7 * unit,
            width: 7 * unit,
          },
        ]}
      />
      <View
        style={[
          styles.sproutLeaf,
          {
            height: 25 * unit,
            left: 78 * unit,
            top: 3 * unit,
            transform: [{ rotate: '27deg' }],
            width: 36 * unit,
          },
        ]}
      />
      <View
        style={[
          styles.sproutLeaf,
          {
            height: 25 * unit,
            right: 78 * unit,
            top: 3 * unit,
            transform: [{ rotate: '-27deg' }],
            width: 36 * unit,
          },
        ]}
      />

      {decorations.map((item) => (
        <Text
          key={item.id}
          style={[
            styles.decoration,
            decorationPosition(item.slot, unit),
            { fontSize: (item.slot === 'watch' ? 24 : 34) * unit },
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
    head: { left: 89 * unit, top: 20 * unit },
    top: { left: 92 * unit, top: 158 * unit },
    bottom: { left: 92 * unit, top: 192 * unit },
    shoes: { bottom: 3 * unit, left: 85 * unit },
    glasses: { left: 91 * unit, top: 79 * unit },
    bag: { right: 35 * unit, top: 153 * unit },
    watch: { right: 48 * unit, top: 174 * unit },
  };

  return positions[slot] ?? {};
}

const styles = StyleSheet.create({
  shadow: {
    backgroundColor: 'rgba(5, 33, 38, 0.2)',
    borderRadius: 999,
    position: 'absolute',
    transform: [{ scaleY: 0.5 }],
  },
  backEar: {
    backgroundColor: '#E9A96F',
    borderColor: '#A9653F',
    borderRadius: 999,
    borderWidth: 3,
    position: 'absolute',
  },
  body: {
    backgroundColor: '#52C6AE',
    borderColor: '#236D67',
    borderRadius: 999,
    borderWidth: 3,
    overflow: 'hidden',
    position: 'absolute',
  },
  shirtCollar: {
    alignSelf: 'center',
    backgroundColor: '#E8FFF7',
    borderBottomLeftRadius: 999,
    borderBottomRightRadius: 999,
    position: 'absolute',
  },
  shorts: {
    backgroundColor: '#244863',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    position: 'absolute',
  },
  arm: {
    backgroundColor: '#F2BD82',
    borderColor: '#A9653F',
    borderRadius: 999,
    borderWidth: 3,
    position: 'absolute',
  },
  leg: {
    backgroundColor: '#F2BD82',
    borderColor: '#A9653F',
    borderRadius: 999,
    borderWidth: 3,
    position: 'absolute',
  },
  shoe: {
    backgroundColor: '#FF8A4C',
    borderColor: '#9C4A2A',
    borderRadius: 999,
    borderWidth: 3,
    position: 'absolute',
  },
  head: {
    backgroundColor: '#F2BD82',
    borderColor: '#A9653F',
    borderRadius: 999,
    borderWidth: 4,
    overflow: 'hidden',
    position: 'absolute',
  },
  facePatch: {
    backgroundColor: '#FFE0AE',
    borderRadius: 999,
    position: 'absolute',
  },
  blush: {
    backgroundColor: '#F39B8A',
    borderRadius: 999,
    opacity: 0.55,
    position: 'absolute',
  },
  eyes: {
    color: '#173F4A',
    fontWeight: '900',
    left: 0,
    letterSpacing: 4,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
    zIndex: 2,
  },
  eyeShine: {
    color: '#FFFFFF',
    fontWeight: '900',
    left: 0,
    letterSpacing: 8,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
    zIndex: 3,
  },
  nose: {
    color: '#A85F3B',
    fontWeight: '900',
    left: 0,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
    zIndex: 3,
  },
  noseLeaf: {
    color: '#39966E',
  },
  nosePeach: {
    color: '#E77965',
  },
  mouth: {
    color: '#8F4836',
    fontWeight: '900',
    left: 0,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
    zIndex: 3,
  },
  sproutStem: {
    backgroundColor: '#3A8E50',
    borderColor: '#206234',
    borderRadius: 999,
    borderWidth: 1,
    position: 'absolute',
  },
  sproutLeaf: {
    backgroundColor: '#74BE54',
    borderColor: '#2D7139',
    borderRadius: 999,
    borderWidth: 2,
    position: 'absolute',
  },
  decoration: {
    position: 'absolute',
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { height: 2, width: 0 },
    textShadowRadius: 3,
    zIndex: 10,
  },
});
