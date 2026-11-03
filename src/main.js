import './styles.css';
import {
  createState, deserialize, serialize, validateDuration, startSession,
  pauseSession, resumeSession, cancelSession, reconcile, getRemainingMs,
  getProgress, getStats, resetHistory,
} from './engine.js';
import { renderForest } from './forest.js';

const KEY = 'focus-forest-v1';
const $ = id => document.getElementById(id);
let state = createState();
let audio;
let lastForestKey = '';
let lastHistory = '';
let storageAvailable = true;

function announce(message) {
  $('announcement').textContent = message;
}

function save() {
  try {
    localStorage.setItem(KEY, serialize(state));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
    announce('Browser storage is unavailable or full. This session cannot be saved on reload. Export your history.');
  }
  document.querySelector('.local-badge').lastChild.textContent = storageAvailable
    ? ' Just you. Saved locally.' : ' Not saved — storage unavailable';
  $('storage-warning').hidden = storageAvailable;
}

try {
  state = deserialize(localStorage.getItem(KEY), Date.now());
} catch {
  storageAvailable = false;
}
save();

function syncInputs() {
  $('focus-duration').value = state.settings.focusMinutes;
  $('break-duration').value = state.settings.breakMinutes;
  $('sound-toggle').checked = state.settings.sound;
  $('motion-toggle').checked = state.settings.reducedMotion;
  $('session-label').value = state.session?.label ?? '';
}

function readDurations() {
  const result = {};
  for (const [id, key] of [['focus-duration', 'focusMinutes'], ['break-duration', 'breakMinutes']]) {
    const input = $(id);
    input.setCustomValidity('');
    try {
      result[key] = validateDuration(input.value);
    } catch (error) {
      input.setCustomValidity(error.message);
      input.reportValidity();
      input.focus();
      throw error;
    }
  }
  return result;
}

function unlockAudio() {
  if (!state.settings.sound) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (Audio) {
      audio ??= new Audio();
      void audio.resume().catch(() => {});
    }
  } catch { /* Audio is optional when browser policy or hardware blocks it. */ }
}

function chime() {
  if (!state.settings.sound || audio?.state !== 'running') return;
  for (const [index, frequency] of [523.25, 659.25, 783.99].entries()) {
    const oscillator = audio.createOscillator();
    const volume = audio.createGain();
    const at = audio.currentTime + index * 0.18;
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    volume.gain.setValueAtTime(0, at);
    volume.gain.linearRampToValueAtTime(0.055, at + 0.025);
    volume.gain.exponentialRampToValueAtTime(0.001, at + 0.7);
    oscillator.connect(volume);
    volume.connect(audio.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.75);
  }
}

function render(now = Date.now()) {
  const session = state.session;
  const running = session?.status === 'running';
  const paused = session?.status === 'paused';
  const ready = session?.status === 'ready';
  const isBreak = session?.phase === 'break';
  const remaining = session ? getRemainingMs(state, now) : state.settings.focusMinutes * 60_000;
  const seconds = Math.ceil(remaining / 1000);
  $('timer-display').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  $('phase-label').textContent = isBreak ? 'A MOMENT TO REST' : session?.demo ? '10-SECOND DEMO' : 'TIME TO FOCUS';
  $('timer-status').textContent = ready ? 'A tree is planted. Your break starts only when you choose.'
    : paused ? 'Paused. Your tree can wait for you.'
    : running ? (isBreak ? 'Rest a little. You have earned it.' : 'Keep tending to one thing. Your tree is growing.')
    : 'Ready when you are. Your next tree starts here.';
  $('timer-progress').value = session ? getProgress(state, now) : 0;
  const activeElement = document.activeElement;
  $('start-button').hidden = !!session;
  $('demo-button').hidden = !!session;
  $('pause-button').hidden = !running;
  $('resume-button').hidden = !paused;
  $('break-button').hidden = !ready;
  $('cancel-button').hidden = !session;
  $('cancel-button').textContent = isBreak ? 'Skip break' : 'Cancel session';
  for (const id of ['focus-duration', 'break-duration', 'session-label']) $(id).disabled = !!session;
  document.querySelectorAll('[data-species]').forEach(button => {
    button.disabled = !!session;
    button.setAttribute('aria-pressed', String(button.dataset.species === state.settings.species));
  });
  document.body.classList.toggle('reduced-motion', state.settings.reducedMotion);
  const stats = getStats(state, now);
  const minutes = value => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
  $('today-minutes').textContent = minutes(stats.todayMinutes);
  $('total-minutes').textContent = minutes(stats.totalMinutes);
  $('today-sessions').textContent = stats.todaySessions;
  $('total-sessions').textContent = stats.totalSessions;
  $('tree-count').textContent = state.history.length;
  const historyKey = JSON.stringify(state.history);
  if (historyKey !== lastHistory) {
    lastHistory = historyKey;
    if (state.history.length) {
      $('history-list').replaceChildren(...state.history.slice().reverse().map(entry => {
        const item = document.createElement('li');
        item.className = 'history-row';
        const title = document.createElement('strong');
        title.textContent = entry.label;
        const meta = document.createElement('span');
        meta.className = 'history-meta';
        const date = new Date(entry.completedAt).toLocaleString(undefined, {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        });
        meta.textContent = `${entry.demo ? 'Demo · 10 sec' : `${entry.minutes} min`} · ${entry.species} · ${date}`;
        item.append(title, meta);
        return item;
      }));
    } else {
      const empty = document.createElement('li');
      empty.className = 'empty-history';
      empty.textContent = 'Your forest is a fresh start. Finish a session to plant your first tree.';
      $('history-list').replaceChildren(empty);
    }
  }
  const growth = session && !isBreak ? getProgress(state, now) : null;
  const forestKey = `${historyKey}/${growth === null ? 'idle' : growth.toFixed(2)}/${state.settings.species}`;
  if (forestKey !== lastForestKey) {
    lastForestKey = forestKey;
    renderForest($('forest-scene'), state.history, growth, state.settings.species);
  }
  if (activeElement?.hidden) {
    $(running ? 'pause-button' : paused ? 'resume-button' : ready ? 'break-button' : 'start-button').focus({ preventScroll: true });
  }
}

