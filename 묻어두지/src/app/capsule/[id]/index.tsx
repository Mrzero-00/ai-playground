import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { autoSealReason, deriveStatus } from '@/domain/capsule';
import { ContributeScreen } from '@/screens/contribute';
import { OpenedScreen } from '@/screens/opened';
import { UnlockScreen } from '@/screens/unlock';
import { WaitingScreen } from '@/screens/waiting';
import { useCapsuleStore } from '@/state/capsule-store';

export default function CapsuleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getCapsule, refresh, loading } = useCapsuleStore();
  const capsule = id ? getCapsule(id) : null;
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // 불러오는 중에는 기다리고, 다 불러왔는데도 없으면(초대 안 된 캡슐 등) 홈으로.
  useEffect(() => {
    if (!capsule && !loading) router.replace('/');
  }, [capsule, loading]);

  // 저절로 닫히는 조건(마감 도달, 전원 5개 완료)은 백엔드가 판정한다. 조건이 보이면 다시 불러와 반영한다.
  useEffect(() => {
    if (capsule && autoSealReason(capsule, now)) void refresh();
  }, [capsule, now, refresh]);

  if (!capsule) return null;

  const status = deriveStatus(capsule, now);
  if (status === 'collecting') return <ContributeScreen capsule={capsule} now={now} />;
  if (status === 'sealed') return <WaitingScreen capsule={capsule} now={now} />;
  if (status === 'unlockable') return <UnlockScreen capsule={capsule} />;
  return <OpenedScreen capsule={capsule} now={now} />;
}
