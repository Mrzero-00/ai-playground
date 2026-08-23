import { Accuracy, setScreenAwakeMode, startUpdateLocation, type Location } from '@apps-in-toss/framework';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  EMPTY_RUN_TRACK,
  appendRunPoint,
  calculateAveragePaceSecondsPerKm,
  calculateAverageSpeedKmh,
  type RunTrack,
} from '../domain/runTracking';

export type TrackingStatus = 'requesting' | 'active' | 'paused' | 'denied' | 'error';

export function useRunningSession() {
  const [track, setTrack] = useState<RunTrack>(EMPTY_RUN_TRACK);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>('requesting');
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [restartToken, setRestartToken] = useState(0);
  const pausedRef = useRef(false);
  const startedAtRef = useRef(Date.now());
  const hasSessionStartedRef = useRef(false);

  useEffect(() => {
    let active = true;
    let stopTracking: (() => void) | undefined;

    async function startTracking() {
      setTrackingStatus('requesting');
      setErrorMessage(null);

      try {
        let permission = await startUpdateLocation.getPermission();
        if (permission !== 'allowed') {
          permission = await startUpdateLocation.openPermissionDialog();
        }

        if (!active) {
          return;
        }

        if (permission !== 'allowed') {
          setTrackingStatus('denied');
          return;
        }

        if (!hasSessionStartedRef.current) {
          startedAtRef.current = Date.now();
          hasSessionStartedRef.current = true;
        }

        await setScreenAwakeMode({ enabled: true }).catch(() => undefined);
        stopTracking = startUpdateLocation({
          options: {
            accuracy: Accuracy.Highest,
            timeInterval: 3_000,
            distanceInterval: 5,
          },
          onEvent: (location: Location) => {
            if (!active || pausedRef.current) {
              return;
            }

            setAccuracyMeters(location.coords.accuracy);
            setTrack((current) =>
              appendRunPoint(current, {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                accuracy: location.coords.accuracy,
                timestamp: location.timestamp,
              })
            );
          },
          onError: () => {
            if (active) {
              setTrackingStatus('error');
              setErrorMessage('GPS 위치를 받아오지 못했어요.');
            }
          },
        });

        if (!active) {
          stopTracking();
          return;
        }

        setTrackingStatus('active');
      } catch {
        if (active) {
          setTrackingStatus('error');
          setErrorMessage('위치 권한을 확인하지 못했어요.');
        }
      }
    }

    void startTracking();

    return () => {
      active = false;
      stopTracking?.();
      void setScreenAwakeMode({ enabled: false }).catch(() => undefined);
    };
  }, [restartToken]);

  useEffect(() => {
    if (trackingStatus !== 'active') {
      return;
    }

    const timer = setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
    }, 1_000);

    return () => clearInterval(timer);
  }, [trackingStatus]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        return;
      }

      pausedRef.current = true;
      setTrackingStatus((current) => (current === 'active' ? 'paused' : current));
    });

    return () => subscription.remove();
  }, []);

  const togglePause = useCallback(() => {
    setTrackingStatus((current) => {
      const next = current === 'paused' ? 'active' : 'paused';
      pausedRef.current = next === 'paused';
      return next;
    });
  }, []);

  const retry = useCallback(() => {
    pausedRef.current = false;
    setRestartToken((token) => token + 1);
  }, []);

  return {
    track,
    elapsedSeconds,
    trackingStatus,
    accuracyMeters,
    errorMessage,
    startedAt: startedAtRef.current,
    distanceKm: track.distanceMeters / 1000,
    currentSpeedKmh: Math.round(track.currentSpeedMetersPerSecond * 36) / 10,
    averageSpeedKmh: calculateAverageSpeedKmh(elapsedSeconds, track.distanceMeters),
    maxSpeedKmh: Math.round(track.maxSpeedMetersPerSecond * 36) / 10,
    averagePaceSecondsPerKm: calculateAveragePaceSecondsPerKm(elapsedSeconds, track.distanceMeters),
    togglePause,
    retry,
  };
}
