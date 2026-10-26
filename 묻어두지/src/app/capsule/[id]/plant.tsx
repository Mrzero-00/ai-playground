import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { ArPlantScreen } from '@/screens/ar-plant';
import { useCapsuleStore } from '@/state/capsule-store';

export default function PlantRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getCapsule } = useCapsuleStore();
  const capsule = id ? getCapsule(id) : null;

  useEffect(() => {
    if (!capsule) router.replace('/');
  }, [capsule]);

  if (!capsule) return null;
  return <ArPlantScreen capsule={capsule} />;
}
