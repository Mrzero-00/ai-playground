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
import moriAnimeBase from '../../assets/avatar/lumi-anime-boy-base-v2.png';
import berryLeggingsLayer from '../../assets/avatar/layers/bottom-berry-leggings-v1.png';
import berryMoriLayer from '../../assets/avatar/layers/bottom-berry-mori-v1.png';
import midnightTrackLayer from '../../assets/avatar/layers/bottom-midnight-track-v1.png';
import plumTwintailLayer from '../../assets/avatar/layers/hair-plum-twintail-v1.png';
import plumMoriLayer from '../../assets/avatar/layers/hair-plum-mori-v1.png';
import silverWolfLayer from '../../assets/avatar/layers/hair-silver-wolf-v1.png';
import silverWolfMoriLayer from '../../assets/avatar/layers/hair-silver-wolf-mori-v1.png';
import mintCometShoesLayer from '../../assets/avatar/layers/shoes-mint-comet-v1.png';
import starSneakersLayer from '../../assets/avatar/layers/shoes-star-v1.png';
import starSneakersMoriLayer from '../../assets/avatar/layers/shoes-star-mori-v1.png';
import cloudHoodieLayer from '../../assets/avatar/layers/top-cloud-hoodie-v1.png';
import cloudHoodieMoriLayer from '../../assets/avatar/layers/top-cloud-mori-v1.png';
import sunsetWindbreakerLayer from '../../assets/avatar/layers/top-sunset-windbreaker-v1.png';
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

interface AvatarLayerLayout {
  height: number;
  left: number;
  top: number;
  width: number;
}

interface AvatarLayerConfig {
  layouts: Record<AvatarPreset, AvatarLayerLayout>;
  resizeMode?: 'contain' | 'stretch';
  sources: Record<AvatarPreset, ImageSourcePropType>;
  zIndex: number;
}

const AVATAR_LAYERS: Record<string, AvatarLayerConfig> = {
  'berry-leggings': {
    layouts: {
      lumi: { height: 90, left: 42, top: 164, width: 135 },
      mori: { height: 86, left: 50, top: 161, width: 120 },
    },
    sources: { lumi: berryLeggingsLayer, mori: berryMoriLayer },
    zIndex: 1,
  },
  'midnight-track-pants': {
    layouts: {
      lumi: { height: 140, left: 45, top: 148, width: 130 },
      mori: { height: 136, left: 51, top: 150, width: 118 },
    },
    resizeMode: 'stretch',
    sources: { lumi: midnightTrackLayer, mori: midnightTrackLayer },
    zIndex: 1,
  },
  'star-sneakers': {
    layouts: {
      lumi: { height: 126, left: 70, top: 184, width: 83 },
      mori: { height: 116, left: 64, top: 190, width: 93 },
    },
    sources: { lumi: starSneakersLayer, mori: starSneakersMoriLayer },
    zIndex: 2,
  },
  'mint-comet-shoes': {
    layouts: {
      lumi: { height: 126, left: 68, top: 184, width: 86 },
      mori: { height: 116, left: 64, top: 190, width: 94 },
    },
    sources: { lumi: mintCometShoesLayer, mori: mintCometShoesLayer },
    zIndex: 2,
  },
  'cloud-hoodie': {
    layouts: {
      lumi: { height: 181, left: 51, top: 62, width: 117 },
      mori: { height: 174, left: 47, top: 68, width: 126 },
    },
    sources: { lumi: cloudHoodieLayer, mori: cloudHoodieMoriLayer },
    zIndex: 3,
  },
  'sunset-windbreaker': {
    layouts: {
      lumi: { height: 181, left: 50, top: 63, width: 120 },
      mori: { height: 174, left: 47, top: 68, width: 126 },
    },
    sources: { lumi: sunsetWindbreakerLayer, mori: sunsetWindbreakerLayer },
    zIndex: 3,
  },
  'plum-twintail': {
    layouts: {
      lumi: { height: 240, left: 48, top: -23, width: 134 },
      mori: { height: 211, left: 48, top: -7, width: 128 },
    },
    sources: { lumi: plumTwintailLayer, mori: plumMoriLayer },
    zIndex: 4,
  },
  'silver-wolf-hair': {
    layouts: {
      lumi: { height: 260, left: 37, top: -28, width: 154 },
      mori: { height: 245, left: 37, top: -33, width: 147 },
    },
    sources: { lumi: silverWolfLayer, mori: silverWolfMoriLayer },
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
  const isMori = avatarPreset === 'mori';
  const faceLayout = isMori
    ? { height: 59, left: 75, top: 66, width: 74 }
    : { height: 57, left: 75, top: 68, width: 72 };
  const facePositions = isMori
    ? { blushTop: 34, eyeTop: 15, mouthTop: 40, noseTop: 31, roundEyeTop: 11 }
    : { blushTop: 32, eyeTop: 14, mouthTop: 36, noseTop: 29, roundEyeTop: 10 };
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
          key={`${layer.sources[avatarPreset]}-${layer.zIndex}`}
          resizeMode={layer.resizeMode ?? 'contain'}
          source={layer.sources[avatarPreset]}
          style={[
            styles.avatarLayer,
            {
              height: layer.layouts[avatarPreset].height * unit,
              left: layer.layouts[avatarPreset].left * unit,
              top: layer.layouts[avatarPreset].top * unit,
              transform: [{ rotate: pose === 'run' ? '-3deg' : '0deg' }],
              width: layer.layouts[avatarPreset].width * unit,
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
            height: faceLayout.height * unit,
            left: faceLayout.left * unit,
            top: faceLayout.top * unit,
            transform: [{ rotate: pose === 'run' ? '-3deg' : '0deg' }],
            width: faceLayout.width * unit,
          },
        ]}
      >
        <View
          style={[
            styles.blush,
            {
              height: 7 * unit,
              left: 5 * unit,
              top: facePositions.blushTop * unit,
              width: 15 * unit,
            },
          ]}
        />
        <View
          style={[
            styles.blush,
            {
              height: 7 * unit,
              right: 5 * unit,
              top: facePositions.blushTop * unit,
              width: 15 * unit,
            },
          ]}
        />
        {eyeId === 'round-eyes' ? (
          <>
            <View
              style={[
                styles.animeEye,
                {
                  height: 19 * unit,
                  left: 11 * unit,
                  top: facePositions.roundEyeTop * unit,
                  width: 15 * unit,
                },
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
                {
                  height: 19 * unit,
                  right: 11 * unit,
                  top: facePositions.roundEyeTop * unit,
                  width: 15 * unit,
                },
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
          <Text
            style={[
              styles.eyes,
              { fontSize: 12 * unit, top: facePositions.eyeTop * unit },
            ]}
          >
            {EYE_GLYPHS[eyeId] ?? EYE_GLYPHS['round-eyes']}
          </Text>
        )}
        <Text
          style={[
            styles.nose,
            noseId === 'leaf-nose' && styles.noseLeaf,
            noseId === 'peach-nose' && styles.nosePeach,
            { fontSize: 8 * unit, top: facePositions.noseTop * unit },
          ]}
        >
          {NOSE_GLYPHS[noseId] ?? NOSE_GLYPHS['bean-nose']}
        </Text>
        <Text
          style={[
            styles.mouth,
            {
              fontSize: (mouthId === 'surprised-mouth' ? 9 : 12) * unit,
              top: facePositions.mouthTop * unit,
            },
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
