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
      accessibilityLabel="눈, 코, 입과 러닝 아이템을 꾸밀 수 있는 2.5등신 SD 새싹 러너 루미"
      style={[{ height, width: size }, style]}
    >
      <View
        style={[
          styles.shadow,
          {
            bottom: 2 * unit,
            height: 24 * unit,
            left: 35 * unit,
            width: 150 * unit,
          },
        ]}
      />

      <View
        style={[
          styles.leg,
          {
            height: 54 * unit,
            left: 73 * unit,
            top: 198 * unit,
            transform: [{ rotate: pose === 'run' ? '13deg' : '2deg' }],
            width: 27 * unit,
          },
        ]}
      >
        <View style={[styles.sock, { bottom: 0, height: 19 * unit, width: 27 * unit }]} />
      </View>
      <View
        style={[
          styles.leg,
          {
            height: 54 * unit,
            right: 73 * unit,
            top: 198 * unit,
            transform: [{ rotate: pose === 'run' ? '-15deg' : '-2deg' }],
            width: 27 * unit,
          },
        ]}
      >
        <View style={[styles.sock, { bottom: 0, height: 19 * unit, width: 27 * unit }]} />
      </View>

      <View
        style={[
          styles.shoe,
          {
            bottom: 6 * unit,
            height: 28 * unit,
            left: pose === 'run' ? 51 * unit : 57 * unit,
            transform: [{ rotate: pose === 'run' ? '-8deg' : '-2deg' }],
            width: 50 * unit,
          },
        ]}
      >
        <View
          style={[
            styles.shoeHighlight,
            { height: 8 * unit, left: 9 * unit, top: 5 * unit, width: 21 * unit },
          ]}
        />
        <View style={[styles.shoeSole, { bottom: 1 * unit, height: 6 * unit, width: 44 * unit }]} />
      </View>
      <View
        style={[
          styles.shoe,
          {
            bottom: 6 * unit,
            height: 28 * unit,
            right: pose === 'run' ? 51 * unit : 57 * unit,
            transform: [{ rotate: pose === 'run' ? '8deg' : '2deg' }],
            width: 50 * unit,
          },
        ]}
      >
        <View
          style={[
            styles.shoeHighlight,
            { height: 8 * unit, left: 9 * unit, top: 5 * unit, width: 21 * unit },
          ]}
        />
        <View style={[styles.shoeSole, { bottom: 1 * unit, height: 6 * unit, width: 44 * unit }]} />
      </View>

      <View
        style={[
          styles.hood,
          {
            height: 55 * unit,
            left: 57 * unit,
            top: 118 * unit,
            width: 106 * unit,
          },
        ]}
      />

      <View
        style={[
          styles.arm,
          {
            height: 70 * unit,
            left: 45 * unit,
            top: 132 * unit,
            transform: [{ rotate: pose === 'run' ? '28deg' : '8deg' }],
            width: 29 * unit,
          },
        ]}
      >
        <View style={[styles.cuff, { bottom: 9 * unit, height: 14 * unit, width: 25 * unit }]} />
        <View
          style={[
            styles.hand,
            { bottom: -4 * unit, height: 25 * unit, left: 0, width: 25 * unit },
          ]}
        />
      </View>
      <View
        style={[
          styles.arm,
          {
            height: 70 * unit,
            right: 45 * unit,
            top: 132 * unit,
            transform: [{ rotate: pose === 'run' ? '-31deg' : '-8deg' }],
            width: 29 * unit,
          },
        ]}
      >
        <View style={[styles.cuff, { bottom: 9 * unit, height: 14 * unit, width: 25 * unit }]} />
        <View
          style={[
            styles.hand,
            { bottom: -4 * unit, height: 25 * unit, right: 0, width: 25 * unit },
          ]}
        />
      </View>

      <View
        style={[
          styles.torso,
          {
            height: 79 * unit,
            left: 64 * unit,
            top: 126 * unit,
            width: 92 * unit,
          },
        ]}
      >
        <View
          style={[
            styles.collar,
            { height: 16 * unit, left: 27 * unit, top: 3 * unit, width: 38 * unit },
          ]}
        />
        <View
          style={[
            styles.bodyHighlight,
            { height: 47 * unit, left: 10 * unit, top: 16 * unit, width: 13 * unit },
          ]}
        />
        <View
          style={[
            styles.drawstring,
            { height: 22 * unit, left: 39 * unit, top: 15 * unit, transform: [{ rotate: '5deg' }] },
          ]}
        />
        <View
          style={[
            styles.drawstring,
            { height: 22 * unit, right: 39 * unit, top: 15 * unit, transform: [{ rotate: '-5deg' }] },
          ]}
        />
        <View
          style={[
            styles.kangarooPocket,
            { bottom: 10 * unit, height: 23 * unit, left: 22 * unit, width: 48 * unit },
          ]}
        />
      </View>

      <View
        style={[
          styles.shorts,
          {
            height: 39 * unit,
            left: 69 * unit,
            top: 187 * unit,
            width: 82 * unit,
          },
        ]}
      >
        <View style={[styles.shortSeam, { height: 27 * unit, left: 39 * unit, top: 10 * unit }]} />
      </View>

      <View
        style={[
          styles.ear,
          { height: 30 * unit, left: 36 * unit, top: 61 * unit, width: 25 * unit },
        ]}
      />
      <View
        style={[
          styles.ear,
          { height: 30 * unit, right: 36 * unit, top: 61 * unit, width: 25 * unit },
        ]}
      />
      <View
        style={[
          styles.neck,
          { height: 20 * unit, left: 99 * unit, top: 113 * unit, width: 22 * unit },
        ]}
      />

      <View
        style={[
          styles.head,
          {
            height: 104 * unit,
            left: 45 * unit,
            top: 22 * unit,
            width: 130 * unit,
          },
        ]}
      >
        <View
          style={[
            styles.face,
            { height: 88 * unit, left: 9 * unit, top: 10 * unit, width: 112 * unit },
          ]}
        />
        <View
          style={[
            styles.hairCap,
            { height: 40 * unit, left: -2 * unit, top: -3 * unit, width: 134 * unit },
          ]}
        />
        <View
          style={[
            styles.bang,
            {
              height: 28 * unit,
              left: 16 * unit,
              top: 19 * unit,
              transform: [{ rotate: '18deg' }],
              width: 37 * unit,
            },
          ]}
        />
        <View
          style={[
            styles.bang,
            {
              height: 26 * unit,
              left: 48 * unit,
              top: 19 * unit,
              transform: [{ rotate: '-9deg' }],
              width: 34 * unit,
            },
          ]}
        />
        <View
          style={[
            styles.faceGlow,
            {
              height: 33 * unit,
              left: 12 * unit,
              top: 38 * unit,
              transform: [{ rotate: '-15deg' }],
              width: 10 * unit,
            },
          ]}
        />
        <View
          style={[
            styles.blush,
            { height: 9 * unit, left: 19 * unit, top: 69 * unit, width: 20 * unit },
          ]}
        />
        <View
          style={[
            styles.blush,
            { height: 9 * unit, right: 19 * unit, top: 69 * unit, width: 20 * unit },
          ]}
        />
        <Text
          style={[
            styles.eyes,
            { fontSize: (eyeId === 'round-eyes' ? 18 : 15) * unit, top: 47 * unit },
          ]}
        >
          {EYE_GLYPHS[eyeId] ?? EYE_GLYPHS['round-eyes']}
        </Text>
        {eyeId === 'round-eyes' ? (
          <Text style={[styles.eyeShine, { fontSize: 6 * unit, top: 49 * unit }]}>•       •</Text>
        ) : null}
        <Text
          style={[
            styles.nose,
            noseId === 'leaf-nose' && styles.noseLeaf,
            noseId === 'peach-nose' && styles.nosePeach,
            { fontSize: 10 * unit, top: 66 * unit },
          ]}
        >
          {NOSE_GLYPHS[noseId] ?? NOSE_GLYPHS['bean-nose']}
        </Text>
        <Text
          style={[
            styles.mouth,
            { fontSize: (mouthId === 'surprised-mouth' ? 12 : 15) * unit, top: 79 * unit },
          ]}
        >
          {MOUTH_GLYPHS[mouthId] ?? MOUTH_GLYPHS['soft-smile']}
        </Text>
      </View>

      <View
        style={[
          styles.sproutStem,
          { height: 20 * unit, left: 107 * unit, top: 8 * unit, width: 6 * unit },
        ]}
      />
      <View
        style={[
          styles.sproutLeaf,
          {
            height: 22 * unit,
            left: 82 * unit,
            top: 1 * unit,
            transform: [{ rotate: '25deg' }],
            width: 35 * unit,
          },
        ]}
      />
      <View
        style={[
          styles.sproutLeaf,
          {
            height: 22 * unit,
            right: 82 * unit,
            top: 1 * unit,
            transform: [{ rotate: '-25deg' }],
            width: 35 * unit,
          },
        ]}
      />

      {decorations.map((item) => (
        <Text
          key={item.id}
          style={[
            styles.decoration,
            decorationPosition(item.slot, unit),
            { fontSize: (item.slot === 'watch' ? 20 : 31) * unit },
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
    head: { left: 87 * unit, top: 7 * unit },
    top: { left: 94 * unit, top: 146 * unit },
    bottom: { left: 94 * unit, top: 190 * unit },
    shoes: { bottom: 1 * unit, left: 90 * unit },
    glasses: { left: 88 * unit, top: 59 * unit },
    bag: { right: 39 * unit, top: 145 * unit },
    watch: { right: 51 * unit, top: 171 * unit },
  };

  return positions[slot] ?? {};
}

const styles = StyleSheet.create({
  shadow: {
    backgroundColor: 'rgba(5, 33, 38, 0.22)',
    borderRadius: 999,
    position: 'absolute',
    transform: [{ scaleY: 0.48 }],
  },
  leg: {
    backgroundColor: '#F4BB91',
    borderColor: '#C8795D',
    borderRadius: 999,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'absolute',
  },
  sock: {
    backgroundColor: '#F7FFF9',
    borderTopColor: '#BBDDD3',
    borderTopWidth: 2,
    position: 'absolute',
  },
  shoe: {
    alignItems: 'center',
    backgroundColor: '#FFF9EE',
    borderColor: '#796B65',
    borderRadius: 999,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'absolute',
  },
  shoeHighlight: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    opacity: 0.9,
    position: 'absolute',
  },
  shoeSole: {
    backgroundColor: '#FF8352',
    borderRadius: 999,
    position: 'absolute',
  },
  hood: {
    backgroundColor: '#118B76',
    borderColor: '#086655',
    borderRadius: 999,
    borderWidth: 2,
    position: 'absolute',
  },
  arm: {
    backgroundColor: '#46CEAD',
    borderColor: '#0C7E6A',
    borderRadius: 999,
    borderWidth: 2,
    position: 'absolute',
  },
  cuff: {
    backgroundColor: '#BDF4E4',
    borderRadius: 999,
    position: 'absolute',
  },
  hand: {
    backgroundColor: '#FFD1AE',
    borderColor: '#C8795D',
    borderRadius: 999,
    borderWidth: 2,
    position: 'absolute',
  },
  torso: {
    backgroundColor: '#46CEAD',
    borderColor: '#0C7E6A',
    borderRadius: 29,
    borderWidth: 3,
    overflow: 'hidden',
    position: 'absolute',
  },
  collar: {
    backgroundColor: '#F2FFF9',
    borderBottomLeftRadius: 999,
    borderBottomRightRadius: 999,
    position: 'absolute',
  },
  bodyHighlight: {
    backgroundColor: 'rgba(255,255,255,0.23)',
    borderRadius: 999,
    position: 'absolute',
    transform: [{ rotate: '8deg' }],
  },
  drawstring: {
    backgroundColor: '#E9FFF8',
    borderRadius: 999,
    position: 'absolute',
    width: 2,
  },
  kangarooPocket: {
    borderBottomColor: 'rgba(5, 105, 88, 0.45)',
    borderBottomWidth: 2,
    borderLeftColor: 'rgba(5, 105, 88, 0.24)',
    borderLeftWidth: 1,
    borderRadius: 999,
    borderRightColor: 'rgba(5, 105, 88, 0.24)',
    borderRightWidth: 1,
    position: 'absolute',
  },
  shorts: {
    backgroundColor: '#264C68',
    borderColor: '#17384F',
    borderRadius: 17,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'absolute',
  },
  shortSeam: {
    borderLeftColor: 'rgba(255,255,255,0.2)',
    borderLeftWidth: 2,
    position: 'absolute',
    width: 2,
  },
  ear: {
    backgroundColor: '#FFD1AE',
    borderColor: '#C8795D',
    borderRadius: 999,
    borderWidth: 2,
    position: 'absolute',
  },
  neck: {
    backgroundColor: '#FFD1AE',
    borderColor: '#C8795D',
    borderRadius: 999,
    borderWidth: 2,
    position: 'absolute',
  },
  head: {
    backgroundColor: '#5A3E38',
    borderColor: '#3F2C29',
    borderRadius: 46,
    borderWidth: 3,
    overflow: 'hidden',
    position: 'absolute',
  },
  face: {
    backgroundColor: '#FFD7B8',
    borderColor: '#E9A980',
    borderRadius: 999,
    borderWidth: 1,
    position: 'absolute',
  },
  hairCap: {
    backgroundColor: '#5A3E38',
    borderBottomColor: '#3F2C29',
    borderBottomWidth: 2,
    borderRadius: 999,
    position: 'absolute',
  },
  bang: {
    backgroundColor: '#5A3E38',
    borderBottomLeftRadius: 999,
    borderBottomRightRadius: 999,
    position: 'absolute',
  },
  faceGlow: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 999,
    position: 'absolute',
    zIndex: 2,
  },
  blush: {
    backgroundColor: '#F4968D',
    borderRadius: 999,
    opacity: 0.52,
    position: 'absolute',
  },
  eyes: {
    color: '#173F4A',
    fontWeight: '900',
    left: 0,
    letterSpacing: 5,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
    zIndex: 3,
  },
  eyeShine: {
    color: '#FFFFFF',
    fontWeight: '900',
    left: 0,
    letterSpacing: 10,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
    zIndex: 4,
  },
  nose: {
    color: '#A85F3B',
    fontWeight: '900',
    left: 0,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
    zIndex: 4,
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
    zIndex: 4,
  },
  sproutStem: {
    backgroundColor: '#3A8E50',
    borderColor: '#206234',
    borderRadius: 999,
    borderWidth: 1,
    position: 'absolute',
  },
  sproutLeaf: {
    backgroundColor: '#80D65D',
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
