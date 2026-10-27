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
  const { getCapsule, sealCapsule } = useCapsuleStore();
  const capsule = id ? getCapsule(id) : null;
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!capsule) router.replace('/');
  }, [capsule]);

  // 저절로 닫히는 조건(마감 도달, 전원 5개 완료)은 서버가 판정할 일이지만, 로컬 프로토타입에서는 화면이 대신한다.
  useEffect(() => {
    if (capsule && autoSealReason(capsule, now)) sealCapsule(capsule.id);
  }, [capsule, now, sealCapsule]);

  if (!capsule) return null;

  const status = deriveStatus(capsule, now);
  if (status === 'collecting') return <ContributeScreen capsule={capsule} now={now} />;
  if (status === 'sealed') return <WaitingScreen capsule={capsule} now={now} />;
  if (status === 'unlockable') return <UnlockScreen capsule={capsule} />;
  return <OpenedScreen capsule={capsule} now={now} />;
}
