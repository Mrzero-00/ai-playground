import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { deriveStatus } from '@/domain/capsule';
import { ContributeScreen } from '@/screens/contribute';
import { OpenedScreen } from '@/screens/opened';
import { UnlockScreen } from '@/screens/unlock';
import { WaitingScreen } from '@/screens/waiting';
import { useCapsuleStore } from '@/state/capsule-store';

export default function CapsuleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getCapsule } = useCapsuleStore();
  const capsule = id ? getCapsule(id) : null;
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!capsule) router.replace('/');
  }, [capsule]);

  if (!capsule) return null;

  const status = deriveStatus(capsule, now);
  if (status === 'collecting') return <ContributeScreen capsule={capsule} now={now} />;
  if (status === 'sealed') return <WaitingScreen capsule={capsule} now={now} />;
  if (status === 'unlockable') return <UnlockScreen capsule={capsule} />;
  return <OpenedScreen capsule={capsule} now={now} />;
}
