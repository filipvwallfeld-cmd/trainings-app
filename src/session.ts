import { exerciseById } from './data'
import type { Exercise, PlanUnit, SessionExercise, SessionExerciseSource, SetEntry, WorkoutSection, WorkoutSession } from './types'

export const DEFAULT_REST_SECONDS = 150

function uid(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function createSet(): SetEntry {
  return { id: uid('set'), weight: '', reps: '', rir: '', done: false }
}

type LegacySetEntry = Partial<SetEntry> & {
  completed?: boolean
  isCompleted?: boolean
}

type LegacyWorkoutSession = WorkoutSession & {
  completed?: boolean
  isCompleted?: boolean
  finishedAt?: string
  endedAt?: string
}

function hasRecordedSetValues(set: LegacySetEntry): boolean {
  return Boolean(String(set.weight ?? '').trim() || String(set.reps ?? '').trim() || String(set.rir ?? '').trim())
}

export function isSetCompleted(set: LegacySetEntry, allowValueFallback = false): boolean {
  if (typeof set.done === 'boolean') return set.done
  if (typeof set.completed === 'boolean') return set.completed
  if (typeof set.isCompleted === 'boolean') return set.isCompleted
  return allowValueFallback && hasRecordedSetValues(set)
}

function normalizeSessionStatus(session: LegacyWorkoutSession): WorkoutSession['status'] {
  if (session.status === 'active' || session.status === 'completed') return session.status
  if (typeof session.completed === 'boolean') return session.completed ? 'completed' : 'active'
  if (typeof session.isCompleted === 'boolean') return session.isCompleted ? 'completed' : 'active'
  if (session.completedAt || session.finishedAt || session.endedAt) return 'completed'
  const hasHistoricalPerformance = (session.exercises ?? []).some((exercise) =>
    (exercise.sets ?? []).some((set) => isSetCompleted(set, true)),
  )
  return hasHistoricalPerformance ? 'completed' : 'active'
}

export function findLastCompletedSets(sessions: WorkoutSession[], exerciseId: string): SetEntry[] {
  const completed = [...sessions]
    .filter((session) => session.status === 'completed')
    .sort((left, right) => (right.completedAt ?? right.startedAt).localeCompare(left.completedAt ?? left.startedAt))

  for (const session of completed) {
    const sets = session.exercises
      .filter((exercise) => exercise.exerciseId === exerciseId && !exercise.removed && !exercise.skipped)
      .flatMap((exercise) => exercise.sets)
      .filter((set) => isSetCompleted(set) && Boolean((set.weight ?? '').trim() || (set.reps ?? '').trim()))
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
  return session.exercises.some((exercise) => !exercise.removed && !exercise.skipped && exercise.sets.some((set) => isSetCompleted(set)))
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
  const legacySession = session as LegacyWorkoutSession
  const kind = session.kind ?? 'strength'
  const status = normalizeSessionStatus(legacySession)
  const completedAt = session.completedAt ?? legacySession.finishedAt ?? legacySession.endedAt
  return {
    ...session,
    status,
    completedAt: status === 'completed' ? completedAt ?? session.startedAt : completedAt,
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
        sets: (item.sets ?? []).map((set, setIndex) => {
          const legacySet = set as LegacySetEntry
          return {
            ...set,
            id: set.id ?? `legacy-set-${session.id}-${index}-${setIndex}`,
            weight: String(set.weight ?? ''),
            reps: String(set.reps ?? ''),
            rir: String(set.rir ?? ''),
            done: isSetCompleted(legacySet, status === 'completed'),
          }
        }),
        userNote: item.userNote ?? '',
        skipped: item.skipped ?? false,
        removed: item.removed ?? false,
      }
    }).sort((left, right) => left.order - right.order),
  }
}
