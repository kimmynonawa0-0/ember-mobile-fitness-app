import { exerciseCatalog } from './exerciseCatalog.js';
export const exercises = exerciseCatalog.map(exercise => exercise.name);
let counter = 0;
function nextId() { return `${Date.now()}-${counter++}`; }
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
export function summarize(sessions) {
  return sessions.reduce((total, session) => {
    total.minutes += session.durationMinutes;
    session.exercises.forEach(e => e.sets.forEach(set => { total.sets++; total.reps += Number(set.reps); }));
    return total;
  }, { sets: 0, reps: 0, minutes: 0 });
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
export function finishSession(draft, now = new Date()) {
  const completed = draft.exercises.map(e => ({ ...e, sets: e.sets.filter(s => s.done).map(s => ({ ...s })) })).filter(e => e.sets.length);
  if (!completed.length) throw new Error('Check off at least one completed set before saving.');
  for (const exercise of completed) {
    for (const set of exercise.sets) {
      if (!/^\d+$/.test(set.reps) || Number(set.reps) < 1 || Number(set.reps) > 9999) throw new Error(`${exercise.name}: enter whole-number reps between 1 and 9999.`);
      if (set.weight !== '' && (!/^\d+(\.\d+)?$/.test(set.weight) || Number(set.weight) > 9999)) throw new Error(`${exercise.name}: enter a weight from 0 to 9999 kg, or leave it blank.`);
      set.reps = Number(set.reps); set.weight = Number(set.weight);
    }
  }
  return { ...draft, name: draft.name.trim() || 'Daily workout', exercises: completed, finishedAt: now.toISOString(), durationMinutes: Math.max(1, Math.round((now - new Date(draft.startedAt)) / 60000)) };
}