function tick() {
  const previous = state;
  const now = Date.now();
  state = reconcile(state, now);
  if (previous.session !== state.session || previous.history !== state.history) {
    save();
    chime();
    announce(state.session?.status === 'ready'
      ? 'Focus complete. Your permanent tree is planted. Start your break when ready.'
      : 'Break complete. Ready for another focus session.');
  }
  render(now);
}

function apply(action, message) {
  tick();
  state = action(state, Date.now());
  save();
  render();
  announce(message);
}

function start(demo) {
  try {
    const durations = readDurations();
    unlockAudio();
    apply((current, now) => startSession(current, {
      ...durations, species: current.settings.species, label: $('session-label').value, demo,
    }, now), demo ? 'Ten-second demo started. Demo time is recorded as ten seconds, not 25 minutes.' : 'Focus session started.');
  } catch { /* The invalid field has an inline browser validation message. */ }
}

$('start-button').addEventListener('click', () => start(false));
$('demo-button').addEventListener('click', () => start(true));
$('pause-button').addEventListener('click', () => apply(pauseSession, 'Session paused.'));
$('resume-button').addEventListener('click', () => { unlockAudio(); apply(resumeSession, 'Session resumed.'); });
$('break-button').addEventListener('click', () => { unlockAudio(); apply(resumeSession, 'Break started.'); });
$('cancel-button').addEventListener('click', () => apply(cancelSession, 'Session ended. Incomplete focus time is not recorded.'));
for (const id of ['focus-duration', 'break-duration']) {
  $(id).addEventListener('input', () => $(id).setCustomValidity(''));
  $(id).addEventListener('change', () => {
    try {
      state = { ...state, settings: { ...state.settings, ...readDurations() } };
      save();
      render();
    } catch { /* Keep the last valid settings. */ }
  });
}
document.querySelectorAll('[data-species]').forEach(button => button.addEventListener('click', () => {
  state = { ...state, settings: { ...state.settings, species: button.dataset.species } };
  save();
  render();
}));
for (const [id, key] of [['sound-toggle', 'sound'], ['motion-toggle', 'reducedMotion']]) {
  $(id).addEventListener('change', () => {
    state = { ...state, settings: { ...state.settings, [key]: $(id).checked } };
    if (key === 'sound') unlockAudio();
    save();
    render();
  });
}
$('reset-button').addEventListener('click', () => {
  if (window.confirm('Reset your forest and delete all completed session history? This cannot be undone. Your current timer and settings will stay.')) {
    apply(resetHistory, 'Forest and completed history reset. Your current timer and settings are unchanged.');
  }
});
$('export-button').addEventListener('click', () => {
  tick();
  const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), history: state.history }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `focus-forest-history-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce('History exported as JSON.');
});
window.addEventListener('storage', event => {
  if (event.key === KEY || event.key === null) {
    state = deserialize(event.key === null ? null : event.newValue, Date.now());
    syncInputs();
    save();
    render();
    announce('Your forest was updated in another tab.');
  }
});
window.addEventListener('pageshow', tick);
document.addEventListener('visibilitychange', tick);
syncInputs();
render();
// This interval only refreshes the view; absolute timestamps determine elapsed time.
setInterval(tick, 250);
