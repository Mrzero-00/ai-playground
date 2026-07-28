import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ITEMS, getItemById, type GameItem, type ItemSlot } from '../domain/game';
import type { GameState } from '../domain/gameState';
import { Card, Pill, PrimaryButton, ScreenTitle, SectionHeader } from '../ui/components';
import { colors, radii } from '../ui/theme';
import heroImage from '../../assets/quest-run-hero.png';

type StyleFilter = 'all' | ItemSlot;

interface StyleShopScreenProps {
  gameState: GameState;
  onEquipItem: (itemId: string) => void;
  onPurchaseItem: (itemId: string) => void;
}

const FILTERS: Array<{ id: StyleFilter; label: string }> = [
  { id: 'all', label: '전체' },
  { id: 'head', label: '모자' },
  { id: 'top', label: '상의' },
  { id: 'shoes', label: '신발' },
  { id: 'accessory', label: '장식' },
];

export function StyleShopScreen({ gameState, onEquipItem, onPurchaseItem }: StyleShopScreenProps) {
  const [filter, setFilter] = useState<StyleFilter>('all');
  const [selectedItemId, setSelectedItemId] = useState('sunny-visor');
  const selectedItem = getItemById(selectedItemId) ?? ITEMS[0]!;
  const isOwned = gameState.unlockedItemIds.includes(selectedItem.id);
  const isEquipped = gameState.equippedItemIds[selectedItem.slot] === selectedItem.id;
  const canPurchase = selectedItem.source === 'shop' && gameState.styleCoins >= selectedItem.price;
  const equippedItems = Object.values(gameState.equippedItemIds)
    .map((itemId) => (itemId == null ? undefined : getItemById(itemId)))
    .filter((item): item is GameItem => item != null);
  const visibleItems = useMemo(
    () => ITEMS.filter((item) => item.source !== 'starter' && (filter === 'all' || item.slot === filter)),
    [filter]
  );

  const actionLabel = isOwned
    ? isEquipped
      ? '현재 착용 중'
      : '이 아이템 착용하기'
    : selectedItem.source === 'shop'
      ? canPurchase
        ? `● ${selectedItem.price.toLocaleString()} · 구매하기`
        : `코인 ${(selectedItem.price - gameState.styleCoins).toLocaleString()} 부족`
      : selectedItem.source === 'quest'
        ? '주간 10km 퀘스트 보상'
        : `${selectedItem.region ?? '해당 지역'} 러닝으로 발견`;

  const handleAction = () => {
    if (isOwned) {
      onEquipItem(selectedItem.id);
      return;
    }

    if (canPurchase) {
      onPurchaseItem(selectedItem.id);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ScreenTitle
        eyebrow="RUN & STYLE"
        title="스타일 상점"
        right={
          <View style={styles.coinPill}>
            <Text style={styles.coinIcon}>●</Text>
            <Text style={styles.coinValue}>{gameState.styleCoins.toLocaleString()}</Text>
          </View>
        }
      />

      <View style={styles.previewCard}>
        <View style={styles.previewBlobOne} />
        <View style={styles.previewBlobTwo} />
        <View style={styles.previewCopy}>
          <Pill tone="dark">Lv. {gameState.level} 러너</Pill>
          <Text style={styles.previewTitle}>오늘의 루미</Text>
          <Text style={styles.previewCaption}>달리며 모은 코인으로{'\n'}나만의 스타일을 완성해요.</Text>
        </View>
        <AvatarPreview equippedItems={equippedItems} />
        <View style={styles.outfitStrip}>
          {(['head', 'top', 'shoes', 'accessory'] as ItemSlot[]).map((slot) => {
            const item = equippedItems.find((candidate) => candidate.slot === slot);
            return (
              <View key={slot} style={[styles.outfitSlot, item == null && styles.outfitSlotEmpty]}>
                <Text style={styles.outfitIcon}>{item?.icon ?? '＋'}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <Card style={styles.earnCard}>
        <View style={styles.earnIcon}>
          <Text style={styles.earnEmoji}>🏃</Text>
        </View>
        <View style={styles.earnCopy}>
          <Text style={styles.earnTitle}>1km 달릴 때마다 러닝 코인 40</Text>
          <Text style={styles.earnCaption}>러너 레벨 경험치와 꾸미기 코인을 함께 받아요.</Text>
        </View>
        <Text style={styles.earnCoin}>● +40</Text>
      </Card>

      <SectionHeader caption="모든 아이템은 능력치 없이 꾸미기에만 사용돼요." title="새로운 스타일" />

      <ScrollView
        contentContainerStyle={styles.filters}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroller}
      >
        {FILTERS.map((item) => (
          <Pressable
            accessibilityRole="button"
            key={item.id}
            onPress={() => setFilter(item.id)}
            style={[styles.filterButton, filter === item.id && styles.filterButtonActive]}
          >
            <Text style={[styles.filterText, filter === item.id && styles.filterTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.itemGrid}>
        {visibleItems.map((item) => {
          const owned = gameState.unlockedItemIds.includes(item.id);
          const equipped = gameState.equippedItemIds[item.slot] === item.id;

          return (
            <Pressable
              accessibilityLabel={`${item.name}${owned ? ' 보유 중' : ''}`}
              accessibilityRole="button"
              key={item.id}
              onPress={() => setSelectedItemId(item.id)}
              style={[
                styles.itemCard,
                selectedItem.id === item.id && styles.itemCardSelected,
                equipped && styles.itemCardEquipped,
              ]}
            >
              <View style={[styles.itemIconWrap, item.rarity === '지역 한정' && styles.itemIconRegional]}>
                <Text style={styles.itemIcon}>{item.icon}</Text>
                {equipped ? (
                  <View style={styles.equippedBadge}>
                    <Text style={styles.equippedCheck}>✓</Text>
                  </View>
                ) : null}
              </View>
              <Text numberOfLines={1} style={styles.itemName}>
                {item.name}
              </Text>
              <Text style={[styles.itemPrice, owned && styles.itemOwned]}>
                {owned
                  ? equipped
                    ? '착용 중'
                    : '보유 중'
                  : item.source === 'shop'
                    ? `● ${item.price.toLocaleString()}`
                    : item.source === 'quest'
                      ? '퀘스트 한정'
                      : '지역 한정'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Card style={styles.detailCard}>
        <View style={styles.detailTop}>
          <View style={styles.detailIcon}>
            <Text style={styles.detailEmoji}>{selectedItem.icon}</Text>
          </View>
          <View style={styles.detailCopy}>
            <View style={styles.detailNameRow}>
              <Text style={styles.detailName}>{selectedItem.name}</Text>
              <Pill tone={selectedItem.rarity === '지역 한정' ? 'purple' : 'brand'}>{selectedItem.rarity}</Pill>
            </View>
            <Text style={styles.detailDescription}>{selectedItem.description}</Text>
          </View>
        </View>
        <PrimaryButton
          disabled={isEquipped || (!isOwned && !canPurchase)}
          icon={isOwned ? '✓' : '●'}
          label={actionLabel}
          onPress={handleAction}
        />
      </Card>

      <SectionHeader caption="여행지의 발걸음은 그곳에서만 얻는 추억이 돼요." title="지역 한정 컬렉션" />
      <Card style={styles.regionalCard}>
        <View style={styles.regionalItem}>
          <Text style={styles.regionalEmoji}>🍊</Text>
          <View style={styles.regionalCopy}>
            <Text style={styles.regionalTitle}>제주 · 한라봉 모자</Text>
            <Text style={styles.regionalCaption}>제주 누적 5km 달리기</Text>
          </View>
          <Text style={styles.regionalProgress}>
            {(gameState.regionDistancesKm['제주특별자치도'] ?? 0).toFixed(1)} / 5km
          </Text>
        </View>
        <View style={styles.regionalDivider} />
        <View style={styles.regionalItem}>
          <Text style={styles.regionalEmoji}>🌙</Text>
          <View style={styles.regionalCopy}>
            <Text style={styles.regionalTitle}>서울 · 한강 달빛 핀</Text>
            <Text style={styles.regionalCaption}>서울 누적 10km 달리기</Text>
          </View>
          <Text style={styles.regionalProgress}>
            {(gameState.regionDistancesKm['서울특별시'] ?? 0).toFixed(1)} / 10km
          </Text>
        </View>
      </Card>
    </ScrollView>
  );
}

function AvatarPreview({ equippedItems }: { equippedItems: GameItem[] }) {
  return (
    <View style={styles.avatarWrap}>
      <View style={styles.avatarHalo} />
      <Image
        accessibilityLabel="꾸미기 아이템을 착용한 픽셀 여우 루미"
        resizeMode="contain"
        source={heroImage}
        style={styles.avatar}
      />
      {equippedItems.map((item) => (
        <Text
          key={item.id}
          style={[
            styles.avatarDecoration,
            item.slot === 'head' && styles.avatarHead,
            item.slot === 'top' && styles.avatarTop,
            item.slot === 'shoes' && styles.avatarShoes,
            item.slot === 'accessory' && styles.avatarAccessory,
          ]}
        >
          {item.icon}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 132,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  coinPill: {
    alignItems: 'center',
    backgroundColor: colors.navy,
    borderRadius: radii.pill,
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  coinIcon: {
    color: colors.yellow,
    fontSize: 13,
    marginRight: 7,
  },
  coinValue: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
  previewCard: {
    backgroundColor: colors.navy,
    borderRadius: 30,
    height: 362,
    overflow: 'hidden',
    position: 'relative',
  },
  previewBlobOne: {
    backgroundColor: '#164D58',
    borderRadius: 160,
    height: 300,
    position: 'absolute',
    right: -80,
    top: -72,
    width: 300,
  },
  previewBlobTwo: {
    backgroundColor: '#0B7A64',
    borderRadius: 100,
    bottom: -82,
    height: 210,
    opacity: 0.6,
    position: 'absolute',
    right: 48,
    width: 210,
  },
  previewCopy: {
    left: 22,
    position: 'absolute',
    top: 22,
    zIndex: 4,
  },
  previewTitle: {
    color: colors.white,
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: -0.7,
    marginTop: 14,
  },
  previewCaption: {
    color: '#CFE5E1',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  avatarWrap: {
    bottom: 36,
    height: 285,
    position: 'absolute',
    right: -2,
    width: 250,
  },
  avatarHalo: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 100,
    bottom: 26,
    height: 190,
    position: 'absolute',
    right: 12,
    width: 190,
  },
  avatar: {
    bottom: 0,
    height: 260,
    position: 'absolute',
    right: 4,
    width: 220,
  },
  avatarDecoration: {
    fontSize: 34,
    position: 'absolute',
    zIndex: 3,
  },
  avatarHead: {
    right: 82,
    top: 26,
  },
  avatarTop: {
    right: 82,
    top: 132,
  },
  avatarShoes: {
    bottom: 12,
    right: 65,
  },
  avatarAccessory: {
    right: 27,
    top: 128,
  },
  outfitStrip: {
    bottom: 20,
    flexDirection: 'row',
    gap: 7,
    left: 20,
    position: 'absolute',
    zIndex: 5,
  },
  outfitSlot: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 13,
    borderWidth: 1,
    height: 43,
    justifyContent: 'center',
    width: 43,
  },
  outfitSlotEmpty: {
    opacity: 0.55,
  },
  outfitIcon: {
    fontSize: 20,
  },
  earnCard: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 14,
    padding: 15,
  },
  earnIcon: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: 15,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  earnEmoji: {
    fontSize: 23,
  },
  earnCopy: {
    flex: 1,
    marginHorizontal: 12,
  },
  earnTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  earnCaption: {
    color: colors.inkMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  earnCoin: {
    color: '#A65A00',
    fontSize: 13,
    fontWeight: '900',
  },
  filterScroller: {
    marginHorizontal: -20,
  },
  filters: {
    gap: 8,
    paddingHorizontal: 20,
  },
  filterButton: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 17,
    paddingVertical: 10,
  },
  filterButtonActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  filterText: {
    color: colors.inkMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  filterTextActive: {
    color: colors.white,
  },
  itemGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  itemCard: {
    backgroundColor: colors.surface,
    borderColor: 'transparent',
    borderRadius: 19,
    borderWidth: 2,
    padding: 10,
    width: '48.5%',
  },
  itemCardSelected: {
    borderColor: colors.brand,
  },
  itemCardEquipped: {
    backgroundColor: '#F1FBF7',
  },
  itemIconWrap: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 15,
    height: 86,
    justifyContent: 'center',
    position: 'relative',
  },
  itemIconRegional: {
    backgroundColor: '#F0ECFF',
  },
  itemIcon: {
    fontSize: 39,
  },
  equippedBadge: {
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: 10,
    height: 21,
    justifyContent: 'center',
    position: 'absolute',
    right: 7,
    top: 7,
    width: 21,
  },
  equippedCheck: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '900',
  },
  itemName: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 10,
  },
  itemPrice: {
    color: '#A65A00',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 5,
  },
  itemOwned: {
    color: colors.brandDark,
  },
  detailCard: {
    marginTop: 14,
  },
  detailTop: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 15,
  },
  detailIcon: {
    alignItems: 'center',
    backgroundColor: colors.orangeSoft,
    borderRadius: 17,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  detailEmoji: {
    fontSize: 34,
  },
  detailCopy: {
    flex: 1,
    marginLeft: 13,
  },
  detailNameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  detailName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  detailDescription: {
    color: colors.inkMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  regionalCard: {
    paddingVertical: 4,
  },
  regionalItem: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 14,
  },
  regionalEmoji: {
    fontSize: 28,
    width: 45,
  },
  regionalCopy: {
    flex: 1,
  },
  regionalTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  regionalCaption: {
    color: colors.inkMuted,
    fontSize: 11,
    marginTop: 4,
  },
  regionalProgress: {
    color: colors.purple,
    fontSize: 11,
    fontWeight: '900',
  },
  regionalDivider: {
    backgroundColor: colors.line,
    height: 1,
  },
});
