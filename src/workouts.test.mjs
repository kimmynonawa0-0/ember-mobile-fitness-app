import test from 'node:test';
import assert from 'node:assert/strict';
import { beginEdit, newExercise, finishSession, summarize, repeatWorkout, updateSession, weeklySummary } from './workouts.js';

function draft() {
  return { id: 'session', name: '  Morning session  ', startedAt: '2026-09-19T08:00:00Z', exercises: [newExercise('Push-ups'), newExercise('Squats')] };
}
const end = new Date('2026-09-19T08:12:00Z');
function savedSession(finishedAt, reps = 10) {
  return { finishedAt: finishedAt.toISOString(), durationMinutes: 10, exercises: [{ id: 'exercise', name: 'Squat', sets: [{ id: 'set', reps }] }] };
}
test('requires a completed set', () => {
  assert.throws(() => finishSession(draft(), end), /at least one/);
});
test('saves only completed sets, preserves draft, and totals sessions', () => {
  const workout = draft();
  Object.assign(workout.exercises[0].sets[0], { done: true, reps: '12', weight: '2.5' });
  const snapshot = JSON.stringify(workout);
  const result = finishSession(workout, end);
  assert.equal(result.name, 'Morning session');
  assert.equal(result.exercises.length, 1);
  assert.equal(result.exercises[0].sets.length, 1);
  assert.equal(result.exercises[0].sets[0].weight, 2.5);
  assert.deepEqual(summarize([result]), { sets: 1, reps: 12, minutes: 12 });
  assert.equal(JSON.stringify(workout), snapshot);
});
test('rejects invalid reps and weight without modifying the draft', () => {
  for (const reps of ['0', '-1', '1.5', '', 'abc', '10000']) {
    const workout = draft();
    Object.assign(workout.exercises[0].sets[0], { done: true, reps });
    assert.throws(() => finishSession(workout, end), /whole-number reps/);
  }
  for (const weight of ['-1', 'abc', 'Infinity', '10000']) {
    const workout = draft();
    Object.assign(workout.exercises[0].sets[0], { done: true, weight });
    assert.throws(() => finishSession(workout, end), /weight/);
  }
});
test('uses defaults for unnamed bodyweight workouts and distinct exercise IDs', () => {
  const workout = draft(); workout.name = ' ';
  workout.exercises[0].sets[0].done = true;
  const result = finishSession(workout, end);
  assert.equal(result.name, 'Daily workout');
  assert.equal(result.exercises[0].sets[0].weight, 0);
  assert.notEqual(workout.exercises[0].id, workout.exercises[1].id);
  assert.deepEqual(summarize([]), { sets: 0, reps: 0, minutes: 0 });
});
test('repeats a saved workout as a fresh draft without mutating it', () => {
  const workout = draft();
  Object.assign(workout.exercises[0].sets[0], { done: true, reps: '12', weight: '20' });
  Object.assign(workout.exercises[0].sets[1], { done: true, reps: '8', weight: '' });
  Object.assign(workout.exercises[1].sets[0], { done: true, reps: '15', weight: '0' });
  const session = finishSession(workout, end);
  const snapshot = JSON.stringify(session);
  const repeated = repeatWorkout(session, new Date('2026-09-20T07:00:00Z'));
  assert.equal(repeated.startedAt, '2026-09-20T07:00:00.000Z');
  assert.equal(repeated.name, 'Morning session');
  assert.equal(repeated.exercises.length, 2);
  assert.deepEqual(
    repeated.exercises[0].sets.map(({ reps, weight, done }) => ({ reps, weight, done })),
    [{ reps: '12', weight: '20', done: false }, { reps: '8', weight: '', done: false }],
  );
  assert.deepEqual(
    repeated.exercises[1].sets.map(({ reps, weight, done }) => ({ reps, weight, done })),
    [{ reps: '15', weight: '', done: false }],
  );
  assert.notEqual(repeated.id, session.id);
  assert.notEqual(repeated.exercises[0].id, session.exercises[0].id);
  assert.notEqual(repeated.exercises[0].sets[0].id, session.exercises[0].sets[0].id);
  assert.equal(new Set(repeated.exercises.flatMap(exercise => exercise.sets.map(set => set.id))).size, 3);
  assert.equal(JSON.stringify(session), snapshot);
});
test('rejects workouts without repeatable exercises', () => {
  assert.throws(() => repeatWorkout(null), /no exercises/);
  assert.throws(() => repeatWorkout({ name: 'Empty', exercises: [] }), /no exercises/);
  assert.throws(() => repeatWorkout({ exercises: [{ name: 'Push-ups', sets: [] }] }), /no exercises/);
});
function savedWorkout() {
  return {
    id: 'session-saved',
    name: '  Morning session  ',
    startedAt: '2026-09-19T08:00:00.000Z',
    finishedAt: '2026-09-19T08:12:00.000Z',
    durationMinutes: 12,
    exercises: [{
      id: 'exercise-saved',
      name: 'Squats',
      sets: [
        { id: 'set-one', reps: 12, weight: 20, done: true },
        { id: 'set-two', reps: 8, weight: 0, done: true },
      ],
    }],
  };
}
test('builds an editable draft from a saved workout without mutating it', () => {
  const session = savedWorkout();
  const snapshot = JSON.stringify(session);
  const draft = beginEdit(session);
  assert.equal(draft.editing, true);
  assert.equal(draft.id, session.id);
  assert.equal(draft.name, 'Morning session');
  assert.equal(draft.startedAt, session.startedAt);
  assert.equal(draft.finishedAt, session.finishedAt);
  assert.equal(draft.durationMinutes, 12);
  assert.equal(draft.exercises[0].id, 'exercise-saved');
  assert.deepEqual(
    draft.exercises[0].sets.map(({ id, reps, weight, done }) => ({ id, reps, weight, done })),
    [
      { id: 'set-one', reps: '12', weight: '20', done: true },
      { id: 'set-two', reps: '8', weight: '', done: true },
    ],
  );
  assert.equal(JSON.stringify(session), snapshot);
});
test('rejects saved workouts without exercises to edit', () => {
  assert.throws(() => beginEdit(null), /no exercises to edit/);
  assert.throws(() => beginEdit({ exercises: [] }), /no exercises to edit/);
  assert.throws(() => beginEdit({ exercises: [{ name: 'Squats', sets: [] }] }), /no exercises to edit/);
});
test('updates a saved workout in place while keeping its date and duration', () => {
  const session = savedWorkout();
  const snapshot = JSON.stringify(session);
  const draft = beginEdit(session);
  draft.name = '  Evening session  ';
  draft.exercises[0].sets[0].reps = '15';
  draft.exercises[0].sets[0].weight = '22.5';
  draft.exercises[0].sets[1].done = false;
  const updated = updateSession(draft, new Date('2026-09-21T09:00:00Z'));
  assert.equal(updated.id, session.id);
  assert.equal(updated.name, 'Evening session');
  assert.equal(updated.startedAt, session.startedAt);
  assert.equal(updated.finishedAt, session.finishedAt);
  assert.equal(updated.durationMinutes, 12);
  assert.equal(updated.editing, undefined);
  assert.equal(updated.exercises[0].id, 'exercise-saved');
  assert.deepEqual(
    updated.exercises[0].sets.map(({ id, reps, weight, done }) => ({ id, reps, weight, done })),
    [{ id: 'set-one', reps: 15, weight: 22.5, done: true }],
  );
  assert.equal(JSON.stringify(session), snapshot);
});
test('restores a missing saved duration and rejects invalid edits', () => {
  const session = savedWorkout();
  delete session.durationMinutes;
  const draft = beginEdit(session);
  assert.equal(updateSession(draft).durationMinutes, 12);
  draft.exercises[0].sets[0].reps = '0';
  assert.throws(() => updateSession(draft), /whole-number reps/);
  draft.exercises[0].sets.forEach(set => { set.done = false; });
  assert.throws(() => updateSession(draft), /at least one/);
});
test('summarizes the current week, previous week, and weekly streak', () => {
  const sessions = [
    savedSession(new Date(2026, 8, 14, 8), 10),
    savedSession(new Date(2026, 8, 16, 18), 12),
    savedSession(new Date(2026, 8, 13, 23, 59), 8),
    savedSession(new Date(2026, 8, 9, 8), 6),
    savedSession(new Date(2026, 8, 5, 8), 4),
  ];
  assert.deepEqual(weeklySummary(sessions, new Date(2026, 8, 16, 12)), {
    workouts: 2,
    sets: 2,
    reps: 22,
    previousWorkouts: 2,
    streak: 3,
  });
});
test('starts weeks on Monday and resets the streak without a current-week workout', () => {
  const now = new Date(2026, 8, 14, 0, 1);
  assert.deepEqual(weeklySummary([savedSession(new Date(2026, 8, 13, 23, 59))], now), {
    workouts: 0,
    sets: 0,
    reps: 0,
    previousWorkouts: 1,
    streak: 0,
  });
  assert.deepEqual(weeklySummary([savedSession(new Date(2026, 8, 14, 0, 0))], now), {
    workouts: 1,
    sets: 1,
    reps: 10,
    previousWorkouts: 0,
    streak: 1,
  });
  assert.deepEqual(weeklySummary(undefined, now), {
    workouts: 0,
    sets: 0,
    reps: 0,
    previousWorkouts: 0,
    streak: 0,
  });
});
