import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { api } from '../lib/api';
import { MAX_GROUP_MEMBERS, type CapsuleGroup } from '../shared/contracts';
import { styles } from '../styles';
import { colors as C } from '../theme';

export default function GroupLobby({ onChoose, onOpen }: {
  onChoose: (group: CapsuleGroup) => void;
  onOpen: (capsuleId: string) => void;
}) {
  const [groups, setGroups] = useState<CapsuleGroup[]>([]);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [count, setCount] = useState('2');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  const refresh = async () => {
    const result = await api.groups();
    if (mounted.current) setGroups(result.groups);
  };
  useEffect(() => {
    mounted.current = true;
    void refresh().catch(e => { if (mounted.current) setError(e.message); });
    const timer = setInterval(() => { if (!pending.current) void refresh().catch(() => undefined); }, 5_000);
    return () => { mounted.current = false; clearInterval(timer); };
  }, []);
  const run = async (work: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null);
    try { await work(); }
    catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : '모임을 확인하지 못했어요.'); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  const button = (label: string, action: () => void, disabled = false, secondary = false) => (
    <Pressable accessibilityRole="button" disabled={disabled || busy} accessibilityState={{ disabled: disabled || busy }} onPress={action}
      style={[styles.button, secondary && styles.buttonSecondary, (disabled || busy) && styles.disabled]}>
      <Text style={[styles.buttonText, secondary && { color: C.primary }]}>{label}</Text>
    </Pressable>
  );
  return <>
    <Text style={styles.pageEyebrow}>다 같이 있어야 열리는 약속</Text>
    <Text style={styles.pageTitle}>우리끼리 묻어두기</Text>
    <Text style={styles.description}>인원을 정하고 초대 코드를 나눠요. 전원이 참여하면 만든 사람이 사진·편지·음성·영상을 담고 AR로 봉인해요.</Text>
    <View style={styles.note}><Text style={styles.noteText}>봉인 후 명단은 바뀌지 않아요. 나중에 같은 장소에서 각자 앱의 ‘함께 열기’를 눌러야 해요. 초대 코드는 함께할 사람에게만 전달해 주세요.</Text></View>
    {error && <View accessibilityRole="alert" style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}
    <Text style={styles.sectionLabel}>모임에서 부를 내 이름</Text>
    <TextInput accessibilityLabel="모임에서 부를 내 이름" value={name} onChangeText={setName} maxLength={24} placeholder="예: 상일" placeholderTextColor={C.muted} style={styles.input}/>
    <View style={styles.labPanel}>
      <Text style={styles.labTitle}>새 모임 만들기</Text>
      <TextInput accessibilityLabel="모임 이름" value={title} onChangeText={setTitle} maxLength={80} placeholder="예: 우리 셋의 여름" placeholderTextColor={C.muted} style={styles.input}/>
      <Text style={styles.fieldHint}>나를 포함해 함께 열 사람 · 2~{MAX_GROUP_MEMBERS}명</Text>
      <TextInput accessibilityLabel="전체 참여 인원" value={count} onChangeText={setCount} maxLength={2} keyboardType="number-pad" style={styles.input}/>
      {button('초대 코드 만들기', () => void run(async () => {
        if (!/^\d+$/.test(count) || Number(count) < 2 || Number(count) > MAX_GROUP_MEMBERS) throw new Error(`전체 인원은 2~${MAX_GROUP_MEMBERS}명으로 정해 주세요.`);
        const result = await api.createGroup(title.trim(), Number(count), name.trim());
        if (mounted.current) setGroups(previous => [result.group, ...previous.filter(g => g.id !== result.group.id)]);
      }), !name.trim() || !title.trim())}
    </View>
    <View style={styles.labPanel}>
      <Text style={styles.labTitle}>초대받은 모임 참여하기</Text>
      <TextInput accessibilityLabel="초대 코드" autoCapitalize="characters" autoCorrect={false} value={code} onChangeText={value => setCode(value.replace(/\s/g, '').toUpperCase())} maxLength={12} placeholder="12자리 초대 코드" placeholderTextColor={C.muted} style={styles.input}/>
      {button('초대 코드로 참여하기', () => void run(async () => {
        await api.joinGroup(code.trim(), name.trim());
        if (mounted.current) setCode('');
        await refresh();
      }), !name.trim() || code.length !== 12, true)}
    </View>
    <View style={styles.listHeader}><Text style={styles.sectionLabel}>참여 중인 모임</Text>{busy && <ActivityIndicator color={C.primary}/>}</View>
    {button('모임 새로고침', () => void run(refresh), false, true)}
    {groups.length === 0 && <Text style={styles.fieldHint}>아직 참여한 모임이 없어요.</Text>}
    {groups.map(group => <View key={group.id} style={styles.labPanel}>
      <Text style={styles.labTitle}>{group.title}</Text>
      <Text style={styles.labValue}>{group.members.length} / {group.expectedCount}명 참여</Text>
      <Text style={styles.labBody}>{group.members.map(m => `${m.name}${m.isMe ? ' (나)' : ''}`).join(' · ')}</Text>
      {group.inviteCode && <><Text style={styles.fieldHint}>길게 눌러 복사할 수 있어요</Text><Text selectable accessibilityLabel={`초대 코드 ${group.inviteCode}`} style={styles.endpoint}>{group.inviteCode}</Text></>}
      {group.capsuleId ? button('묻어둔 캡슐 보기', () => onOpen(group.capsuleId!), false, true)
        : group.isHost ? button('이 모임의 캡슐 담기', () => onChoose(group), group.members.length !== group.expectedCount)
          : <Text style={styles.fieldHint}>모임을 만든 사람이 내용을 담고 봉인하면 내 약속에도 나타나요.</Text>}
    </View>)}
    <Text style={styles.webNote}>MVP는 기기별 세션으로 참여자를 구분해요. 앱 데이터 삭제·재설치 시 기존 참여 자격을 복구하는 기능은 아직 없어요.</Text>
  </>;
}
