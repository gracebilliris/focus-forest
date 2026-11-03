import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, validateDuration, startSession, pauseSession, resumeSession,
  cancelSession, reconcile, getRemainingMs, getProgress, getStats, resetHistory,
  serialize, deserialize,
} from '../src/engine.js';

const NOW = new Date(2026, 10, 3, 12).getTime();
const start = (options = {}) => startSession(createState(NOW), {
  focusMinutes: 1, breakMinutes: 0, label: 'Read', species: 'birch', ...options,
}, NOW);

test('validates whole minute inputs and rejects invalid durations', () => {
  for (const value of [1, 180, '25', ' 5 ']) {
    assert.equal(validateDuration(value), Number(value));
  }
  for (const value of [0, -1, 181, 1.5, '', ' ', 'oops', null, true, [], Infinity, NaN]) {
    assert.throws(() => validateDuration(value), RangeError);
  }
  assert.throws(() => start({ breakMinutes: -1 }), RangeError);
  assert.throws(() => start({ species: 'oak' }), RangeError);
});

test('absolute deadlines complete focus once after a long background interval', () => {
  const original = start();
  const snapshot = serialize(original);
  assert.equal(getRemainingMs(original, NOW + 15_000), 45_000);
  assert.equal(getProgress(original, NOW + 15_000), 0.25);
  assert.equal(getRemainingMs(original, NOW - 10_000), 60_000);
  assert.equal(reconcile(original, NOW + 59_999).history.length, 0);
  const completed = reconcile(original, NOW + 600_000);
  assert.equal(completed.session, null);
  assert.deepEqual(completed.history[0], {
    id: original.session.id, label: 'Read', species: 'birch',
    completedAt: NOW + 60_000, minutes: 1, demo: false,
  });
  assert.equal(reconcile(completed, NOW + 900_000).history.length, 1);
  assert.equal(serialize(original), snapshot);
  assert.notEqual(start().session.id, original.session.id);
});

test('pause freezes remaining time and resume establishes a fresh deadline', () => {
  const running = start();
  const paused = pauseSession(running, NOW + 20_000);
  assert.equal(paused.session.status, 'paused');
  assert.equal(paused.session.deadline, null);
  assert.equal(getRemainingMs(paused, NOW + 3_600_000), 40_000);
  const resumed = resumeSession(paused, NOW + 3_600_000);
  assert.equal(resumed.session.deadline, NOW + 3_640_000);
  assert.equal(reconcile(resumed, NOW + 3_639_999).history.length, 0);
  assert.equal(reconcile(resumed, NOW + 3_640_000).history.length, 1);
  assert.equal(running.session.status, 'running');
});

test('focus completion leaves an idle break that resumes manually without more trees', () => {
  const ready = reconcile(start({ breakMinutes: 5 }), NOW + 60_000);
  assert.equal(ready.session.phase, 'break');
  assert.equal(ready.session.status, 'ready');
  assert.equal(ready.session.deadline, null);
  assert.equal(getRemainingMs(ready, NOW + 900_000), 300_000);
  const running = resumeSession(ready, NOW + 900_000);
  const finished = reconcile(running, NOW + 1_200_000);
  assert.equal(finished.session, null);
  assert.equal(finished.history.length, 1);
  assert.equal(pauseSession(start({ breakMinutes: 5 }), NOW + 60_000).session.status, 'ready');
});

test('running and paused sessions survive serialization; expired reload is idempotent', () => {
  const running = start();
  const restored = deserialize(serialize(running), NOW + 30_000);
  assert.equal(getRemainingMs(restored, NOW + 30_000), 30_000);
  const paused = pauseSession(restored, NOW + 40_000);
  assert.equal(getRemainingMs(deserialize(serialize(paused), NOW + 900_000), NOW + 900_000), 20_000);
  const resumed = resumeSession(paused, NOW + 900_000);
  assert.deepEqual(deserialize(serialize(resumed), NOW + 900_000), resumed);
  const completed = deserialize(serialize(running), NOW + 600_000);
  assert.equal(completed.history.length, 1);
  assert.equal(deserialize(serialize(completed), NOW + 900_000).history.length, 1);
  const duplicate = { ...running, history: completed.history };
  assert.equal(deserialize(serialize(duplicate), NOW + 600_000).history.length, 1);
});

test('cancellation discards unfinished focus but preserves legitimately expired focus', () => {
  const running = start();
  assert.equal(cancelSession(running, NOW + 10_000).history.length, 0);
  assert.equal(cancelSession(running, NOW + 10_000).session, null);
  assert.equal(cancelSession(running, NOW + 60_000).history.length, 1);
  assert.equal(running.session.status, 'running');
});

test('demo is explicitly ten seconds and records fractional demo minutes', () => {
  const demo = start({ demo: true, focusMinutes: 25 });
  assert.equal(getRemainingMs(demo, NOW), 10_000);
  assert.equal(reconcile(demo, NOW + 9_999).history.length, 0);
  const completed = reconcile(demo, NOW + 10_000);
  assert.equal(completed.history[0].minutes, 1 / 6);
  assert.equal(completed.history[0].demo, true);
});

test('statistics use local completion dates and reset keeps an active session', () => {
  const yesterday = new Date(2026, 10, 2, 12).getTime();
  const old = reconcile(startSession(createState(yesterday), {
    focusMinutes: 25, breakMinutes: 0,
  }, yesterday), yesterday + 25 * 60_000);
  const active = startSession(old, { focusMinutes: 1, breakMinutes: 0 }, NOW);
  const completed = reconcile(active, NOW + 60_000);
  assert.deepEqual(getStats(completed, NOW + 60_000), {
    todayMinutes: 1, totalMinutes: 26, todaySessions: 1, totalSessions: 2,
  });
  assert.deepEqual(getStats(active, NOW + 60_000), getStats(completed, NOW + 60_000));
  const reset = resetHistory(active);
  assert.equal(reset.session, active.session);
  assert.equal(reset.history.length, 0);
  assert.equal(active.history.length, 1);
  assert.equal(reconcile(reset, NOW + 60_000).history.length, 1);
});

test('corrupted persistence is sanitized and duplicate history IDs are removed', () => {
  for (const raw of ['no json', 'null', '[]', '{"version":2}', '{}']) {
    assert.deepEqual(deserialize(raw, NOW), createState(NOW));
  }
  const entry = reconcile(start(), NOW + 60_000).history[0];
  const restored = deserialize(JSON.stringify({
    version: 1,
    settings: { focusMinutes: -1, breakMinutes: 999, species: 'oak', sound: 'true', reducedMotion: true },
    history: [null, entry, entry, { ...entry, id: 'bad', minutes: -5 }],
    session: { ...start().session, deadline: 'bad' },
  }), NOW);
  assert.deepEqual(restored.settings, {
    focusMinutes: 25, breakMinutes: 5, species: 'pine', sound: false, reducedMotion: true,
  });
  assert.equal(restored.history.length, 1);
  assert.equal(restored.session, null);
});
