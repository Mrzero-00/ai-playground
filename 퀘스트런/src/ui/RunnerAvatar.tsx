import React from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
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

interface AvatarFaceLayout {
  frame: AvatarLayerLayout;
  features: {
    blushInset: number;
    blushTop: number;
    eyeInset: number;
    mouthTop: number;
    noseTop: number;
    roundEyeTop: number;
    symbolEyeTop: number;
  };
}

export const AVATAR_FACE_LAYOUTS = {
  lumi: {
    frame: { height: 60, left: 78, top: 68, width: 72 },
    features: {
      blushInset: 10,
      blushTop: 29,
      eyeInset: 14,
      mouthTop: 32,
      noseTop: 29,
      roundEyeTop: 14,
      symbolEyeTop: 17,
    },
  },
  mori: {
    frame: { height: 60, left: 77, top: 63, width: 74 },
    features: {
      blushInset: 10,
      blushTop: 28,
      eyeInset: 16,
      mouthTop: 30,
      noseTop: 27,
      roundEyeTop: 13,
      symbolEyeTop: 16,
    },
  },
} as const satisfies Record<AvatarPreset, AvatarFaceLayout>;

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
  const { features: facePositions, frame: faceLayout } = AVATAR_FACE_LAYOUTS[avatarPreset];
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
    (item) => !FACE_SLOTS.includes(item.slot) && AVATAR_LAYERS[item.id] == null && item.source !== 'starter'
  );

  return (
    <View
      accessibilityLabel={`애니메이션 일러스트 스타일의 새싹 러너 ${avatarDefinition.name}. 눈, 코, 입과 러닝 아이템을 꾸밀 수 있습니다.`}
      style={[{ height, width: size }, style]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.avatarCanvas,
          {
            height,
            transform: [{ rotate: pose === 'run' ? '-3deg' : '0deg' }],
            width: size,
          },
        ]}
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
              width: faceLayout.width * unit,
            },
          ]}
        >
          <View
            style={[
              styles.blush,
              {
                height: 7 * unit,
                left: facePositions.blushInset * unit,
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
                right: facePositions.blushInset * unit,
                top: facePositions.blushTop * unit,
                width: 15 * unit,
              },
            ]}
          />
          <FaceEye
            eyeId={eyeId}
            inset={facePositions.eyeInset}
            roundTop={facePositions.roundEyeTop}
            side="left"
            symbolTop={facePositions.symbolEyeTop}
            unit={unit}
          />
          <FaceEye
            eyeId={eyeId}
            inset={facePositions.eyeInset}
            roundTop={facePositions.roundEyeTop}
            side="right"
            symbolTop={facePositions.symbolEyeTop}
            unit={unit}
          />
          <FaceNose noseId={noseId} top={facePositions.noseTop} unit={unit} />
          <FaceMouth mouthId={mouthId} top={facePositions.mouthTop} unit={unit} />
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
    </View>
  );
}

function FaceEye({
  eyeId,
  inset,
  roundTop,
  side,
  symbolTop,
  unit,
}: {
  eyeId: string;
  inset: number;
  roundTop: number;
  side: 'left' | 'right';
  symbolTop: number;
  unit: number;
}) {
  const horizontalPosition: ViewStyle = side === 'left' ? { left: inset * unit } : { right: inset * unit };

  if (eyeId === 'round-eyes') {
    return (
      <View
        style={[styles.animeEye, horizontalPosition, { height: 19 * unit, top: roundTop * unit, width: 15 * unit }]}
      >
        <View style={[styles.irisGlow, { bottom: 1 * unit, height: 7 * unit, left: 2 * unit, width: 11 * unit }]} />
        <View style={[styles.eyeHighlight, { height: 4 * unit, left: 3 * unit, top: 3 * unit, width: 4 * unit }]} />
      </View>
    );
  }

  if (eyeId === 'sparkle-eyes') {
    return (
      <View
        style={[styles.sparkleEye, horizontalPosition, { height: 15 * unit, top: symbolTop * unit, width: 15 * unit }]}
      >
        <View style={[styles.sparkleEyeVertical, { height: 15 * unit, left: 6 * unit, width: 3 * unit }]} />
        <View style={[styles.sparkleEyeHorizontal, { height: 3 * unit, top: 6 * unit, width: 15 * unit }]} />
        <View style={[styles.eyeHighlight, { height: 3 * unit, left: 4 * unit, top: 3 * unit, width: 3 * unit }]} />
      </View>
    );
  }

  return (
    <View
      style={[
        eyeId === 'smiley-eyes' ? styles.smileyEye : styles.sleepyEye,
        horizontalPosition,
        {
          height: (eyeId === 'smiley-eyes' ? 8 : 2) * unit,
          top: (symbolTop + (eyeId === 'smiley-eyes' ? 3 : 6)) * unit,
          width: (eyeId === 'smiley-eyes' ? 16 : 15) * unit,
        },
        eyeId === 'smiley-eyes' && {
          borderRadius: 8 * unit,
          borderTopWidth: 2 * unit,
        },
      ]}
    />
  );
}

