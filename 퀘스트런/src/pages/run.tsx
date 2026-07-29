import { createRoute, useNavigation } from '@granite-js/react-native';
import React, { useState } from 'react';
import { applyCompletedRun } from '../domain/gameState';
import type { CompletedRun } from '../domain/runTracking';
import { usePersistentGameState } from '../hooks/usePersistentGameState';
import { RunConsentScreen } from '../screens/RunConsentScreen';
import { RunningScreen, RunSummaryScreen } from '../screens/RunningScreen';

export const Route = createRoute('/run', {
  component: RunDeepLinkScreen,
});

type RunStep = 'consent' | 'running' | 'summary';

function RunDeepLinkScreen() {
  const navigation = useNavigation();
  const [step, setStep] = useState<RunStep>('consent');
  const [completedRun, setCompletedRun] = useState<CompletedRun | null>(null);
  const { gameState, updateGameState } = usePersistentGameState();

  if (step === 'consent') {
    return (
      <RunConsentScreen
        onCancel={() => navigation.navigate('/')}
        onContinue={() => setStep('running')}
      />
    );
  }

  if (step === 'summary' && completedRun != null) {
    return (
      <RunSummaryScreen
        gameState={gameState}
        onContinue={() => {
          updateGameState((current) => applyCompletedRun(current, completedRun));
          navigation.navigate('/');
        }}
        run={completedRun}
      />
    );
  }

  return (
    <RunningScreen
      onCancel={() => navigation.navigate('/')}
      onFinish={(run) => {
        setCompletedRun(run);
        setStep('summary');
      }}
    />
  );
}
