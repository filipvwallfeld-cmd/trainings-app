import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))
const server = await createServer({ root, configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false } })
const { calculateExerciseStatistics, calculateProgressEntries, calculateWorkoutSummary } = await server.ssrLoadModule('/src/statistics.ts')

after(async () => server.close())

function set(id, weight, reps, done = true) {
  return { id, weight, reps, rir: '', done }
}

function session(id, date, exerciseId, sets, options = {}) {
  return {
    id,
    unitId: options.unitId ?? 'training-a',
    unitName: options.unitName ?? 'Training A',
    kind: 'strength',
    status: options.status ?? 'completed',
    startedAt: date,
    completedAt: date,
    exercises: [{
      id: `${id}-exercise`,
      exerciseId,
      exerciseName: options.exerciseName ?? exerciseId,
      source: options.source ?? 'template',
      order: 0,
      section: 'strength',
      prescription: '3 Sätze',
      note: '',
      restSeconds: 150,
      sets,
      userNote: '',
      skipped: options.skipped ?? false,
      removed: options.removed ?? false,
    }],
    durationMinutes: 45,
    effort: 5,
    pain: { neck: 0, lowerBack: 0, hip: 0, leftKnee: 0 },
    note: '',
    isPaused: false,
    pausedMs: 0,
  }
}

test('aggregiert Exercise History chronologisch und template-unabhängig', () => {
  const sessions = [
    session('three', '2026-08-15T10:00:00.000Z', 'bulgarian-split-squat', [set('s3', '60', '8')], { unitId: 'free-training', unitName: 'Freie Einheit', source: 'added' }),
    session('one', '2026-08-01T10:00:00.000Z', 'bulgarian-split-squat', [set('s1', '50', '10')], { unitId: 'training-a', unitName: 'Training A' }),
    session('two', '2026-08-08T10:00:00.000Z', 'bulgarian-split-squat', [set('s2', '55', '9')], { unitId: 'training-b', unitName: 'Training B', source: 'replacement' }),
  ]
  const statistics = calculateExerciseStatistics(sessions, 'bulgarian-split-squat', 'weight_reps')
  assert.equal(statistics.sessionCount, 3)
  assert.deepEqual(statistics.points.map((point) => point.sessionId), ['one', 'two', 'three'])
  assert.equal(statistics.latest.sessionName, 'Freie Einheit')
})

test('ignoriert ausgelassene, entfernte und nicht abgeschlossene Sets', () => {
  const sessions = [
    session('valid', '2026-08-01T10:00:00.000Z', 'leg-extension', [set('done', '50', '12'), set('open', '90', '20', false)]),
    session('skipped', '2026-08-08T10:00:00.000Z', 'leg-extension', [set('skip', '70', '12')], { skipped: true }),
    session('removed', '2026-08-15T10:00:00.000Z', 'leg-extension', [set('remove', '80', '10')], { removed: true }),
  ]
  const statistics = calculateExerciseStatistics(sessions, 'leg-extension', 'weight_reps')
  assert.equal(statistics.sessionCount, 1)
  assert.equal(statistics.totalWorkSets, 1)
  assert.equal(statistics.highestWeight, 50)
})

test('berechnet Weight PR, Rep PR, Volume und Volume PR korrekt', () => {
  const sessions = [
    session('volume', '2026-08-01T10:00:00.000Z', 'chest-press', [set('a', '50', '10'), set('b', '50', '10'), set('c', '60', '8')]),
    session('records', '2026-08-08T10:00:00.000Z', 'chest-press', [set('d', '65', '6'), set('e', '40', '15')]),
  ]
  const statistics = calculateExerciseStatistics(sessions, 'chest-press', 'weight_reps')
  assert.equal(statistics.points[0].volume, 1480)
  assert.equal(statistics.highestWeight, 65)
  assert.equal(statistics.highestReps, 15)
  assert.equal(statistics.volumeRecord, 1480)
  assert.equal(statistics.totalVolume, 2470)
})

