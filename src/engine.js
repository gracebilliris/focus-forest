const MINUTE = 60_000;
const SPECIES = new Set(['birch', 'pine', 'maple']);
const DEFAULT_SETTINGS = {
  focusMinutes: 25,
  breakMinutes: 5,
  species: 'pine',
  sound: false,
  reducedMotion: false,
};

let sequence = 0;

export function validateDuration(value) {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    (typeof value === 'string' && !value.trim())
  ) throw new RangeError('Duration must be a whole number from 1 to 180 minutes.');
  const minutes = Number(value);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) {
    throw new RangeError('Duration must be a whole number from 1 to 180 minutes.');
  }
  return minutes;
}

function breakDuration(value) {
  return value === 0 || value === '0' ? 0 : validateDuration(value);
}

function timestamp(now) {
  if (!Number.isFinite(now) || now < 0) throw new RangeError('Invalid timestamp.');
  return now;
}

function labelText(label) {
  return typeof label === 'string' && label.trim()
    ? label.trim().slice(0, 120)
    : 'Focus session';
}

function durationMs(session) {
  return session.phase === 'break'
    ? session.breakMinutes * MINUTE
    : session.demo ? 10_000 : session.focusMinutes * MINUTE;
}

export function createState(now = Date.now()) {
  timestamp(now);
  return { version: 1, session: null, history: [], settings: { ...DEFAULT_SETTINGS } };
}

export function startSession(state, options = {}, now = Date.now()) {
  timestamp(now);
  const current = reconcile(state, now);
  const focusMinutes = validateDuration(options.focusMinutes ?? current.settings.focusMinutes);
  const breakMinutes = breakDuration(options.breakMinutes ?? current.settings.breakMinutes);
  const species = options.species ?? current.settings.species;
  if (!SPECIES.has(species)) throw new RangeError('Unknown tree species.');
  const demo = options.demo === true;
  const remainingMs = demo ? 10_000 : focusMinutes * MINUTE;
  return {
    ...current,
    settings: { ...current.settings, focusMinutes, breakMinutes, species },
    session: {
      id: globalThis.crypto?.randomUUID?.() ??
        `${now.toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2)}`,
      label: labelText(options.label),
      species,
      focusMinutes,
      breakMinutes,
      demo,
      phase: 'focus',
      status: 'running',
      startedAt: now,
      remainingMs,
      deadline: now + remainingMs,
    },
  };
}

export function getRemainingMs(state, now = Date.now()) {
  timestamp(now);
  if (!state.session) return 0;
  const session = state.session;
  return Math.max(0, Math.min(
    durationMs(session),
    session.status === 'running' ? session.deadline - now : session.remainingMs,
  ));
}

export function getProgress(state, now = Date.now()) {
  return state.session ? 1 - getRemainingMs(state, now) / durationMs(state.session) : 0;
}

export function reconcile(state, now = Date.now()) {
  timestamp(now);
  const session = state.session;
  if (!session || session.status !== 'running' || session.deadline > now) {
    return { ...state };
  }
  if (session.phase === 'break') return { ...state, session: null };
  const history = state.history.some(entry => entry.id === session.id)
    ? state.history
    : [...state.history, {
      id: session.id,
      label: session.label,
      species: session.species,
      completedAt: session.deadline,
      minutes: session.demo ? 1 / 6 : session.focusMinutes,
      demo: session.demo,
    }];
  return {
    ...state,
    history,
    session: session.breakMinutes > 0 ? {
      ...session,
      phase: 'break',
      status: 'ready',
      remainingMs: session.breakMinutes * MINUTE,
      deadline: null,
    } : null,
  };
}

export function pauseSession(state, now = Date.now()) {
  const current = reconcile(state, now);
  if (current.session?.status !== 'running') return current;
  return {
    ...current,
    session: {
      ...current.session,
      status: 'paused',
      remainingMs: getRemainingMs(current, now),
      deadline: null,
    },
  };
}

