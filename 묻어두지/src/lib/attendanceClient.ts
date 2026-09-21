import type { AttendanceResponse, Eligibility, LocationFix } from '../shared/contracts';

export type AttendanceTransport = {
  startAttendance(id: string, fix: LocationFix): Promise<AttendanceResponse>;
  heartbeat(id: string, token: string, sequence: number, fix: LocationFix): Promise<AttendanceResponse>;
  leaveAttendance(id: string, token: string): Promise<unknown>;
};

/** A cancellable per-screen lease. A late request must not resurrect attendance. */
export function createAttendanceClient(transport: AttendanceTransport) {
  let generation = 0;
  let lease: { id: string; token: string; sequence: number } | null = null;
  const release = (value: { id: string; token: string }) => { void transport.leaveAttendance(value.id, value.token).catch(() => undefined); };
  return {
    stop() { generation++; if (lease) release(lease); lease = null; },
    token(id: string) { return lease?.id === id ? lease.token : undefined; },
    async start(id: string, fix: LocationFix): Promise<Eligibility | null> {
      const intent = ++generation;
      if (lease) release(lease);
      lease = null;
      try {
        const result = await transport.startAttendance(id, fix);
        if (intent !== generation) { release({ id, token: result.attendanceToken }); return null; }
        lease = { id, token: result.attendanceToken, sequence: 0 };
        return result.eligibility;
      } catch (error) {
        if (intent !== generation) return null;
        throw error;
      }
    },
    async heartbeat(fix: LocationFix): Promise<Eligibility | null> {
      const current = lease;
      const intent = generation;
      if (!current) return null;
      const sequence = ++current.sequence;
      try {
        const result = await transport.heartbeat(current.id, current.token, sequence, fix);
        if (intent !== generation || current !== lease || sequence !== current.sequence) return null;
        return result.eligibility;
      } catch (error) {
        if (intent !== generation || current !== lease || sequence !== current.sequence) return null;
        throw error;
      }
    },
  };
}