test('erzeugt für Bodyweight, reps_only und duration keine künstlichen Gewichtsmetriken', () => {
  const bodyweight = calculateExerciseStatistics([session('push', '2026-08-01T10:00:00.000Z', 'push-up', [set('p', '', '18')])], 'push-up', 'bodyweight_reps')
  const repsOnly = calculateExerciseStatistics([session('custom', '2026-08-02T10:00:00.000Z', 'custom-reps', [set('r', '', '24')])], 'custom-reps', 'reps_only')
  const duration = calculateExerciseStatistics([session('plank', '2026-08-03T10:00:00.000Z', 'plank', [set('t', '', '90')])], 'plank', 'duration')
  assert.equal(bodyweight.highestWeight, null)
  assert.equal(bodyweight.totalVolume, null)
  assert.equal(bodyweight.highestReps, 18)
  assert.equal(repsOnly.highestReps, 24)
  assert.equal(duration.longestDurationSeconds, 90)
  assert.equal(duration.highestReps, null)
})

test('erstellt eine eigene Statistik für Custom Exercises anhand ihrer ID', () => {
  const sessions = [session('custom-session', '2026-08-01T10:00:00.000Z', 'custom-stable-id', [set('custom-set', '42,5', '11')], { exerciseName: 'Eigene Maschine' })]
  const statistics = calculateExerciseStatistics(sessions, 'custom-stable-id', 'weight_reps')
  assert.equal(statistics.sessionCount, 1)
  assert.equal(statistics.highestWeight, 42.5)
  assert.equal(statistics.points[0].sets[0].reps, 11)
})

test('berechnet Workout Summary nur aus echten Arbeitssätzen und gewichtsbasiertem Volumen', () => {
  const workout = session('summary', '2026-08-01T10:00:00.000Z', 'chest-press', [set('one', '50', '10'), set('two', '60', '8'), set('open', '100', '10', false)])
  workout.exercises.push({ ...workout.exercises[0], id: 'bodyweight', exerciseId: 'push-up', sets: [set('push', '', '20')] })
  workout.exercises.push({ ...workout.exercises[0], id: 'skipped', exerciseId: 'leg-press', skipped: true, sets: [set('skip', '200', '10')] })
  const exercises = new Map([['chest-press', { trackingMode: 'weight_reps' }], ['push-up', { trackingMode: 'bodyweight_reps' }], ['leg-press', { trackingMode: 'weight_reps' }]])
  const summary = calculateWorkoutSummary(workout, exercises)
  assert.equal(summary.completedExercises, 2)
  assert.equal(summary.completedWorkSets, 3)
  assert.equal(summary.totalVolume, 980)
})

test('verändert die vorhandene Workout History bei Statistikberechnung nicht', () => {
  const sessions = [session('immutable', '2026-08-01T10:00:00.000Z', 'calf-raise-leg-press', [set('set', '80', '15')])]
  const before = structuredClone(sessions)
  calculateExerciseStatistics(sessions, 'calf-raise-leg-press', 'weight_reps')
  assert.deepEqual(sessions, before)
})

test('zeigt im Fortschrittsbereich nur Exercises mit abgeschlossenen historischen Sets', () => {
  const sessions = [session('trained', '2026-08-01T10:00:00.000Z', 'trained-id', [set('done', '50', '10')])]
  const exercise = (id, name) => ({ id, name, category: 'Brust', goal: '', execution: '', mistakes: '', easier: '', harder: '', substitute: '', primaryMuscle: 'Brust', equipment: 'Maschine', laterality: 'bilateral', trackingMode: 'weight_reps', custom: false })
  const entries = calculateProgressEntries(sessions, [exercise('never-used', 'Nie trainiert'), exercise('trained-id', 'Trainiert')])
  assert.deepEqual(entries.map((entry) => entry.exercise.id), ['trained-id'])
})
