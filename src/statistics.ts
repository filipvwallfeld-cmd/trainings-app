import { isSetCompleted } from './session'
import type { Exercise, ExerciseTrackingMode, SetEntry, WorkoutSession } from './types'

export type SetPerformance = {
  setId: string
  weight: number | null
  reps: number | null
  durationSeconds: number | null
  rir: string
}

export type ExerciseProgressPoint = {
  sessionId: string
  sessionName: string
  date: string
  sets: SetPerformance[]
  maxWeight: number | null
  maxReps: number | null
  longestDurationSeconds: number | null
  workSets: number
  volume: number | null
  estimatedOneRepMax: number | null
}

export type ExerciseStatistics = {
  exerciseId: string
  trackingMode: ExerciseTrackingMode
  points: ExerciseProgressPoint[]
  latest: ExerciseProgressPoint | null
  sessionCount: number
  highestWeight: number | null
  highestReps: number | null
  longestDurationSeconds: number | null
  totalWorkSets: number
  totalVolume: number | null
  volumeRecord: number | null
  estimatedOneRepMax: number | null
}

export type WorkoutSummary = {
  completedExercises: number
  completedWorkSets: number
  totalVolume: number | null
}

export type ExerciseProgressEntry = {
  exercise: Exercise
  statistics: ExerciseStatistics
}

function parseRecordedNumber(value: string | undefined): number | null {
  if (!value?.trim()) return null
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function maxRecorded(values: Array<number | null>) {
  const recorded = values.filter((value): value is number => value !== null)
  return recorded.length ? Math.max(...recorded) : null
}

function sumRecorded(values: Array<number | null>) {
  const recorded = values.filter((value): value is number => value !== null)
  return recorded.length ? recorded.reduce((sum, value) => sum + value, 0) : null
}

export function toSetPerformance(set: SetEntry, trackingMode: ExerciseTrackingMode): SetPerformance {
  const recordedReps = parseRecordedNumber(set.reps)
  return {
    setId: set.id,
    weight: trackingMode === 'weight_reps' ? parseRecordedNumber(set.weight) : null,
    reps: trackingMode === 'duration' ? null : recordedReps,
    durationSeconds: trackingMode === 'duration' ? recordedReps : null,
    rir: set.rir,
  }
}

export function calculateExerciseStatistics(sessions: WorkoutSession[], exerciseId: string, trackingMode: ExerciseTrackingMode = 'weight_reps'): ExerciseStatistics {
  const points = sessions
    .filter((session) => session.status === 'completed')
    .flatMap((session) => {
      const completedSets = session.exercises
        .filter((exercise) => exercise.exerciseId === exerciseId && !exercise.removed && !exercise.skipped)
        .flatMap((exercise) => exercise.sets)
        .filter((set) => isSetCompleted(set))
      if (!completedSets.length) return []

      const sets = completedSets.map((set) => toSetPerformance(set, trackingMode))
      const setVolumes = trackingMode === 'weight_reps'
        ? sets.map((set) => set.weight !== null && set.reps !== null ? set.weight * set.reps : null)
        : []
      const estimatedOneRepMaxes = trackingMode === 'weight_reps'
        ? sets.map((set) => set.weight !== null && set.weight > 0 && set.reps !== null && set.reps > 0 && set.reps <= 30 ? set.weight * (1 + set.reps / 30) : null)
        : []

      return [{
        sessionId: session.id,
        sessionName: session.unitName,
        date: session.completedAt ?? session.startedAt,
        sets,
        maxWeight: maxRecorded(sets.map((set) => set.weight)),
        maxReps: maxRecorded(sets.map((set) => set.reps)),
        longestDurationSeconds: maxRecorded(sets.map((set) => set.durationSeconds)),
        workSets: sets.length,
        volume: sumRecorded(setVolumes),
        estimatedOneRepMax: maxRecorded(estimatedOneRepMaxes),
      }]
    })
    .sort((left, right) => left.date.localeCompare(right.date))

  return {
    exerciseId,
    trackingMode,
    points,
    latest: points.at(-1) ?? null,
    sessionCount: points.length,
    highestWeight: maxRecorded(points.map((point) => point.maxWeight)),
    highestReps: maxRecorded(points.map((point) => point.maxReps)),
    longestDurationSeconds: maxRecorded(points.map((point) => point.longestDurationSeconds)),
    totalWorkSets: points.reduce((sum, point) => sum + point.workSets, 0),
    totalVolume: sumRecorded(points.map((point) => point.volume)),
    volumeRecord: maxRecorded(points.map((point) => point.volume)),
    estimatedOneRepMax: maxRecorded(points.map((point) => point.estimatedOneRepMax)),
  }
}

export function calculateWorkoutSummary(session: WorkoutSession, exerciseById: Map<string, Pick<Exercise, 'trackingMode'>>): WorkoutSummary {
  const completedExercises = session.exercises.filter((exercise) => !exercise.removed && !exercise.skipped && exercise.sets.some((set) => isSetCompleted(set))).length
  const strengthExercises = session.exercises.filter((exercise) => exercise.section === 'strength' && !exercise.removed && !exercise.skipped)
  const completedWorkSets = strengthExercises.flatMap((exercise) => exercise.sets).filter((set) => isSetCompleted(set)).length
  const volumeParts = strengthExercises.flatMap((exercise) => {
    const trackingMode = exerciseById.get(exercise.exerciseId)?.trackingMode ?? 'weight_reps'
    if (trackingMode !== 'weight_reps') return []
    return exercise.sets.filter((set) => isSetCompleted(set)).map((set) => {
      const weight = parseRecordedNumber(set.weight)
      const reps = parseRecordedNumber(set.reps)
      return weight !== null && reps !== null ? weight * reps : null
    })
  })
  return { completedExercises, completedWorkSets, totalVolume: sumRecorded(volumeParts) }
}

export function calculateProgressEntries(sessions: WorkoutSession[], exercises: Exercise[]): ExerciseProgressEntry[] {
  return exercises
    .map((exercise) => ({ exercise, statistics: calculateExerciseStatistics(sessions, exercise.id, exercise.trackingMode) }))
    .filter((entry) => entry.statistics.sessionCount > 0)
    .sort((left, right) => (right.statistics.latest?.date ?? '').localeCompare(left.statistics.latest?.date ?? ''))
}