// A completed focus leaves a ready break; resumeSession starts that break manually.
export function resumeSession(state, now = Date.now()) {
  const current = reconcile(state, now);
  if (!current.session || current.session.status === 'running') return current;
  return {
    ...current,
    session: {
      ...current.session,
      status: 'running',
      deadline: now + current.session.remainingMs,
    },
  };
}

export function cancelSession(state, now = Date.now()) {
  return { ...reconcile(state, now), session: null };
}

function localDate(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function getStats(state, now = Date.now()) {
  const current = reconcile(state, now);
  const today = localDate(now);
  return current.history.reduce((stats, entry) => {
    stats.totalMinutes += entry.minutes;
    stats.totalSessions += 1;
    if (localDate(entry.completedAt) === today) {
      stats.todayMinutes += entry.minutes;
      stats.todaySessions += 1;
    }
    return stats;
  }, { todayMinutes: 0, totalMinutes: 0, todaySessions: 0, totalSessions: 0 });
}

export function resetHistory(state) {
  return { ...state, history: [] };
}

export function serialize(state) {
  return JSON.stringify(state);
}

function safeDuration(value, fallback, allowZero = false) {
  try {
    return allowZero ? breakDuration(value) : validateDuration(value);
  } catch {
    return fallback;
  }
}

function validTime(value) {
  return Number.isFinite(value) && value >= 0 && value <= 8_640_000_000_000_000;
}

function validId(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
}

export function deserialize(raw, now = Date.now()) {
  const state = createState(now);
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return state;
  }
  if (!data || typeof data !== 'object' || data.version !== 1) return state;
  const settings = data.settings ?? {};
  state.settings = {
    focusMinutes: safeDuration(settings.focusMinutes, 25),
    breakMinutes: safeDuration(settings.breakMinutes, 5, true),
    species: SPECIES.has(settings.species) ? settings.species : 'pine',
    sound: settings.sound === true,
    reducedMotion: settings.reducedMotion === true,
  };
  const ids = new Set();
  for (const entry of Array.isArray(data.history) ? data.history : []) {
    if (!entry || !validId(entry.id) || ids.has(entry.id) ||
      !SPECIES.has(entry.species) || !validTime(entry.completedAt)) continue;
    const demo = entry.demo === true;
    const minutes = demo ? 1 / 6 : safeDuration(entry.minutes, null);
    if (minutes === null) continue;
    ids.add(entry.id);
    state.history.push({
      id: entry.id,
      label: labelText(entry.label),
      species: entry.species,
      completedAt: entry.completedAt,
      minutes,
      demo,
    });
  }
  const session = data.session;
  if (!session || !validId(session.id) || !SPECIES.has(session.species) ||
    !['focus', 'break'].includes(session.phase) ||
    !['running', 'paused', 'ready'].includes(session.status) ||
    (session.status === 'ready' && session.phase !== 'break')) return state;
  const focusMinutes = safeDuration(session.focusMinutes, null);
  const breakMinutes = safeDuration(session.breakMinutes, null, true);
  if (focusMinutes === null || breakMinutes === null ||
    (session.phase === 'break' && breakMinutes === 0)) return state;
  const restored = {
    id: session.id,
    label: labelText(session.label),
    species: session.species,
    focusMinutes,
    breakMinutes,
    demo: session.demo === true,
    phase: session.phase,
    status: session.status,
    startedAt: validTime(session.startedAt) ? session.startedAt : now,
    remainingMs: session.remainingMs,
    deadline: session.status === 'running' ? session.deadline : null,
  };
  if (restored.status === 'running') {
    if (!validTime(restored.deadline)) return state;
    restored.remainingMs = Number.isFinite(restored.remainingMs) && restored.remainingMs > 0
      ? Math.min(durationMs(restored), restored.remainingMs)
      : durationMs(restored);
  } else {
    if (!Number.isFinite(restored.remainingMs) || restored.remainingMs <= 0) return state;
    restored.remainingMs = Math.min(durationMs(restored), restored.remainingMs);
  }
  state.session = restored;
  return reconcile(state, now);
}
