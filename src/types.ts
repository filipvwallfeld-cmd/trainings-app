export type Category =
  | 'Brust'
  | 'Rücken'
  | 'Schultern'
  | 'Arme'
  | 'Beine'
  | 'Core'
  | 'Mobility'
  | 'Knie'
  | 'Nacken/HWS'

export type Exercise = {
  id: string
  name: string
  category: Category
  goal: string
  execution: string
  mistakes: string
  easier: string
  harder: string
  substitute: string
}

export type WorkoutSection = 'warmup' | 'strength' | 'core' | 'cooldown' | 'routine'

export type RoutineStep = {
  templateExerciseId?: string
  exerciseId: string
  prescription: string
  note: string
  targetSets?: number
  section?: WorkoutSection
  restSeconds?: number
}

export type WorkoutTemplate = {
  id: string
  name: string
  shortName: string
  kind: 'strength' | 'routine'
  description: string
  frequency: string
  steps: RoutineStep[]
}

export type PlanUnit = WorkoutTemplate

export type SetEntry = {
  id: string
  weight: string
  reps: string
  rir: string
  done: boolean
  restSeconds?: number
}

export type SessionExerciseSource = 'template' | 'added' | 'replacement'

export type SessionExercise = RoutineStep & {
  id: string
  exerciseName: string
  source: SessionExerciseSource
  replacedExerciseId?: string
  order: number
  section: WorkoutSection
  restSeconds: number
  sets: SetEntry[]
  userNote: string
  skipped: boolean
  removed: boolean
}

export type WorkoutExercise = SessionExercise

export type PainValues = {
  neck: number
  lowerBack: number
  hip: number
  leftKnee: number
}

export type WorkoutSession = {
  id: string
  templateId?: string
  sessionType?: 'training-a' | 'training-b' | 'free' | 'routine'
  unitId: string
  unitName: string
  kind: 'strength' | 'routine'
  status: 'active' | 'completed'
  startedAt: string
  completedAt?: string
  exercises: WorkoutExercise[]
  durationMinutes: number
  effort: number
  pain: PainValues
  note: string
  isPaused: boolean
  pauseStartedAt?: string
  pausedMs: number
  restEndsAt?: string
  restExerciseId?: string
}

export type BackupFile = {
  app: 'trainings-app'
  version: 1
  exportedAt: string
  sessions: WorkoutSession[]
}
