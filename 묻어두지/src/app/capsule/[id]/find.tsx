import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { ArFindScreen } from '@/screens/ar-find';
import { useCapsuleStore } from '@/state/capsule-store';

export default function FindRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getCapsule } = useCapsuleStore();
  const capsule = id ? getCapsule(id) : null;

  useEffect(() => {
    if (!capsule) router.replace('/');
  }, [capsule]);

  if (!capsule) return null;
  return <ArFindScreen capsule={capsule} />;
}
