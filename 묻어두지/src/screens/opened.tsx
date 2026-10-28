import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Capsule } from '@/components/capsule';
import { Icon } from '@/components/icons';
import { Avatar, AVATAR_TONES, Body, Button, Content, IconButton, NavBar, Page, Tag } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing, Stroke, offsetShadow } from '@/constants/theme';
import { ITEM_KIND_LABEL, daysUntil, deletionDate, formatKoreanDate, revealOrder, withSubjectParticle, type Capsule as CapsuleModel, type CapsuleItem } from '@/domain/capsule';
import { useCapsuleStore } from '@/state/capsule-store';

export function OpenedScreen({ capsule, now }: { capsule: CapsuleModel; now: Date }) {
  const { profile } = useCapsuleStore();
  const order = revealOrder(capsule);
  const [index, setIndex] = useState(0);
  const entry = order[index];
  const memberIndex = capsule.members.findIndex((member) => member.id === entry?.memberId);
  const isLast = index >= order.length - 1;
  const deleteOn = capsule.openedAt ? deletionDate(capsule.openedAt) : null;

  return (
    <Page>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <NavBar
          left="close"
          onLeft={() => router.replace('/')}
          title={
            <View style={styles.navTitle}>
              <Text style={styles.navTitleText}>{capsule.title}</Text>
              {deleteOn && <Text style={styles.navSub}>열렸어요 · {daysUntil(deleteOn, now)}일 뒤 사라져요</Text>}
            </View>
          }
          right={<IconButton name="dots" label="이 물건 메뉴" />}
        />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Content style={styles.content}>
            <View style={styles.headline}>
              <Capsule state="open" size={84} />
              <View style={styles.headlineCopy}>
                <Text style={styles.headlineText}>
                  {entry ? `${withSubjectParticle(entry.memberName)} 넣은\n${withSubjectParticle(ITEM_KIND_LABEL[entry.item.kind])} 나왔어요!` : '다 꺼냈어요!'}
                </Text>
                <Body size={12}>
                  꺼낸 물건 <Text style={styles.strong}>{Math.min(index + 1, order.length)}</Text> / {order.length}
                </Body>
              </View>
            </View>

            <View style={styles.stage}>
              <View style={styles.backCard} />
              {entry && (
                <View style={[styles.card, offsetShadow(6)]}>
                  <ItemView item={entry.item} />
                  <View style={styles.author}>
                    <Avatar name={entry.memberName} tone={capsule.members[memberIndex]?.isMe ? profile.tone : AVATAR_TONES[Math.max(0, memberIndex) % AVATAR_TONES.length]} size={36} />
                    <Text style={styles.authorName}>{entry.memberName}</Text>
                    <View style={styles.spacer} />
                    <Text style={styles.authorMeta}>
                      {ITEM_KIND_LABEL[entry.item.kind]} · {formatKoreanDate(entry.item.createdAt)}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </Content>
        </ScrollView>
        <Content style={styles.footer}>
          <View style={styles.actions}>
            <IconButton name="back" label="이전 물건" onPress={() => setIndex((current) => Math.max(0, current - 1))} />
            {isLast ? (
              <Button style={styles.grow} label="새 타임캡슐 만들기" icon="arrow" onPress={() => router.push({ pathname: '/capsule/[id]/next', params: { id: capsule.id } })} />
            ) : (
              <Button style={styles.grow} label="다음 물건 꺼내기" onPress={() => setIndex((current) => Math.min(order.length - 1, current + 1))} />
            )}
          </View>
        </Content>
      </SafeAreaView>
    </Page>
  );
}

function ItemView({ item }: { item: CapsuleItem }) {
  if (item.kind === 'letter') {
    return (
      <View style={styles.letter}>
        <Tag tone="sky" label={`편지 · ${formatKoreanDate(item.createdAt)}`} />
        <Text style={styles.letterText}>{item.text}</Text>
      </View>
    );
  }
  if (item.kind === 'photo') {
    return item.uri ? (
      <Image source={{ uri: item.uri }} style={styles.media} contentFit="cover" accessibilityLabel="사진" />
    ) : (
      <View style={[styles.media, styles.mediaPlaceholder]}>
        <Icon name="photo" size={28} />
        <Body size={12}>사진을 불러오는 중이에요</Body>
      </View>
    );
  }
  if (item.kind === 'voice') return <VoiceView item={item} />;
  return <VideoItemView item={item} />;
}

function VoiceView({ item }: { item: CapsuleItem }) {
  const player = useAudioPlayer(item.uri ? { uri: item.uri } : null);
  const status = useAudioPlayerStatus(player);
  const seconds = Math.round((item.durationMs ?? status.duration * 1000) / 1000);
  const bars = [12, 26, 18, 36, 22, 30, 14, 28, 20, 34, 16, 24, 12];
  const progress = status.duration > 0 ? status.currentTime / status.duration : 0;
  return (
    <View style={styles.voice}>
      <Tag tone="mint" label={`음성 · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={status.playing ? '일시정지' : '재생'}
        disabled={!item.uri}
        onPress={() => (status.playing ? player.pause() : player.play())}
        style={[styles.play, offsetShadow(5)]}>
        <Icon name={status.playing ? 'stop' : 'play'} size={34} />
      </Pressable>
      <View style={styles.bars}>
        {bars.map((height, index) => (
          <View key={index} style={[styles.bar, { height, backgroundColor: index / bars.length < progress ? Colors.ink : Colors.faint }]} />
        ))}
      </View>
      {!item.uri && <Body size={11}>녹음을 불러오는 중이에요</Body>}
    </View>
  );
}

function VideoItemView({ item }: { item: CapsuleItem }) {
  const player = useVideoPlayer(item.uri ?? null, (instance) => {
    instance.loop = false;
  });
  if (!item.uri) {
    return (
      <View style={[styles.media, styles.mediaPlaceholder]}>
        <Icon name="video" size={28} />
        <Body size={12}>동영상을 불러오는 중이에요</Body>
      </View>
    );
  }
  return <VideoView player={player} style={styles.media} contentFit="cover" nativeControls />;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { gap: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.lg },
  navTitle: { alignItems: 'center', gap: 1 },
  navTitleText: { fontFamily: Fonts.display, fontSize: 16, color: Colors.ink },
  navSub: { fontFamily: Fonts.body, fontSize: 11, color: Colors.muted },
  headline: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headlineCopy: { flex: 1, gap: 2 },
  headlineText: { fontFamily: Fonts.display, fontSize: 20, lineHeight: 24, color: Colors.ink },
  strong: { fontFamily: Fonts.display, color: Colors.ink },
  stage: { position: 'relative', paddingTop: 10, paddingBottom: 8 },
  backCard: { position: 'absolute', left: 14, right: 14, top: 22, bottom: 0, borderRadius: 26, backgroundColor: Colors.mint, borderWidth: Stroke.regular, borderColor: Colors.ink, transform: [{ rotate: '3deg' }] },
  card: { minHeight: 440, borderRadius: 26, backgroundColor: Colors.white, borderWidth: Stroke.regular, borderColor: Colors.ink, padding: 18, gap: Spacing.lg, justifyContent: 'space-between', transform: [{ rotate: '-2deg' }] },
  letter: { gap: Spacing.md },
  letterText: { fontFamily: Fonts.body, fontSize: 18, lineHeight: 30, color: Colors.ink },
  media: { width: '100%', aspectRatio: 1, borderRadius: Radius.md, borderWidth: Stroke.regular, borderColor: Colors.ink, backgroundColor: Colors.sky, overflow: 'hidden' },
  mediaPlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  voice: { alignItems: 'center', gap: 20, paddingVertical: Spacing.lg },
  play: { width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.yellow, borderWidth: Stroke.regular, borderColor: Colors.ink, alignItems: 'center', justifyContent: 'center' },
  bars: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 40 },
  bar: { width: 5, borderRadius: 3 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  authorName: { fontFamily: Fonts.display, fontSize: 17, color: Colors.ink },
  authorMeta: { fontFamily: Fonts.body, fontSize: 12, color: Colors.muted },
  spacer: { flex: 1 },
  footer: { paddingTop: Spacing.md, paddingBottom: Spacing.md },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  grow: { flex: 1 },
});
