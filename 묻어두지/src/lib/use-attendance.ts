import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { api } from '@/lib/api';
import { createAttendanceClient } from '@/lib/attendance-client';
import { currentLocation } from '@/lib/location';
import { ATTENDANCE_REFRESH_MS, type Eligibility, type LocationFix } from '@/shared/contracts';

export function useAttendance(capsuleId: string | null, enabled: boolean,
  onGate: (value: Eligibility) => void, onError: (message: string) => void) {
  const client = useMemo(() => createAttendanceClient(api), []);
  // Participation is remembered per capsule, so switching capsules needs no reset.
  const [participatingFor, setParticipatingFor] = useState<string | null>(null);
  const participating = !!capsuleId && enabled && participatingFor === capsuleId;
  const callbacks = useRef({ onGate, onError });
  useEffect(() => { callbacks.current = { onGate, onError }; });
  const stop = useCallback(() => { client.stop(); setParticipatingFor(null); }, [client]);
  const begin = async (fix: LocationFix) => {
    if (!capsuleId || !enabled || Platform.OS === 'web') return null;
    try {
      const gate = client.token(capsuleId) ? await client.heartbeat(fix) : await client.start(capsuleId, fix);
      if (gate) { setParticipatingFor(capsuleId); callbacks.current.onGate(gate); }
      return gate;
    } catch (error) {
      stop();
      callbacks.current.onError(error instanceof Error ? error.message : '함께 열기에 다시 참여해 주세요.');
      throw error;
    }
  };

  useEffect(() => {
    // Changing capsules or leaving the screen ends the old lease on the server.
    client.stop();
    return () => client.stop();
  }, [capsuleId, enabled, client]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') stop(); });
    return () => subscription.remove();
  }, [stop]);
  useEffect(() => {
    if (!participating || !capsuleId) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        if (AppState.currentState !== 'active') { stop(); return; }
        const fix = await currentLocation();
        if (disposed) return;
        const gate = await client.heartbeat(fix);
        if (disposed) return;
        if (gate) callbacks.current.onGate(gate);
      } catch (error) {
        if (disposed) return;
        stop();
        callbacks.current.onError(error instanceof Error ? error.message : '참석 확인이 끊겼어요. 함께 열기에 다시 참여해 주세요.');
        return;
      }
      if (!disposed) timer = setTimeout(poll, ATTENDANCE_REFRESH_MS);
    };
    timer = setTimeout(poll, ATTENDANCE_REFRESH_MS);
    return () => { disposed = true; clearTimeout(timer); };
  }, [participating, capsuleId, client, stop]);

  return { participating, begin, stop, token: () => (capsuleId ? client.token(capsuleId) : undefined) };
}
