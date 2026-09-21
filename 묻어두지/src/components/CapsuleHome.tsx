import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, PanResponder, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CapsuleSummary, LocationFix } from '../shared/contracts';
import { capsuleState, filterCapsules, type TimelineFilter } from '../lib/timeline';
import { drawerHeights, mapCenter, snapDrawer } from '../lib/mapHome';
import type { MapPerspective } from '../lib/mapPresentation';
import { colors as C } from '../theme';
import CapsuleAtlas from './CapsuleAtlas';
import CapsuleArt from './CapsuleArt';

type Props = {
  capsules: CapsuleSummary[]; fix: LocationFix | null; now: number;
  active: boolean; loading: boolean; serverOk: boolean; error: string | null;
  onCompose: () => void; onGroups: () => void; onLab: () => void;
  onSelect: (capsule: CapsuleSummary) => void; onRefresh: () => Promise<void>; onLocate: () => Promise<void>;
};
const filters: { key: TimelineFilter; label: string }[] = [
  { key: 'all', label: '전체' }, { key: 'waiting', label: '기다리는 중' },
  { key: 'ready', label: '꺼낼 시간' }, { key: 'opened', label: '열어본 캡슐' },
];

export default function CapsuleHome(props: Props) {
  const [height, setHeight] = useState(760);
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<TimelineFilter>('all');
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [recenterKey, setRecenterKey] = useState(0);
  const [perspective, setPerspective] = useState<MapPerspective>('quarter');
  const stops = useMemo(() => drawerHeights(height), [height]);
  const drawer = useRef(new Animated.Value(stops.collapsed)).current;
  const [paintHeight, setPaintHeight] = useState(stops.collapsed);
  const currentHeight = useRef(stops.collapsed);
  const dragStart = useRef(stops.collapsed);
  const active = useRef(props.active); active.current = props.active;
  useEffect(() => {
    const id = drawer.addListener(({ value }) => { currentHeight.current = value; setPaintHeight(value); });
    return () => drawer.removeListener(id);
  }, [drawer]);
  const animate = (open: boolean) => {
    setExpanded(open);
    Animated.timing(drawer, { toValue: open ? stops.expanded : stops.collapsed, duration: 220, useNativeDriver: false }).start();
  };
  useEffect(() => { drawer.setValue(expanded ? stops.expanded : stops.collapsed); }, [stops, drawer]);
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderGrant: () => { drawer.stopAnimation(); dragStart.current = currentHeight.current; },
    onPanResponderMove: (_, gesture) => drawer.setValue(Math.max(stops.collapsed, Math.min(stops.expanded, dragStart.current - gesture.dy))),
    onPanResponderRelease: (_, gesture) => animate(snapDrawer(currentHeight.current, gesture.vy, stops)),
    onPanResponderTerminate: () => animate(expanded),
  }), [drawer, stops, expanded]);
  const center = mapCenter(props.capsules, props.fix);
  const visible = filterCapsules(props.capsules, filter, props.now);
  const locate = async () => {
    if (locating) return;
    setLocating(true); setLocationError(null);
    try { await props.onLocate(); if (active.current) setRecenterKey(value => value + 1); }
    catch (error) { if (active.current) setLocationError(error instanceof Error ? error.message : '현재 위치를 확인하지 못했어요.'); }
    finally { setLocating(false); }
  };
  return <View style={[s.root, { pointerEvents: props.active ? 'auto' : 'none' }]} onLayout={event => setHeight(event.nativeEvent.layout.height)}
    accessibilityElementsHidden={!props.active} importantForAccessibility={props.active ? 'auto' : 'no-hide-descendants'} aria-hidden={!props.active}>
    <CapsuleAtlas capsules={props.capsules} fix={props.fix} center={center} recenterKey={recenterKey} active={props.active} now={props.now} perspective={perspective}
      bottomInset={props.active ? paintHeight : Math.max(0, height - 66)} onSelect={props.onSelect}/>
    {props.active && <>
      <View style={s.topBar}>
        <View style={s.brand}><Text style={s.brandName}>묻어두지</Text><Text style={s.brandHint}>여기서, 다시 만나요.</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="함께 묻기" onPress={props.onGroups} style={s.topAction}><Text style={s.topIcon}>♧</Text><Text style={s.topActionText}>함께</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="실험실" onPress={props.onLab} style={s.topAction}><Text style={s.topIcon}>⚙</Text><Text style={s.topActionText}>설정</Text></Pressable>
      </View>
      <View style={s.mapCaption}><Text style={s.mapCaptionText}>{props.fix ? '마지막으로 확인한 내 위치' : props.capsules.length ? '내 캡슐 주변 지도' : '기본 지도 · 서울'}</Text></View>
      <View style={s.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="캡슐 묻기" onPress={props.onCompose} style={({ pressed }) => [s.bury, pressed && s.pressed]}>
          <Text style={s.buryPlus}>＋</Text><Text style={s.buryText}>캡슐 묻기</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="현재 위치로 이동" accessibilityState={{ busy: locating, disabled: locating }} disabled={locating} onPress={() => void locate()} style={s.location}>
          {locating ? <ActivityIndicator color={C.primary}/> : <Text style={s.locationIcon}>⌖</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={perspective === 'quarter' ? '지도를 평면으로 보기' : '지도를 쿼터뷰로 보기'}
          onPress={() => setPerspective(value => value === 'quarter' ? 'flat' : 'quarter')} style={s.location}>
          <Text style={s.perspectiveText}>{perspective === 'quarter' ? '2D' : '3D'}</Text>
        </Pressable>
      </View>
      {locationError && <View style={s.locationError} accessibilityRole="alert"><Text style={s.locationErrorText}>{locationError}</Text><Pressable accessibilityRole="button" accessibilityLabel="위치 안내 닫기" onPress={() => setLocationError(null)} style={s.dismiss}><Text style={s.closeText}>×</Text></Pressable></View>}
      <Animated.View style={[s.drawer, { height: drawer }]} testID="capsule-list-drawer">
        <View {...pan.panHandlers} style={s.dragArea} testID="capsule-list-handle">
          <Pressable accessibilityRole="button" accessibilityLabel={expanded ? '내 캡슐 목록 접기' : '내 캡슐 목록 펼치기'} accessibilityState={{ expanded }}
            onPress={() => animate(!expanded)} style={s.drawerHandle}>
            <View style={s.grabber}/>
            <View style={s.drawerHeading}><Text style={s.drawerTitle}>내 캡슐 <Text style={s.count}>{props.capsules.length}</Text></Text><Text style={s.drawerHint}>{expanded ? '지도 더 보기  ↓' : '올려서 모두 보기  ↑'}</Text></View>
          </Pressable>
        </View>
        {expanded && <View accessibilityRole="tablist" style={s.filters}>{filters.map(item => <Pressable key={item.key} accessibilityRole="tab" aria-selected={filter === item.key} accessibilityState={{ selected: filter === item.key }} onPress={() => setFilter(item.key)} style={[s.filter, item.key === filter && s.filterSelected]}><Text style={[s.filterText, item.key === filter && s.filterTextSelected]}>{item.label}</Text></Pressable>)}</View>}
        <ScrollView style={s.list} contentContainerStyle={s.listContent} scrollEnabled={expanded} refreshControl={expanded ? <RefreshControl refreshing={props.loading} onRefresh={() => void props.onRefresh()} tintColor={C.primary}/> : undefined}>
          {props.loading && !props.capsules.length ? <View style={s.empty}><ActivityIndicator color={C.primary}/><Text style={s.emptyHint}>묻어둔 캡슐을 찾고 있어요.</Text></View>
            : !props.serverOk ? <View style={s.empty}><Text style={s.emptyTitle}>캡슐을 불러오지 못했어요</Text>{expanded && props.error && <Text style={s.emptyHint}>{props.error}</Text>}<Pressable accessibilityRole="button" onPress={() => void props.onRefresh()} style={s.retry}><Text style={s.link}>다시 불러오기</Text></Pressable></View>
              : !visible.length ? <View style={s.empty}><Text style={s.emptyTitle}>{props.capsules.length ? '이 상태의 캡슐은 아직 없어요.' : '아직은 깨끗한 땅이에요.'}</Text><Text style={s.emptyHint}>{props.capsules.length ? '다른 상태를 선택해 보세요.' : '오른쪽 캡슐 묻기로 첫 기억을 남겨요.'}</Text></View>
                : visible.map(capsule => {
                  const state = capsuleState(capsule, props.now);
                  return <Pressable key={capsule.id} accessibilityRole="button" accessibilityLabel={`${capsule.title}, ${capsule.placeName}, 약속 보기`} onPress={() => props.onSelect(capsule)} style={({ pressed }) => [s.card, pressed && s.pressed]}>
                    <View style={[s.capsuleIcon, state === 'opened' && { backgroundColor: C.peach }]}><CapsuleArt size={54} small/></View>
                    <View style={s.cardCopy}><View style={s.cardHeading}><Text style={s.cardStatus}>{state === 'opened' ? '열어본 캡슐' : state === 'ready' ? '꺼낼 시간이 됐어요' : '기다리는 중'}</Text><Text style={s.party}>{capsule.groupId ? `함께 ${capsule.participantCount}명` : '나 혼자'}</Text></View>
                      <Text style={s.cardTitle} numberOfLines={1}>{capsule.title}</Text><Text style={s.cardPlace} numberOfLines={1}>{capsule.placeName} · {new Date(capsule.opensAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</Text></View>
                    <Text style={s.chevron}>›</Text>
                  </Pressable>;
                })}
          {expanded && <><Text style={s.footnote}>시간이 지나도, 묻은 장소에서만 열려요.{ '\n' }공동 캡슐은 약속한 사람 모두 함께.</Text><Pressable accessibilityRole="button" accessibilityLabel="캡슐 목록 새로고침" onPress={() => void props.onRefresh()} style={s.retry}><Text style={s.link}>목록 새로고침</Text></Pressable></>}
        </ScrollView>
      </Animated.View>
    </>}
  </View>;
}
const s = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: '#EAF1ED' },
  topBar: { position: 'absolute', top: 14, left: 16, right: 16, borderRadius: 20, backgroundColor: C.background, minHeight: 70, paddingLeft: 19, paddingRight: 8, flexDirection: 'row', alignItems: 'center', boxShadow: '0 3px 12px rgba(53,74,82,.09)', elevation: 3 },
  brand: { flex: 1 }, brandName: { fontSize: 21, fontWeight: '800', color: C.ink, letterSpacing: -.9 }, brandHint: { color: C.muted, fontSize: 10, marginTop: 5 },
  topAction: { width: 45, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 2 }, topIcon: { fontSize: 23, color: C.primary }, topActionText: { fontSize: 10, color: C.muted },
  mapCaption: { pointerEvents: 'none', position: 'absolute', top: 96, left: 18, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 8, backgroundColor: '#FFFEFAEB' }, mapCaptionText: { color: C.muted, fontSize: 10 },
  actions: { position: 'absolute', right: 16, top: 141, alignItems: 'flex-end', gap: 12 },
  bury: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 52, paddingHorizontal: 14, borderRadius: 17, backgroundColor: C.primary, boxShadow: '0 3px 8px rgba(53,74,82,.16)', elevation: 4 },
  buryPlus: { color: '#fff', fontSize: 23 }, buryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  location: { width: 46, height: 46, borderRadius: 16, backgroundColor: C.background, alignItems: 'center', justifyContent: 'center', elevation: 2 }, locationIcon: { color: C.primary, fontSize: 29 },
  perspectiveText: { color: C.primary, fontSize: 13, fontWeight: '800' },
  locationError: { position: 'absolute', left: 16, right: 16, top: 260, borderRadius: 14, backgroundColor: C.errorBackground, padding: 13, flexDirection: 'row', alignItems: 'center' }, locationErrorText: { flex: 1, color: C.error, fontSize: 12, lineHeight: 20 }, dismiss: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, closeText: { color: C.error, fontSize: 25 },
  drawer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.background, borderTopLeftRadius: 27, borderTopRightRadius: 27, boxShadow: '0 -4px 18px rgba(53,74,82,.12)', elevation: 8, overflow: 'hidden' },
  dragArea: { minHeight: 73 },
  drawerHandle: { paddingHorizontal: 22, paddingTop: 11, paddingBottom: 14, minHeight: 73 }, grabber: { alignSelf: 'center', width: 34, height: 4, borderRadius: 2, backgroundColor: '#CAD8DE', marginBottom: 17 },
  drawerHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, drawerTitle: { color: C.ink, fontSize: 18, fontWeight: '700' }, count: { color: C.primary, fontWeight: '500' }, drawerHint: { color: C.muted, fontSize: 10 },
  filters: { flexDirection: 'row', gap: 5, paddingHorizontal: 16, paddingBottom: 13 }, filter: { flex: 1, minHeight: 37, justifyContent: 'center', alignItems: 'center', borderRadius: 10, backgroundColor: '#F0F3F3' }, filterSelected: { backgroundColor: C.sky }, filterText: { fontSize: 11, color: C.muted }, filterTextSelected: { color: C.primary, fontWeight: '700' },
  list: { flex: 1 }, listContent: { paddingHorizontal: 18, paddingBottom: 18 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: C.line }, capsuleIcon: { width: 57, height: 60, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: C.sky },
  cardCopy: { flex: 1 }, cardHeading: { flexDirection: 'row', gap: 7, alignItems: 'center', flexWrap: 'wrap' }, cardStatus: { fontSize: 10, color: C.primary }, party: { fontSize: 10, color: C.muted }, cardTitle: { color: C.ink, fontSize: 15, fontWeight: '600', marginTop: 7 }, cardPlace: { color: C.muted, fontSize: 11, marginTop: 7 }, chevron: { fontSize: 24, color: C.muted },
  empty: { paddingTop: 10, paddingBottom: 14, alignItems: 'center', gap: 9 }, emptyTitle: { color: C.ink, fontSize: 14, fontWeight: '600' }, emptyHint: { color: C.muted, fontSize: 12, lineHeight: 20, textAlign: 'center' },
  footnote: { color: C.muted, fontSize: 11, lineHeight: 20, textAlign: 'center', marginTop: 22 }, retry: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }, link: { color: C.primary, fontSize: 12 }, pressed: { opacity: .75 },
});
