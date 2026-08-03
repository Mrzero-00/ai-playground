import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import lumiAnimeBase from '../../assets/avatar/lumi-anime-base-v1.png';
import moriAnimeBase from '../../assets/avatar/lumi-anime-boy-base-v1.png';
import berryLeggingsLayer from '../../assets/avatar/layers/bottom-berry-leggings-v1.png';
import plumTwintailLayer from '../../assets/avatar/layers/hair-plum-twintail-v1.png';
import starSneakersLayer from '../../assets/avatar/layers/shoes-star-v1.png';
import cloudHoodieLayer from '../../assets/avatar/layers/top-cloud-hoodie-v1.png';
import {
  getAvatarPresetDefinition,
  getItemById,
  type AvatarPreset,
  type GameItem,
  type ItemSlot,
} from '../domain/game';

interface RunnerAvatarProps {
  avatarPreset?: AvatarPreset;
  equippedItemIds: Partial<Record<ItemSlot, string>>;
  pose?: 'stand' | 'run';
  size?: number;
  style?: StyleProp<ViewStyle>;
}

const FACE_SLOTS: ItemSlot[] = ['eyes', 'nose', 'mouth'];

interface AvatarLayerConfig {
  height: number;
  left: number;
  source: ImageSourcePropType;
  top: number;
  width: number;
  zIndex: number;
}

const AVATAR_LAYERS: Record<string, AvatarLayerConfig> = {
  'berry-leggings': {
    height: 90,
    left: 42,
    source: berryLeggingsLayer,
    top: 164,
    width: 135,
    zIndex: 1,
  },
  'star-sneakers': {
    height: 126,
    left: 70,
    source: starSneakersLayer,
    top: 184,
    width: 83,
    zIndex: 2,
  },
  'cloud-hoodie': {
    height: 181,
    left: 51,
    source: cloudHoodieLayer,
    top: 62,
    width: 117,
    zIndex: 3,
  },
  'plum-twintail': {
    height: 240,
    left: 48,
    source: plumTwintailLayer,
    top: -23,
    width: 134,
    zIndex: 4,
  },
};

const LAYER_SLOT_ORDER: ItemSlot[] = ['bottom', 'shoes', 'top', 'hair'];

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
  avatarPreset = 'lumi',
  equippedItemIds,
  pose = 'stand',
  size = 220,
  style,
}: RunnerAvatarProps) {
  const unit = size / 220;
  const height = size * 1.28;
  const avatarDefinition = getAvatarPresetDefinition(avatarPreset);
  const avatarBase = avatarPreset === 'mori' ? moriAnimeBase : lumiAnimeBase;
  const eyeId = equippedItemIds.eyes ?? 'round-eyes';
  const noseId = equippedItemIds.nose ?? 'bean-nose';
  const mouthId = equippedItemIds.mouth ?? 'soft-smile';
  const equippedItems = Object.values(equippedItemIds)
    .map((itemId) => (itemId == null ? undefined : getItemById(itemId)))
    .filter((item): item is GameItem => item != null);
  const visualLayers = LAYER_SLOT_ORDER.map((slot) => equippedItemIds[slot])
    .map((itemId) => (itemId == null ? undefined : AVATAR_LAYERS[itemId]))
    .filter((layer): layer is AvatarLayerConfig => layer != null);
  const decorations = equippedItems.filter(
    (item) =>
      !FACE_SLOTS.includes(item.slot) &&
      AVATAR_LAYERS[item.id] == null &&
      item.source !== 'starter'
  );

  return (
    <View
      accessibilityLabel={`애니메이션 일러스트 스타일의 새싹 러너 ${avatarDefinition.name}. 눈, 코, 입과 러닝 아이템을 꾸밀 수 있습니다.`}
      style={[{ height, width: size }, style]}
    >
      <Image
        resizeMode="contain"
        source={avatarBase}
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

      {visualLayers.map((layer) => (
        <Image
          key={`${layer.source}-${layer.zIndex}`}
          resizeMode="contain"
          source={layer.source}
          style={[
            styles.avatarLayer,
            {
              height: layer.height * unit,
              left: layer.left * unit,
              top: layer.top * unit,
              transform: [{ rotate: pose === 'run' ? '-3deg' : '0deg' }],
              width: layer.width * unit,
              zIndex: layer.zIndex,
            },
          ]}
        />
      ))}

      <View
        pointerEvents="none"
        style={[
          styles.faceLayer,
          {
            height: 57 * unit,
            left: (avatarPreset === 'mori' ? 79 : 75) * unit,
            top: 68 * unit,
            transform: [{ rotate: pose === 'run' ? '-3deg' : '0deg' }],
            width: 72 * unit,
          },
        ]}
      >
        <View
          style={[
            styles.blush,
            { height: 7 * unit, left: 5 * unit, top: 32 * unit, width: 15 * unit },
          ]}
        />
        <View
          style={[
            styles.blush,
            { height: 7 * unit, right: 5 * unit, top: 32 * unit, width: 15 * unit },
          ]}
        />
        {eyeId === 'round-eyes' ? (
          <>
            <View
              style={[
                styles.animeEye,
                { height: 19 * unit, left: 11 * unit, top: 10 * unit, width: 15 * unit },
              ]}
            >
              <View
                style={[
                  styles.irisGlow,
                  { bottom: 1 * unit, height: 7 * unit, left: 2 * unit, width: 11 * unit },
                ]}
              />
              <View
                style={[
                  styles.eyeSparkle,
                  { height: 4 * unit, left: 3 * unit, top: 3 * unit, width: 4 * unit },
                ]}
              />
            </View>
            <View
              style={[
                styles.animeEye,
                { height: 19 * unit, right: 11 * unit, top: 10 * unit, width: 15 * unit },
              ]}
            >
              <View
                style={[
                  styles.irisGlow,
                  { bottom: 1 * unit, height: 7 * unit, left: 2 * unit, width: 11 * unit },
                ]}
              />
              <View
                style={[
                  styles.eyeSparkle,
                  { height: 4 * unit, left: 3 * unit, top: 3 * unit, width: 4 * unit },
                ]}
              />
            </View>
          </>
        ) : (
          <Text style={[styles.eyes, { fontSize: 12 * unit, top: 14 * unit }]}>
            {EYE_GLYPHS[eyeId] ?? EYE_GLYPHS['round-eyes']}
          </Text>
        )}
        <Text
          style={[
            styles.nose,
            noseId === 'leaf-nose' && styles.noseLeaf,
            noseId === 'peach-nose' && styles.nosePeach,
            { fontSize: 8 * unit, top: 29 * unit },
          ]}
        >
          {NOSE_GLYPHS[noseId] ?? NOSE_GLYPHS['bean-nose']}
        </Text>
        <Text
          style={[
            styles.mouth,
            { fontSize: (mouthId === 'surprised-mouth' ? 9 : 12) * unit, top: 36 * unit },
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
    hair: { left: 91 * unit, top: 18 * unit },
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
    zIndex: 0,
  },
  avatarLayer: {
    position: 'absolute',
  },
  faceLayer: {
    position: 'absolute',
    zIndex: 6,
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
    letterSpacing: 3,
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
