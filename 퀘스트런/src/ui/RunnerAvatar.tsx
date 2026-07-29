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
      accessibilityLabel="눈, 코, 입과 러닝 아이템을 꾸밀 수 있는 사람형 새싹 러너 루미"
      style={[{ height, width: size }, style]}
    >
      <View
        style={[
          styles.shadow,
          {
            bottom: 3 * unit,
            height: 22 * unit,
            left: 45 * unit,
            width: 130 * unit,
          },
        ]}
      />

      <View
        style={[
          styles.humanEar,
          {
            height: 28 * unit,
            left: 55 * unit,
            top: 65 * unit,
            width: 18 * unit,
          },
        ]}
      />
      <View
        style={[
          styles.humanEar,
          {
            height: 28 * unit,
            right: 55 * unit,
            top: 65 * unit,
            width: 18 * unit,
          },
        ]}
      />

      <View
        style={[
          styles.neck,
          {
            height: 20 * unit,
            left: 101 * unit,
            top: 122 * unit,
            width: 18 * unit,
          },
        ]}
      />

      <View
        style={[
          styles.body,
          {
            height: 88 * unit,
            left: 72 * unit,
            top: 132 * unit,
            width: 76 * unit,
          },
        ]}
      >
        <View
          style={[
            styles.shirtCollar,
            {
              height: 13 * unit,
              left: 23 * unit,
              top: 4 * unit,
              width: 30 * unit,
            },
          ]}
        />
        <View
          style={[
            styles.shorts,
            {
              bottom: 0,
              height: 31 * unit,
              left: 3 * unit,
              width: 70 * unit,
            },
          ]}
        />
      </View>

      <View
        style={[
          styles.arm,
          {
            height: 78 * unit,
            left: 55 * unit,
            top: 136 * unit,
            transform: [{ rotate: pose === 'run' ? '29deg' : '8deg' }],
            width: 20 * unit,
          },
        ]}
      />
      <View
        style={[
          styles.arm,
          {
            height: 78 * unit,
            right: 55 * unit,
            top: 136 * unit,
            transform: [{ rotate: pose === 'run' ? '-32deg' : '-8deg' }],
            width: 20 * unit,
          },
        ]}
      />

      <View
        style={[
          styles.leg,
          {
            bottom: 22 * unit,
            height: 68 * unit,
            left: 82 * unit,
            transform: [{ rotate: pose === 'run' ? '15deg' : '2deg' }],
            width: 20 * unit,
          },
        ]}
      />
      <View
        style={[
          styles.leg,
          {
            bottom: 22 * unit,
            height: 68 * unit,
            right: 82 * unit,
            transform: [{ rotate: pose === 'run' ? '-18deg' : '-2deg' }],
            width: 20 * unit,
          },
        ]}
      />
      <View
        style={[
          styles.shoe,
          {
            bottom: 7 * unit,
            height: 22 * unit,
            left: pose === 'run' ? 66 * unit : 73 * unit,
            transform: [{ rotate: pose === 'run' ? '-6deg' : '0deg' }],
            width: 40 * unit,
          },
        ]}
      />
      <View
        style={[
          styles.shoe,
          {
            bottom: 7 * unit,
            height: 22 * unit,
            right: pose === 'run' ? 66 * unit : 73 * unit,
            transform: [{ rotate: pose === 'run' ? '6deg' : '0deg' }],
            width: 40 * unit,
          },
        ]}
      />

      <View
        style={[
          styles.head,
          {
            height: 105 * unit,
            left: 65 * unit,
            top: 27 * unit,
            width: 90 * unit,
          },
        ]}
      >
        <View
          style={[
            styles.facePatch,
            {
              height: 84 * unit,
              left: 8 * unit,
              top: 15 * unit,
              width: 74 * unit,
            },
          ]}
        />
        <View
          style={[
            styles.blush,
            {
              height: 8 * unit,
              left: 12 * unit,
              top: 62 * unit,
              width: 16 * unit,
            },
          ]}
        />
        <View
          style={[
            styles.blush,
            {
              height: 8 * unit,
              right: 12 * unit,
              top: 62 * unit,
              width: 16 * unit,
            },
          ]}
        />
        <Text
          style={[
            styles.eyes,
            {
              fontSize: (eyeId === 'round-eyes' ? 17 : 14) * unit,
              top: 39 * unit,
            },
          ]}
        >
          {EYE_GLYPHS[eyeId] ?? EYE_GLYPHS['round-eyes']}
        </Text>
        {eyeId === 'round-eyes' ? (
          <Text style={[styles.eyeShine, { fontSize: 6 * unit, top: 42 * unit }]}>•       •</Text>
        ) : null}
        <Text
          style={[
            styles.nose,
            noseId === 'leaf-nose' && styles.noseLeaf,
            noseId === 'peach-nose' && styles.nosePeach,
            {
              fontSize: 10 * unit,
              top: 58 * unit,
            },
          ]}
        >
          {NOSE_GLYPHS[noseId] ?? NOSE_GLYPHS['bean-nose']}
        </Text>
        <Text
          style={[
            styles.mouth,
            {
              fontSize: (mouthId === 'surprised-mouth' ? 12 : 15) * unit,
              top: 73 * unit,
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
            height: 25 * unit,
            left: 107 * unit,
            top: 6 * unit,
            width: 6 * unit,
          },
        ]}
      />
      <View
        style={[
          styles.sproutLeaf,
          {
            height: 21 * unit,
            left: 83 * unit,
            top: 2 * unit,
            transform: [{ rotate: '27deg' }],
            width: 31 * unit,
          },
        ]}
      />
      <View
        style={[
          styles.sproutLeaf,
          {
            height: 21 * unit,
            right: 83 * unit,
            top: 2 * unit,
            transform: [{ rotate: '-27deg' }],
            width: 31 * unit,
          },
        ]}
      />

      {decorations.map((item) => (
        <Text
          key={item.id}
          style={[
            styles.decoration,
            decorationPosition(item.slot, unit),
            { fontSize: (item.slot === 'watch' ? 20 : 30) * unit },
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
    head: { left: 95 * unit, top: 17 * unit },
    top: { left: 95 * unit, top: 153 * unit },
    bottom: { left: 95 * unit, top: 191 * unit },
    shoes: { bottom: 1 * unit, left: 92 * unit },
    glasses: { left: 95 * unit, top: 61 * unit },
    bag: { right: 49 * unit, top: 153 * unit },
    watch: { right: 59 * unit, top: 177 * unit },
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
  humanEar: {
    backgroundColor: '#F2BD82',
    borderColor: '#A9653F',
    borderRadius: 999,
    borderWidth: 2,
    position: 'absolute',
  },
  neck: {
    backgroundColor: '#F2BD82',
    borderColor: '#A9653F',
    borderRadius: 999,
    borderWidth: 2,
    position: 'absolute',
  },
  body: {
    backgroundColor: '#52C6AE',
    borderColor: '#236D67',
    borderRadius: 26,
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
    backgroundColor: '#D98C52',
    borderColor: '#A9653F',
    borderRadius: 38,
    borderWidth: 3,
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
