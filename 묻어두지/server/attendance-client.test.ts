import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAttendanceClient, type AttendanceTransport } from '../src/lib/attendanceClient';
import type { AttendanceResponse, Eligibility } from '../src/shared/contracts';

const fix = { latitude: 37, longitude: 127, accuracy: 4, timestamp: 1 };
const gate: Eligibility = { eligible: true, code: 'READY', distanceMeters: 0, radiusMeters: 50, remainingSeconds: 0, serverNow: '2026-09-17T00:00:00.000Z' };
const reply = (token = 'lease'): AttendanceResponse => ({ attendanceToken: token, eligibility: gate });
function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function transport(changes: Partial<AttendanceTransport> = {}) {
  const leaves: string[] = [];
  const api: AttendanceTransport = { startAttendance: async () => reply(), heartbeat: async () => reply(),
    leaveAttendance: async (id, token) => { leaves.push(`${id}:${token}`); }, ...changes };
  return { api, leaves };
}
test('leaving during an in-flight check-in releases its late token and never starts attendance', async () => {
  const pending = deferred<AttendanceResponse>();
  const { api, leaves } = transport({ startAttendance: () => pending.promise });
  const client = createAttendanceClient(api);
  const response = client.start('capsule', fix);
  client.stop(); pending.resolve(reply());
  assert.equal(await response, null); assert.equal(client.token('capsule'), undefined);
  assert.deepEqual(leaves, ['capsule:lease']);
});
test('late heartbeat cannot re-open a closed screen', async () => {
  const pending = deferred<AttendanceResponse>();
  const { api } = transport({ heartbeat: () => pending.promise });
  const client = createAttendanceClient(api);
  await client.start('capsule', fix);
  const response = client.heartbeat(fix); client.stop(); pending.resolve(reply());
  assert.equal(await response, null); assert.equal(client.token('capsule'), undefined);
});
test('late check-in failure cannot cancel a newer capsule attendance', async () => {
  const pending = deferred<AttendanceResponse>();
  const { api } = transport({ startAttendance: id => id === 'old' ? pending.promise : Promise.resolve(reply('new-lease')) });
  const client = createAttendanceClient(api);
  const old = client.start('old', fix);
  await client.start('new', fix);
  pending.reject(new Error('old request failed'));
  assert.equal(await old, null);
  assert.equal(client.token('new'), 'new-lease');
});
test('new capsule replaces old lease and token lookup is scoped by capsule', async () => {
  const { api, leaves } = transport(); const client = createAttendanceClient(api);
  await client.start('one', fix); await client.start('two', fix);
  assert.equal(client.token('one'), undefined); assert.equal(client.token('two'), 'lease');
  assert.deepEqual(leaves, ['one:lease']);
});
test('out-of-order heartbeat results and failures do not overwrite the latest status', async () => {
  const older = deferred<AttendanceResponse>(); const newer = deferred<AttendanceResponse>();
  const sequences: number[] = [];
  const { api } = transport({ heartbeat: (_id, _token, sequence) => {
    sequences.push(sequence); return sequence === 1 ? older.promise : newer.promise;
  } });
  const client = createAttendanceClient(api); await client.start('one', fix);
  const a = client.heartbeat(fix); const b = client.heartbeat(fix);
  newer.resolve(reply()); older.reject(new Error('outdated sequence'));
  assert.deepEqual(await b, gate); assert.equal(await a, null); assert.deepEqual(sequences, [1, 2]);
});
test('failed network departure still drops the local lease; server expiry is the fallback', async () => {
  const { api } = transport({ leaveAttendance: async () => { throw new Error('offline'); } });
  const client = createAttendanceClient(api); await client.start('one', fix); client.stop();
  assert.equal(client.token('one'), undefined); assert.equal(await client.heartbeat(fix), null);
});
