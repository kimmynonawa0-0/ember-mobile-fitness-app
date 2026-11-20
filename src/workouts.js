import { exerciseCatalog } from './exerciseCatalog.js';
export const exercises = exerciseCatalog.map(exercise => exercise.name);
let counter = 0;
function nextId() { return `${Date.now()}-${counter++}`; }
export const MAX_NOTES_LENGTH = 500;
function normalizeNotes(value) {
  return typeof value === 'string' ? value.trim().slice(0, MAX_NOTES_LENGTH) : '';
}
export function newExercise(name) {
  const id = nextId();
  return { id, name, sets: [1, 2, 3].map(n => ({ id: `${id}-${n}`, reps: '10', weight: '', done: false })) };
}
export function repeatWorkout(session, now = new Date()) {
  const source = Array.isArray(session?.exercises) ? session.exercises : [];
  const exercises = source.flatMap(exercise => {
    const name = typeof exercise?.name === 'string' ? exercise.name.trim() : '';
    const sets = Array.isArray(exercise?.sets) ? exercise.sets : [];
    if (!name || !sets.length) return [];
    const id = nextId();
    return [{
      id,
      name,
      sets: sets.map((set, index) => ({
        id: `${id}-${index + 1}`,
        reps: String(set.reps ?? '10'),
        weight: Number(set.weight) > 0 ? String(set.weight) : '',
        done: false,
      })),
    }];
  });
  if (!exercises.length) throw new Error('This workout has no exercises to repeat.');
  return { id: nextId(), startedAt: now.toISOString(), name: typeof session.name === 'string' ? session.name.trim() : '', exercises };
}
export function beginEdit(session) {
  const source = Array.isArray(session?.exercises) ? session.exercises : [];
  const exercises = source.flatMap(exercise => {
    const name = typeof exercise?.name === 'string' ? exercise.name.trim() : '';
    const sets = Array.isArray(exercise?.sets) ? exercise.sets : [];
    if (!name || !sets.length) return [];
    const id = typeof exercise.id === 'string' ? exercise.id : nextId();
    return [{
      ...exercise,
      id,
      name,
      sets: sets.map((set, index) => ({
        ...set,
        id: typeof set.id === 'string' ? set.id : `${id}-${index + 1}`,
        reps: String(set.reps ?? '10'),
        weight: Number(set.weight) > 0 ? String(set.weight) : '',
        done: true,
      })),
    }];
  });
  if (!exercises.length) throw new Error('This workout has no exercises to edit.');
  return {
    id: typeof session.id === 'string' ? session.id : nextId(),
    editing: true,
    name: typeof session.name === 'string' ? session.name.trim() : '',
    notes: normalizeNotes(session.notes),
    startedAt: typeof session.startedAt === 'string' ? session.startedAt : new Date().toISOString(),
    finishedAt: session.finishedAt,
    durationMinutes: session.durationMinutes,
    exercises,
  };
}
export function summarize(sessions) {
  return sessions.reduce((total, session) => {
    total.minutes += session.durationMinutes;
    session.exercises.forEach(e => e.sets.forEach(set => { total.sets++; total.reps += Number(set.reps); }));
    return total;
  }, { sets: 0, reps: 0, minutes: 0 });
}
export function sessionSearchText(session) {
  const name = typeof session?.name === 'string' ? session.name : '';
  const notes = typeof session?.notes === 'string' ? session.notes : '';
  const exerciseNames = Array.isArray(session?.exercises)
    ? session.exercises.map(exercise => typeof exercise?.name === 'string' ? exercise.name : '')
    : [];
  return [name, notes, ...exerciseNames].map(value => value.trim()).filter(Boolean).join(' ').toLowerCase();
}
function startOfWeek(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}
function weekTotals(sessions, start) {
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const workouts = sessions.filter(session => {
    const finished = new Date(session.finishedAt);
    return !Number.isNaN(finished.getTime()) && finished >= start && finished < end;
  });
  const totals = summarize(workouts);
  return { workouts: workouts.length, sets: totals.sets, reps: totals.reps };
}
export function weeklySummary(sessions, now = new Date()) {
  const saved = Array.isArray(sessions) ? sessions : [];
  const thisWeek = startOfWeek(now);
  const previousWeek = new Date(thisWeek);
  previousWeek.setDate(previousWeek.getDate() - 7);
  const current = weekTotals(saved, thisWeek);
  const previous = weekTotals(saved, previousWeek);
  let streak = 0;
  const cursor = new Date(thisWeek);
  while (weekTotals(saved, cursor).workouts) {
    streak++;
    cursor.setDate(cursor.getDate() - 7);
  }
  return { ...current, previousWorkouts: previous.workouts, streak };
}
function completedExercises(draft) {
  return draft.exercises
    .map(exercise => ({ ...exercise, sets: exercise.sets.filter(set => set.done).map(set => ({ ...set })) }))
    .filter(exercise => exercise.sets.length);
}
function validateCompletedSets(exercises) {
  for (const exercise of exercises) {
    for (const set of exercise.sets) {
      if (!/^\d+$/.test(set.reps) || Number(set.reps) < 1 || Number(set.reps) > 9999) throw new Error(`${exercise.name}: enter whole-number reps between 1 and 9999.`);
      if (set.weight !== '' && (!/^\d+(\.\d+)?$/.test(set.weight) || Number(set.weight) > 9999)) throw new Error(`${exercise.name}: enter a weight from 0 to 9999 kg, or leave it blank.`);
      set.reps = Number(set.reps); set.weight = Number(set.weight);
    }
  }
}
export function finishSession(draft, now = new Date()) {
  const completed = completedExercises(draft);
  if (!completed.length) throw new Error('Check off at least one completed set before saving.');
  validateCompletedSets(completed);
  return { ...draft, name: draft.name.trim() || 'Daily workout', notes: normalizeNotes(draft.notes), exercises: completed, finishedAt: now.toISOString(), durationMinutes: Math.max(1, Math.round((now - new Date(draft.startedAt)) / 60000)) };
}
export function updateSession(draft, now = new Date()) {
  const completed = completedExercises(draft);
  if (!completed.length) throw new Error('Check off at least one completed set before saving.');
  validateCompletedSets(completed);
  const finishedAt = typeof draft.finishedAt === 'string' ? draft.finishedAt : now.toISOString();
  const recordedDuration = Number(draft.durationMinutes);
  const started = new Date(draft.startedAt);
  const finished = new Date(finishedAt);
  const elapsedMinutes = !Number.isNaN(started.getTime()) && !Number.isNaN(finished.getTime())
    ? Math.max(1, Math.round((finished - started) / 60000))
    : 1;
  return {
    id: draft.id,
    name: draft.name.trim() || 'Daily workout',
    notes: normalizeNotes(draft.notes),
    startedAt: draft.startedAt,
    finishedAt,
    durationMinutes: Number.isFinite(recordedDuration) && recordedDuration > 0 ? recordedDuration : elapsedMinutes,
    exercises: completed,
  };
}