function FaceNose({ noseId, top, unit }: { noseId: string; top: number; unit: number }) {
  return (
    <View style={[styles.featureAnchor, { height: 8 * unit, top: top * unit }]}>
      {noseId === 'peach-nose' ? (
        <View
          style={[
            styles.peachNose,
            {
              borderLeftWidth: 4 * unit,
              borderRightWidth: 4 * unit,
              borderTopWidth: 6 * unit,
            },
          ]}
        />
      ) : (
        <View
          style={[
            noseId === 'button-nose' ? styles.buttonNose : noseId === 'leaf-nose' ? styles.leafNose : styles.beanNose,
            {
              height: (noseId === 'button-nose' ? 6 : noseId === 'leaf-nose' ? 5 : 4) * unit,
              width: (noseId === 'button-nose' ? 6 : noseId === 'leaf-nose' ? 7 : 5) * unit,
            },
          ]}
        />
      )}
    </View>
  );
}

function FaceMouth({ mouthId, top, unit }: { mouthId: string; top: number; unit: number }) {
  return (
    <View style={[styles.featureAnchor, { height: 10 * unit, top: top * unit }]}>
      {mouthId === 'cat-mouth' ? (
        <View style={styles.catMouth}>
          <View style={[styles.catMouthArc, { borderBottomWidth: 2 * unit, height: 6 * unit, width: 8 * unit }]} />
          <View style={[styles.catMouthArc, { borderBottomWidth: 2 * unit, height: 6 * unit, width: 8 * unit }]} />
        </View>
      ) : mouthId === 'open-smile' ? (
        <View style={[styles.openMouth, { height: 8 * unit, marginTop: 2 * unit, width: 12 * unit }]}>
          <View
            style={[styles.openMouthHighlight, { bottom: 1 * unit, height: 3 * unit, left: 2 * unit, width: 8 * unit }]}
          />
        </View>
      ) : mouthId === 'surprised-mouth' ? (
        <View
          style={[
            styles.surprisedMouth,
            { borderWidth: 2 * unit, height: 8 * unit, marginTop: 2 * unit, width: 7 * unit },
          ]}
        />
      ) : (
        <View style={[styles.softSmile, { borderBottomWidth: 2 * unit, height: 6 * unit, width: 14 * unit }]} />
      )}
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
  avatarCanvas: {
    left: 0,
    position: 'absolute',
    top: 0,
  },
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
  eyeHighlight: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    position: 'absolute',
  },
  sparkleEye: {
    position: 'absolute',
  },
  sparkleEyeVertical: {
    backgroundColor: '#783C52',
    borderRadius: 999,
    position: 'absolute',
    top: 0,
  },
  sparkleEyeHorizontal: {
    backgroundColor: '#783C52',
    borderRadius: 999,
    left: 0,
    position: 'absolute',
  },
  smileyEye: {
    borderColor: '#783C52',
    position: 'absolute',
  },
  sleepyEye: {
    backgroundColor: '#783C52',
    borderRadius: 999,
    position: 'absolute',
  },
  featureAnchor: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  beanNose: {
    backgroundColor: '#B9665B',
    borderRadius: 999,
  },
  peachNose: {
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#E77965',
    height: 0,
    width: 0,
  },
  buttonNose: {
    backgroundColor: '#B9665B',
    borderColor: '#91483F',
    borderRadius: 999,
    borderWidth: 1,
  },
  leafNose: {
    backgroundColor: '#39966E',
    borderBottomLeftRadius: 5,
    borderTopRightRadius: 5,
    transform: [{ rotate: '-28deg' }],
  },
  softSmile: {
    borderBottomColor: '#A95061',
    borderRadius: 999,
  },
  catMouth: {
    flexDirection: 'row',
  },
  catMouthArc: {
    borderBottomColor: '#A95061',
    borderRadius: 999,
  },
  openMouth: {
    backgroundColor: '#A95061',
    borderColor: '#7D3A48',
    borderRadius: 999,
    borderWidth: 1,
  },
  openMouthHighlight: {
    backgroundColor: '#F49AAA',
    borderRadius: 999,
    position: 'absolute',
  },
  surprisedMouth: {
    borderColor: '#A95061',
    borderRadius: 999,
  },
  decoration: {
    position: 'absolute',
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { height: 2, width: 0 },
    textShadowRadius: 3,
    zIndex: 10,
  },
});
