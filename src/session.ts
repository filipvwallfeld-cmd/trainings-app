import { exerciseById } from './data'
import type { Exercise, PlanUnit, SessionExercise, SessionExerciseSource, SetEntry, WorkoutSection, WorkoutSession } from './types'

export const DEFAULT_REST_SECONDS = 150

function uid(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function createSet(): SetEntry {
  return { id: uid('set'), weight: '', reps: '', rir: '', done: false }
}

export function findLastCompletedSets(sessions: WorkoutSession[], exerciseId: string): SetEntry[] {
  const completed = [...sessions]
    .filter((session) => session.status === 'completed')
    .sort((left, right) => (right.completedAt ?? right.startedAt).localeCompare(left.completedAt ?? left.startedAt))

  for (const session of completed) {
    const sets = session.exercises
      .filter((exercise) => exercise.exerciseId === exerciseId && !exercise.removed && !exercise.skipped)
      .flatMap((exercise) => exercise.sets)
      .filter((set) => set.done && Boolean((set.weight ?? '').trim() || (set.reps ?? '').trim()))
    if (sets.length) return sets
  }

  return []
}

export function createSetsFromPrevious(targetSets: number, previousSets: SetEntry[] = []): SetEntry[] {
  return Array.from({ length: targetSets }, (_, index) => ({
    ...createSet(),
    weight: previousSets[index]?.weight ?? '',
    reps: previousSets[index]?.reps ?? '',
  }))
}

export function sessionHasCompletedSet(session: WorkoutSession): boolean {
  return session.exercises.some((exercise) => !exercise.removed && !exercise.skipped && exercise.sets.some((set) => set.done))
}

function inferLegacySection(exerciseId: string, kind: WorkoutSession['kind']): WorkoutSection {
  if (kind === 'routine') return 'routine'
  if (['bike', 'treadmill-walk', 'walk', 'knee-to-wall', 'tke', 'glute-bridge', 'chin-tucks', 'hip-switches', 'wall-slides', 'monster-walk', 'bird-dog'].includes(exerciseId)) return 'warmup'
  if (['dead-bug', 'pallof-press', 'side-plank', 'single-leg-stand'].includes(exerciseId)) return 'core'
  if (['hip-flexor-quad-stretch', 'open-book'].includes(exerciseId)) return 'cooldown'
  return 'strength'
}

function sessionTypeForUnit(unitId: string): WorkoutSession['sessionType'] {
  if (unitId === 'training-a') return 'training-a'
  if (unitId === 'training-b') return 'training-b'
  if (unitId === 'free-training') return 'free'
  return 'routine'
}

export function createSessionExercise(
  exercise: Exercise,
  order: number,
  source: SessionExerciseSource,
  options: Partial<SessionExercise> = {},
): SessionExercise {
  const targetSets = options.targetSets ?? 3
  return {
    id: options.id ?? uid('session-exercise'),
    templateExerciseId: options.templateExerciseId,
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    source,
    replacedExerciseId: options.replacedExerciseId,
    order,
    section: options.section ?? 'strength',
    prescription: options.prescription ?? `${targetSets} Arbeitssätze`,
    note: options.note ?? '',
    targetSets,
    restSeconds: options.restSeconds ?? DEFAULT_REST_SECONDS,
    sets: options.sets ?? Array.from({ length: targetSets }, createSet),
    userNote: options.userNote ?? '',
    skipped: options.skipped ?? false,
    removed: options.removed ?? false,
  }
}

export function createWorkoutSession(unit: PlanUnit, history: WorkoutSession[] = []): WorkoutSession {
  return {
    id: uid('session'),
    templateId: unit.id === 'free-training' ? undefined : unit.id,
    sessionType: sessionTypeForUnit(unit.id),
    unitId: unit.id,
    unitName: unit.name,
    kind: unit.kind,
    status: 'active',
    startedAt: new Date().toISOString(),
    exercises: unit.steps.map((step, index) => {
      const exercise = exerciseById.get(step.exerciseId)
      if (!exercise) throw new Error(`Übung nicht gefunden: ${step.exerciseId}`)
      const section = step.section ?? (unit.kind === 'routine' ? 'routine' : 'strength')
      const targetSets = step.targetSets ?? 1
      const previousSets = section === 'strength' ? findLastCompletedSets(history, exercise.id) : []
      return createSessionExercise(exercise, index, 'template', {
        ...step,
        templateExerciseId: step.templateExerciseId ?? `${unit.id}:${step.exerciseId}:${index}`,
        section,
        targetSets,
        sets: section === 'strength' ? createSetsFromPrevious(targetSets, previousSets) : [createSet()],
        restSeconds: step.restSeconds ?? DEFAULT_REST_SECONDS,
      })
    }),
    durationMinutes: 0,
    effort: 5,
    pain: { neck: 0, lowerBack: 0, hip: 0, leftKnee: 0 },
    note: '',
    isPaused: false,
    pausedMs: 0,
  }
}

export function normalizeWorkoutSession(session: WorkoutSession): WorkoutSession {
  const kind = session.kind ?? 'strength'
  return {
    ...session,
    templateId: session.templateId ?? (session.unitId === 'free-training' ? undefined : session.unitId),
    sessionType: session.sessionType ?? sessionTypeForUnit(session.unitId),
    pausedMs: session.pausedMs ?? 0,
    exercises: (session.exercises ?? []).map((item, index) => {
      const detail = exerciseById.get(item.exerciseId)
      const section = item.section ?? inferLegacySection(item.exerciseId, kind)
      return {
        ...item,
        id: item.id ?? `legacy-${session.id}-${index}`,
        exerciseName: item.exerciseName ?? detail?.name ?? item.exerciseId,
        source: item.source ?? 'template',
        order: item.order ?? index,
        section,
        restSeconds: item.restSeconds ?? DEFAULT_REST_SECONDS,
        sets: (item.sets ?? []).map((set, setIndex) => ({
          ...set,
          id: set.id ?? `legacy-set-${session.id}-${index}-${setIndex}`,
          weight: set.weight ?? '',
          reps: set.reps ?? '',
          rir: set.rir ?? '',
          done: set.done ?? false,
        })),
        userNote: item.userNote ?? '',
        skipped: item.skipped ?? false,
        removed: item.removed ?? false,
      }
    }).sort((left, right) => left.order - right.order),
  }
}

function parseNumber(value: string) {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

export type ExerciseProgressPoint = {
  sessionId: string
  date: string
  maxWeight: number
  maxReps: number
  workSets: number
  volume: number
  estimatedOneRepMax: number
}

export type ExerciseStatistics = {
  points: ExerciseProgressPoint[]
  highestWeight: number
  highestReps: number
  totalWorkSets: number
  totalVolume: number
  volumeRecord: number
  estimatedOneRepMax: number
}

export function calculateExerciseStatistics(sessions: WorkoutSession[], exerciseId: string): ExerciseStatistics {
  const points = sessions
    .filter((session) => session.status === 'completed')
    .flatMap((session) => {
      const matching = session.exercises.filter((item) => item.exerciseId === exerciseId && !item.removed && !item.skipped)
      const completedSets = matching.flatMap((item) => item.sets).filter((set) => set.done)
      if (!completedSets.length) return []
      const weightedSets = completedSets.map((set) => ({ weight: parseNumber(set.weight), reps: parseNumber(set.reps) }))
      return [{
        sessionId: session.id,
        date: session.completedAt ?? session.startedAt,
        maxWeight: Math.max(...weightedSets.map((set) => set.weight)),
        maxReps: Math.max(...weightedSets.map((set) => set.reps)),
        workSets: completedSets.length,
        volume: weightedSets.reduce((sum, set) => sum + set.weight * set.reps, 0),
        estimatedOneRepMax: Math.max(...weightedSets.map((set) => set.weight * (1 + set.reps / 30))),
      }]
    })
    .sort((left, right) => left.date.localeCompare(right.date))

  return {
    points,
    highestWeight: Math.max(0, ...points.map((point) => point.maxWeight)),
    highestReps: Math.max(0, ...points.map((point) => point.maxReps)),
    totalWorkSets: points.reduce((sum, point) => sum + point.workSets, 0),
    totalVolume: points.reduce((sum, point) => sum + point.volume, 0),
    volumeRecord: Math.max(0, ...points.map((point) => point.volume)),
    estimatedOneRepMax: Math.max(0, ...points.map((point) => point.estimatedOneRepMax)),
  }
}
