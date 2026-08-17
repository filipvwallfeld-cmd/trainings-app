import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { exerciseById as systemExerciseById, exercises as systemExercises, freeWorkoutTemplate, medicalNotice, neckWarning, painRules, planUnits, unitById } from './data'
import { clearSessions, deleteSession, getAllSessions, importBackup, isValidBackup, saveSession } from './db'
import { createCustomExercise, getCustomExercises, saveCustomExercise } from './exercise-db'
import { exerciseFilters, filterExercises, recentExerciseIds, type ExerciseFilter } from './exercise-library'
import { createSessionExercise, createSet, createSetsFromPrevious, createWorkoutSession, DEFAULT_REST_SECONDS, findLastCompletedSets, isSetCompleted, sessionHasCompletedSet } from './session'
import { calculateExerciseStatistics, calculateProgressEntries, calculateWorkoutSummary, toSetPerformance, type ExerciseProgressPoint, type ExerciseStatistics, type SetPerformance } from './statistics'
import type { BackupFile, Category, CustomExerciseInput, Exercise, ExerciseTrackingMode, SessionExercise, WorkoutExercise, WorkoutSection, WorkoutSession } from './types'

type Tab = 'today' | 'train' | 'plan' | 'exercises' | 'progress' | 'history' | 'settings'

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Heute', icon: '●' },
  { id: 'train', label: 'Trainieren', icon: '▶' },
  { id: 'plan', label: 'Plan', icon: '▤' },
  { id: 'exercises', label: 'Übungen', icon: '◇' },
  { id: 'progress', label: 'Fortschritt', icon: '↗' },
  { id: 'history', label: 'Verlauf', icon: '↻' },
  { id: 'settings', label: 'Einstellungen', icon: '⚙' },
]

const sectionLabels: Record<WorkoutSection, string> = {
  warmup: 'Warm-up & Mobility',
  strength: 'Krafttraining',
  core: 'Core / Prehab',
  cooldown: 'Cool-down / Mobility',
  routine: 'Routine',
}

function formatDate(value?: string) {
  if (!value) return '–'
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatShortDate(value?: string) {
  if (!value) return '–'
  return new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(new Date(value))
}

function sessionMinutes(session: WorkoutSession) {
  const end = session.completedAt ? new Date(session.completedAt).getTime() : Date.now()
  const currentPause = session.isPaused && session.pauseStartedAt ? end - new Date(session.pauseStartedAt).getTime() : 0
  return Math.max(0, Math.round((end - new Date(session.startedAt).getTime() - session.pausedMs - currentPause) / 60000))
}

function App() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [customExercises, setCustomExercises] = useState<Exercise[]>([])
  const [active, setActive] = useState<WorkoutSession | null>(null)
  const [tab, setTab] = useState<Tab>('today')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [planId, setPlanId] = useState<string | null>(null)
  const [progressId, setProgressId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  const refresh = async () => {
    const all = await getAllSessions()
    setSessions(all)
    setActive(all.find((session) => session.status === 'active') ?? null)
  }

  useEffect(() => {
    Promise.all([refresh(), getCustomExercises().then(setCustomExercises)])
      .catch(() => setToast('Lokale Daten konnten nicht vollständig geladen werden.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const readHash = () => {
      const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
      const nextTab = tabs.some((item) => item.id === parts[0]) ? (parts[0] as Tab) : 'today'
      setTab(nextTab)
      setDetailId(nextTab === 'history' ? parts[1] ?? null : null)
      setPlanId(nextTab === 'plan' ? parts[1] ?? null : null)
      setProgressId(nextTab === 'progress' ? parts[1] ?? null : null)
    }
    readHash()
    window.addEventListener('hashchange', readHash)
    return () => window.removeEventListener('hashchange', readHash)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const navigate = (nextTab: Tab, id?: string) => {
    window.location.hash = `/${nextTab}${id ? `/${id}` : ''}`
  }

  const begin = async (unitId: string) => {
    if (active) {
      setToast('Dein unfertiges Training wurde wieder geöffnet.')
      navigate('train')
      return
    }
    const unit = unitById.get(unitId)
    if (!unit) throw new Error('Trainingseinheit nicht gefunden')
    const session = createWorkoutSession(unit, sessions.filter((item) => item.status === 'completed'))
    await saveSession(session)
    setActive(session)
    setSessions((current) => [session, ...current])
    navigate('train')
  }

  const complete = async (session: WorkoutSession) => {
    await saveSession(session)
    setActive(null)
    await refresh()
    navigate('history', session.id)
    setToast('Training gespeichert.')
  }

  const abort = async (sessionId: string) => {
    await deleteSession(sessionId)
    setActive(null)
    await refresh()
    navigate('train')
    setToast('Training verworfen.')
  }

  const allExercises = useMemo(() => [...systemExercises, ...customExercises], [customExercises])
  const allExerciseById = useMemo(() => new Map(allExercises.map((exercise) => [exercise.id, exercise])), [allExercises])

  const addCustomExercise = async (input: CustomExerciseInput) => {
    const normalizedName = input.name.trim().toLocaleLowerCase('de')
    if (!normalizedName) throw new Error('Bitte gib einen Namen ein.')
    if (allExercises.some((exercise) => exercise.name.trim().toLocaleLowerCase('de') === normalizedName)) throw new Error('Eine Übung mit diesem Namen gibt es bereits.')
    const created = createCustomExercise(input)
    await saveCustomExercise(created)
    setCustomExercises((current) => [...current, created].sort((left, right) => left.name.localeCompare(right.name, 'de')))
    setToast('Eigene Übung gespeichert.')
    return created
  }

  const completed = sessions.filter((session) => session.status === 'completed')
  const latest = completed[0]

  if (loading) return <div className="splash"><div className="brand-mark">M</div><p>Dein Training wird geladen …</p></div>

  let content: ReactNode
  if (tab === 'today') content = <Today latest={latest} active={active} onBegin={begin} onOpenHistory={(id) => navigate('history', id)} />
  else if (tab === 'train') content = active
    ? <ActiveWorkout session={active} history={completed} availableExercises={allExercises} availableExerciseById={allExerciseById} onCreateCustom={addCustomExercise} onChange={setActive} onComplete={complete} onAbort={abort} onToast={setToast} />
    : <Train onBegin={begin} />
  else if (tab === 'plan') content = <Plan selectedId={planId} onSelect={(id) => navigate('plan', id)} onBegin={begin} />
  else if (tab === 'exercises') content = <Exercises sessions={completed} availableExercises={allExercises} onCreateCustom={addCustomExercise} onOpenProgress={(id) => navigate('progress', id)} />
  else if (tab === 'progress') content = <Progress sessions={completed} availableExercises={allExercises} detailId={progressId} onOpen={(id) => navigate('progress', id)} onBack={() => navigate('progress')} />
  else if (tab === 'history') content = <History sessions={completed} exerciseById={allExerciseById} detailId={detailId} onOpen={(id) => navigate('history', id)} onBack={() => navigate('history')} onDelete={async (id) => { await deleteSession(id); await refresh(); navigate('history'); setToast('Eintrag gelöscht.') }} />
  else content = <Settings sessions={sessions} onRefresh={refresh} onToast={setToast} />

  return (
    <div className="app-shell">
      <main className="content">{content}</main>
      <nav className="bottom-nav" aria-label="Hauptnavigation">
        {tabs.map((item) => (
          <button key={item.id} className={tab === item.id ? 'nav-item active' : 'nav-item'} onClick={() => navigate(item.id)}>
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

function PageHeader({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return <header className="page-header"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{text && <p>{text}</p>}</header>
}

function Today({ latest, active, onBegin, onOpenHistory }: { latest?: WorkoutSession; active: WorkoutSession | null; onBegin: (id: string) => void; onOpenHistory: (id: string) => void }) {
  const hour = new Date().getHours()
  const greeting = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend'
  return (
    <>
      <PageHeader eyebrow={new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())} title={`${greeting}, Filip`} text="Was tut dir heute gut?" />
      {active && <button className="resume-card" onClick={() => onBegin(active.unitId)}><span><small>Unfertiges Training</small><strong>{active.unitName}</strong></span><b>Fortsetzen →</b></button>}
      <section className="hero-card">
        <div><span className="tag">Krafttraining</span><h2>Ganzkörper A</h2><p>Brust, Rücken und Kniekontrolle</p></div>
        <button className="round-action" onClick={() => onBegin('training-a')} aria-label="Training A starten">▶</button>
      </section>
      <div className="section-heading"><h2>Heute auswählen</h2><span>Dein Plan</span></div>
      <div className="unit-grid">
        {planUnits.filter((unit) => unit.id !== 'training-a').map((unit) => <UnitCard key={unit.id} unitId={unit.id} onBegin={onBegin} />)}
      </div>
      <div className="section-heading"><h2>Zuletzt</h2></div>
      {latest ? (
        <button className="history-preview" onClick={() => onOpenHistory(latest.id)}>
          <span className="history-date">{formatShortDate(latest.completedAt)}</span>
          <span><strong>{latest.unitName}</strong><small>{latest.durationMinutes} Min · Anstrengung {latest.effort}/10</small></span><b>›</b>
        </button>
      ) : <div className="empty-card"><strong>Noch kein Training gespeichert</strong><p>Dein erstes abgeschlossenes Training erscheint hier.</p></div>}
    </>
  )
}

function UnitCard({ unitId, onBegin }: { unitId: string; onBegin: (id: string) => void }) {
  const unit = unitById.get(unitId)!
  const icon = unit.kind === 'strength' ? '↗' : unit.id === 'mobility' ? '≈' : unit.id === 'knee' ? '⌁' : unit.id === 'neck' ? '◉' : unit.id === 'cardio' ? '⌁' : '◇'
  return <button className={`unit-card accent-${unit.id}`} onClick={() => onBegin(unit.id)}><span className="unit-icon">{icon}</span><span><strong>{unit.shortName}</strong><small>{unit.frequency}</small></span><b>›</b></button>
}

function Train({ onBegin }: { onBegin: (id: string) => void }) {
  return <><PageHeader eyebrow="Bereit, wenn du es bist" title="Trainieren" text="Wähle eine Einheit. Deine Eingaben bleiben automatisch auf diesem Gerät gespeichert." />
    <div className="stack">
      {planUnits.slice(0, 2).map((unit, index) => <article className="training-choice" key={unit.id}><div className="choice-number">0{index + 1}</div><span className="tag">{unit.frequency}</span><h2>{unit.name}</h2><p>{unit.description}</p><div className="choice-meta"><span>{unit.steps.filter((step) => step.section === 'strength').length} Kraftübungen</span><span>ca. 60–75 Min</span></div><button className="primary wide" onClick={() => onBegin(unit.id)}>Training starten <span>→</span></button></article>)}
    </div>
    <button className="free-workout-button" onClick={() => onBegin(freeWorkoutTemplate.id)}><span><strong>Freie Einheit</strong><small>Übungen für heute selbst zusammenstellen</small></span><b>+</b></button>
    <div className="section-heading"><h2>Kurze Routinen</h2></div>
    <div className="unit-grid">{planUnits.slice(2).map((unit) => <UnitCard key={unit.id} unitId={unit.id} onBegin={onBegin} />)}</div>
  </>
}

function Plan({ selectedId, onSelect, onBegin }: { selectedId: string | null; onSelect: (id: string) => void; onBegin: (id: string) => void }) {
  if (selectedId) {
    const unit = unitById.get(selectedId)
    if (unit) return <><button className="back-button" onClick={() => window.location.hash = '/plan'}>← Plan</button><PageHeader eyebrow={unit.frequency} title={unit.name} text={unit.description} />
      {(unit.kind === 'strength' ? (['warmup', 'strength', 'core', 'cooldown'] as WorkoutSection[]) : ['routine'] as WorkoutSection[]).map((section) => {
        const sectionSteps = unit.steps.filter((step) => (step.section ?? 'routine') === section)
        if (!sectionSteps.length) return null
        return <section className={section === 'strength' ? 'plan-section strength' : 'plan-section'} key={section}><div className="plan-section-title"><span>{sectionLabels[section]}</span><small>{sectionSteps.length} Übungen</small></div><div className="plan-list">{sectionSteps.map((item, index) => { const exercise = systemExerciseById.get(item.exerciseId); return <article className="plan-step" key={item.templateExerciseId ?? `${item.exerciseId}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{exercise?.name}</h3><strong>{item.prescription}</strong><p>{item.note}</p></div></article> })}</div></section>
      })}
      <button className="primary wide sticky-action" onClick={() => onBegin(unit.id)}>Einheit starten</button>
    </>
  }
  return <><PageHeader eyebrow="Trainingsplan Version 7" title="Dein Plan" text="2–3 realistische Trainingstage mit Kraft, Mobility und Prävention." />
    <div className="week-card"><span>Minimalwoche</span><strong>Training A + Training B</strong><small>Gute Woche: zusätzlich lockeres Bike oder Walk/Jog</small></div>
    <div className="stack">{planUnits.map((unit) => <button className="plan-unit" key={unit.id} onClick={() => onSelect(unit.id)}><div><span className="tag">{unit.frequency}</span><h2>{unit.name}</h2><p>{unit.description}</p></div><b>›</b></button>)}</div>
    <section className="notice warning"><strong>Schmerzampel</strong>{painRules.map(([level, rule]) => <div className="rule" key={level}><span>{level}</span><p>{rule}</p></div>)}</section>
    <section className="notice danger"><strong>Nacken/HWS</strong><p>{neckWarning}</p></section>
  </>
}

function Exercises({ sessions, availableExercises, onCreateCustom, onOpenProgress }: { sessions: WorkoutSession[]; availableExercises: Exercise[]; onCreateCustom: (input: CustomExerciseInput) => Promise<Exercise>; onOpenProgress: (id: string) => void }) {
  const [filter, setFilter] = useState<ExerciseFilter>('all')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const recentIds = useMemo(() => recentExerciseIds(sessions), [sessions])
  const filtered = useMemo(() => filterExercises(availableExercises, query, filter, recentIds), [availableExercises, filter, query, recentIds])
  return <><PageHeader eyebrow={`${availableExercises.length} Übungen in deiner Bibliothek`} title="Übungen" text="Suche nach Name, Kategorie oder Muskelgruppe." />
    <button className="create-exercise-button" onClick={() => setCreating((value) => !value)}>+ Eigene Übung erstellen</button>
    {creating && <CustomExerciseForm onCreate={async (input) => { await onCreateCustom(input); setCreating(false) }} onCancel={() => setCreating(false)} />}
    <label className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Übung suchen" /></label>
    <div className="filter-row">{exerciseFilters.map((item) => <button key={item.id} className={filter === item.id ? 'chip active' : 'chip'} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>
    <div className="exercise-list">{filtered.map((item) => <article className={openId === item.id ? 'exercise-library-card open' : 'exercise-library-card'} key={item.id}>
      <button className="exercise-summary" onClick={() => setOpenId(openId === item.id ? null : item.id)}><ExerciseArt category={item.category} /><span><small>{item.custom ? 'Eigene Übung' : item.category}</small><strong>{item.name}</strong><em>{item.primaryMuscle} · {item.equipment}</em></span><b>{openId === item.id ? '−' : '+'}</b></button>
      {openId === item.id && <div className="exercise-details"><Info label="Kategorie" value={`${item.category} · ${item.primaryMuscle}`} /><Info label="Tracking" value={trackingModeLabel(item.trackingMode)} /><Info label="Ausführung" value={item.execution} /><Info label="Häufige Fehler" value={item.mistakes} /><Info label="Leichter" value={item.easier} /><Info label="Schwieriger" value={item.harder} /><Info label="Ersatz" value={item.substitute} /><ExerciseProgressPreview exercise={item} sessions={sessions} onOpen={() => onOpenProgress(item.id)} /></div>}
    </article>)}{filtered.length === 0 && <div className="picker-empty">Keine passende Übung gefunden.</div>}</div>
  </>
}

function ExerciseProgressPreview({ exercise, sessions, onOpen }: { exercise: Exercise; sessions: WorkoutSession[]; onOpen: () => void }) {
  const statistics = calculateExerciseStatistics(sessions, exercise.id, exercise.trackingMode)
  return <div className="progress-preview"><div><strong>{statistics.sessionCount ? `${statistics.sessionCount} ${statistics.sessionCount === 1 ? 'Training' : 'Trainings'}` : 'Noch kein Verlauf'}</strong><small>{statistics.latest ? `Zuletzt ${formatShortDay(statistics.latest.date)}` : 'Nach dem ersten abgeschlossenen Satz verfügbar'}</small></div><button onClick={onOpen}>Statistik öffnen ›</button></div>
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(value)
}

function formatShortDay(value: string) {
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value))
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${formatNumber(seconds)} Sek.`
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')} Min`
}

function formatSetCount(count: number) {
  return `${count} ${count === 1 ? 'Satz' : 'Sätze'}`
}

function formatSessionCount(count: number) {
  return `${count} ${count === 1 ? 'Einheit' : 'Einheiten'}`
}

function formatSetPerformance(set: SetPerformance, trackingMode: ExerciseTrackingMode) {
  if (trackingMode === 'duration') return set.durationSeconds !== null ? formatDuration(set.durationSeconds) : 'Dauer nicht eingetragen'
  if (trackingMode === 'reps_only' || trackingMode === 'bodyweight_reps') return set.reps !== null ? `${formatNumber(set.reps)} Wdh.` : 'Wiederholungen nicht eingetragen'
  if (set.weight !== null && set.reps !== null) return `${formatNumber(set.weight)} kg × ${formatNumber(set.reps)}`
  if (set.weight !== null) return `${formatNumber(set.weight)} kg`
  if (set.reps !== null) return `${formatNumber(set.reps)} Wdh.`
  return 'Werte nicht eingetragen'
}

function latestPerformance(statistics: ExerciseStatistics) {
  const latest = statistics.latest
  if (!latest) return 'Noch kein Training'
  if (statistics.trackingMode === 'duration') return `${latest.longestDurationSeconds !== null ? formatDuration(latest.longestDurationSeconds) : 'Dauer offen'} · ${formatSetCount(latest.workSets)}`
  if (statistics.trackingMode === 'reps_only' || statistics.trackingMode === 'bodyweight_reps') return `${latest.maxReps !== null ? `${formatNumber(latest.maxReps)} Wdh.` : 'Wiederholungen offen'} · ${formatSetCount(latest.workSets)}`
  const strongestSet = [...latest.sets].filter((set) => set.weight !== null).sort((left, right) => (right.weight ?? 0) - (left.weight ?? 0))[0]
  return `${strongestSet ? formatSetPerformance(strongestSet, statistics.trackingMode) : 'Gewicht offen'} · ${formatSetCount(latest.workSets)}`
}

function Progress({ sessions, availableExercises, detailId, onOpen, onBack }: { sessions: WorkoutSession[]; availableExercises: Exercise[]; detailId: string | null; onOpen: (id: string) => void; onBack: () => void }) {
  const entries = useMemo(() => calculateProgressEntries(sessions, availableExercises), [availableExercises, sessions])
  const selectedExercise = detailId ? availableExercises.find((exercise) => exercise.id === detailId) : undefined
  const detail = selectedExercise ? { exercise: selectedExercise, statistics: calculateExerciseStatistics(sessions, selectedExercise.id, selectedExercise.trackingMode) } : null
  if (detail) return <ExerciseDetail exercise={detail.exercise} statistics={detail.statistics} onBack={onBack} />

  return <><PageHeader eyebrow="Aus deinen abgeschlossenen Sätzen" title="Fortschritt" text="Nur Übungen mit echten historischen Leistungsdaten erscheinen hier." />
    {entries.length === 0 ? <div className="empty-state"><span>↗</span><h2>Noch keine Leistungsdaten</h2><p>Schließe mindestens einen Satz ab. Danach erscheint die Übung hier.</p></div> : <div className="progress-list">{entries.map(({ exercise, statistics }) => <button key={exercise.id} onClick={() => onOpen(exercise.id)}><ExerciseArt category={exercise.category} /><span><strong>{exercise.name}</strong><small>{latestPerformance(statistics)}</small><em>{statistics.sessionCount} {statistics.sessionCount === 1 ? 'Training' : 'Trainings'} · {formatSetCount(statistics.totalWorkSets)}</em></span><b>›</b></button>)}</div>}
  </>
}

function ExerciseDetail({ exercise, statistics, onBack }: { exercise: Exercise; statistics: ExerciseStatistics; onBack: () => void }) {
  return <><button className="back-button" onClick={onBack}>← Fortschritt</button>
    <header className="exercise-detail-header"><span className="eyebrow">{exercise.custom ? 'Eigene Übung' : exercise.category}</span><h1>{exercise.name}</h1><p>{exercise.primaryMuscle} · {exercise.equipment} · {trackingModeLabel(exercise.trackingMode)}</p></header>
    <div className="exercise-kpis"><div className="wide"><small>Letztes Training</small><strong>{statistics.latest ? formatShortDay(statistics.latest.date) : '–'}</strong><span>{latestPerformance(statistics)}</span></div><div><small>Trainings</small><strong>{statistics.sessionCount}</strong></div><div><small>Arbeitssätze</small><strong>{statistics.totalWorkSets}</strong></div>{statistics.totalVolume !== null && <div className="wide"><small>Gesamtvolumen</small><strong>{formatNumber(statistics.totalVolume)} kg</strong></div>}</div>
    {exercise.trackingMode === 'weight_reps' && <WeightProgressChart points={statistics.points} />}
    <PersonalRecords statistics={statistics} />
    <section className="exercise-history"><div className="detail-section-title"><h2>Verlauf</h2><span>{formatSessionCount(statistics.sessionCount)}</span></div>{statistics.points.length === 0 ? <div className="empty-card"><strong>Noch keine abgeschlossenen Sätze</strong><p>Diese Seite füllt sich nach dem ersten Training.</p></div> : [...statistics.points].reverse().map((point) => <article key={point.sessionId}><div><strong>{formatShortDay(point.date)}</strong><small>{point.sessionName} · {formatSetCount(point.workSets)}</small></div><div className="exercise-history-sets">{point.sets.map((set, index) => <p key={set.setId}><span>Satz {index + 1}</span><b>{formatSetPerformance(set, statistics.trackingMode)}</b>{set.rir && <small>RIR {set.rir}</small>}</p>)}</div>{point.volume !== null && <footer>Volumen <strong>{formatNumber(point.volume)} kg</strong></footer>}</article>)}</section>
  </>
}

function WeightProgressChart({ points }: { points: ExerciseProgressPoint[] }) {
  const values = points.filter((point): point is ExerciseProgressPoint & { maxWeight: number } => point.maxWeight !== null).slice(-8)
  if (!values.length) return <section className="detail-card"><div className="detail-section-title"><h2>Gewichtsentwicklung</h2></div><p className="muted-copy">Noch keine eingetragenen Gewichte.</p></section>
  const weights = values.map((point) => point.maxWeight)
  const minimum = Math.min(...weights)
  const maximum = Math.max(...weights)
  const range = Math.max(1, maximum - minimum)
  const coordinates = values.map((point, index) => ({
    x: values.length === 1 ? 160 : 24 + (index / (values.length - 1)) * 272,
    y: 122 - ((point.maxWeight - minimum) / range) * 86,
    point,
  }))
  return <section className="detail-card weight-chart"><div className="detail-section-title"><h2>Gewichtsentwicklung</h2><span>max. Gewicht je Einheit</span></div><svg viewBox="0 0 320 150" role="img" aria-label="Gewichtsentwicklung"><line x1="24" y1="36" x2="296" y2="36" /><line x1="24" y1="79" x2="296" y2="79" /><line x1="24" y1="122" x2="296" y2="122" /><polyline points={coordinates.map(({ x, y }) => `${x},${y}`).join(' ')} />{coordinates.map(({ x, y, point }) => <g key={point.sessionId}><circle cx={x} cy={y} r="5" /><text x={x} y={Math.max(18, y - 10)}>{formatNumber(point.maxWeight)}</text></g>)}</svg><div className="chart-dates">{coordinates.map(({ point }) => <span key={point.sessionId}>{new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' }).format(new Date(point.date))}</span>)}</div></section>
}

function PersonalRecords({ statistics }: { statistics: ExerciseStatistics }) {
  const records: Array<{ label: string; value: string }> = []
  if (statistics.highestWeight !== null && statistics.highestWeight > 0) records.push({ label: 'Weight PR', value: `${formatNumber(statistics.highestWeight)} kg` })
  if (statistics.highestReps !== null) records.push({ label: 'Rep PR', value: `${formatNumber(statistics.highestReps)} Wdh.` })
  if (statistics.longestDurationSeconds !== null) records.push({ label: 'Längste Dauer', value: formatDuration(statistics.longestDurationSeconds) })
  if (statistics.volumeRecord !== null) records.push({ label: 'Volume PR', value: `${formatNumber(statistics.volumeRecord)} kg` })
  if (statistics.estimatedOneRepMax !== null) records.push({ label: 'geschätztes 1RM', value: `${formatNumber(statistics.estimatedOneRepMax)} kg` })
  return <section className="detail-card"><div className="detail-section-title"><h2>Bestleistungen</h2></div>{records.length ? <div className="record-grid">{records.map((record) => <div key={record.label}><strong>{record.value}</strong><small>{record.label}</small></div>)}</div> : <p className="muted-copy">Noch keine messbare Bestleistung.</p>}</section>
}

function ExerciseArt({ category }: { category: Category }) {
  const marks: Record<Category, string> = { Brust: '↔', Rücken: '⌁', Schultern: '╱╲', Arme: '⌒', Beine: '╱', Core: '◎', Mobility: '≈', Knie: '⌞', 'Nacken/HWS': '◉' }
  return <span className="exercise-art" aria-hidden="true"><i>{marks[category]}</i></span>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="info-row"><strong>{label}</strong><p className={value.startsWith('Im Trainingsplan') ? 'muted' : ''}>{value}</p></div>
}

function ActiveWorkout({ session, history, availableExercises, availableExerciseById, onCreateCustom, onChange, onComplete, onAbort, onToast }: { session: WorkoutSession; history: WorkoutSession[]; availableExercises: Exercise[]; availableExerciseById: Map<string, Exercise>; onCreateCustom: (input: CustomExerciseInput) => Promise<Exercise>; onChange: (session: WorkoutSession) => void; onComplete: (session: WorkoutSession) => void; onAbort: (sessionId: string) => Promise<void>; onToast: (message: string) => void }) {
  const [finishOpen, setFinishOpen] = useState(false)
  const [abortOpen, setAbortOpen] = useState(false)
  const [emptyOpen, setEmptyOpen] = useState(false)
  const [tick, setTick] = useState(0)
  const [picker, setPicker] = useState<{ mode: 'add' | 'replace'; exerciseIndex?: number } | null>(null)
  const saveTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => saveSession(session).catch(() => onToast('Automatisches Speichern fehlgeschlagen.')), 350)
    return () => window.clearTimeout(saveTimer.current)
  }, [session, onToast])

  const updateExercise = (index: number, update: (exercise: WorkoutExercise) => WorkoutExercise) => {
    onChange({ ...session, exercises: session.exercises.map((exercise, exerciseIndex) => exerciseIndex === index ? update(exercise) : exercise) })
  }

  const toggleSet = (exerciseIndex: number, setId: string) => {
    const exercise = session.exercises[exerciseIndex]
    const set = exercise.sets.find((entry) => entry.id === setId)
    if (!set) return
    const done = !set.done
    onChange({
      ...session,
      exercises: session.exercises.map((item, index) => index === exerciseIndex ? {
        ...item,
        sets: item.sets.map((entry) => entry.id === setId ? { ...entry, done, restSeconds: done ? item.restSeconds : entry.restSeconds } : entry),
      } : item),
      restEndsAt: done && exercise.section === 'strength' ? new Date(Date.now() + exercise.restSeconds * 1000).toISOString() : session.restEndsAt,
      restExerciseId: done && exercise.section === 'strength' ? exercise.id : session.restExerciseId,
    })
  }

  const chooseExercise = (selected: Exercise) => {
    if (!picker) return
    if (picker.mode === 'replace' && picker.exerciseIndex !== undefined) {
      const current = session.exercises[picker.exerciseIndex]
      const targetSets = current.sets.length || current.targetSets || 3
      const replacement = createSessionExercise(selected, current.order, 'replacement', {
        templateExerciseId: current.templateExerciseId,
        replacedExerciseId: current.source === 'replacement' && current.replacedExerciseId ? current.replacedExerciseId : current.exerciseId,
        section: current.section,
        targetSets,
        restSeconds: current.restSeconds,
        prescription: current.prescription,
        note: `Für diese Session statt ${current.exerciseName}`,
        sets: createSetsFromPrevious(targetSets, findLastCompletedSets(history, selected.id)),
      })
      onChange({ ...session, exercises: session.exercises.map((item, index) => index === picker.exerciseIndex ? replacement : item) })
    } else {
      const insertionIndex = session.exercises.reduce((last, item, index) => item.section === 'strength' ? index + 1 : last, 0)
      const added = createSessionExercise(selected, insertionIndex, 'added', { section: 'strength', targetSets: 3, restSeconds: DEFAULT_REST_SECONDS, sets: createSetsFromPrevious(3, findLastCompletedSets(history, selected.id)) })
      const next = [...session.exercises]
      next.splice(insertionIndex, 0, added)
      onChange({ ...session, exercises: next.map((item, index) => ({ ...item, order: index })) })
    }
    setPicker(null)
  }

  const togglePause = () => {
    if (session.isPaused && session.pauseStartedAt) {
      onChange({ ...session, isPaused: false, pausedMs: session.pausedMs + Date.now() - new Date(session.pauseStartedAt).getTime(), pauseStartedAt: undefined })
    } else onChange({ ...session, isPaused: true, pauseStartedAt: new Date().toISOString() })
  }

  const abortCurrentSession = async () => {
    window.clearTimeout(saveTimer.current)
    await onAbort(session.id)
  }

  const completeCurrentSession = (completedSession: WorkoutSession) => {
    window.clearTimeout(saveTimer.current)
    onComplete(completedSession)
  }

  const requiredExercises = session.kind === 'strength' ? session.exercises.filter((item) => item.section === 'strength' && !item.removed && !item.skipped) : session.exercises.filter((item) => !item.removed && !item.skipped)
  const doneSets = requiredExercises.flatMap((item) => item.sets).filter((set) => isSetCompleted(set)).length
  const totalSets = requiredExercises.flatMap((item) => item.sets).length
  const progress = totalSets ? Math.round((doneSets / totalSets) * 100) : 0
  const elapsed = sessionMinutes(session)

  const renderCompactSection = (section: WorkoutSection, summary: string) => {
    const sectionItems = session.exercises.map((item, index) => ({ item, index })).filter(({ item }) => item.section === section && !item.removed)
    if (!sectionItems.length) return null
    return <details className="compact-workout-section"><summary><span><strong>{sectionLabels[section]}</strong><small>{sectionItems.length} Übungen · {summary}</small></span><b>›</b></summary><div className="compact-exercise-list">{sectionItems.map(({ item, index }) => <div className={item.skipped ? 'compact-exercise skipped' : 'compact-exercise'} key={item.id}><button className={item.sets[0]?.done ? 'compact-check done' : 'compact-check'} onClick={() => item.sets[0] && toggleSet(index, item.sets[0].id)}>{item.sets[0]?.done ? '✓' : ''}</button><span><strong>{item.exerciseName}</strong><small>{item.prescription}</small></span><div className="compact-actions"><button onClick={() => setPicker({ mode: 'replace', exerciseIndex: index })}>Ersetzen</button><button onClick={() => updateExercise(index, (exercise) => ({ ...exercise, removed: true }))}>Entfernen</button></div></div>)}</div></details>
  }

  const renderStrengthExercise = (item: SessionExercise, exerciseIndex: number) => {
    const detail = availableExerciseById.get(item.exerciseId)
    const trackingMode = detail?.trackingMode ?? 'weight_reps'
    const usesWeight = trackingMode === 'weight_reps'
    const repetitionLabel = trackingMode === 'duration' ? 'Sek.' : 'Wdh.'
    const previousSets = findLastCompletedSets(history, item.exerciseId)
    return <article className={item.skipped ? 'workout-exercise skipped' : 'workout-exercise'} key={item.id} data-exercise-id={item.exerciseId}>
      <div className="exercise-head"><span className="exercise-index">{String(session.exercises.filter((exercise) => exercise.section === 'strength' && !exercise.removed).findIndex((exercise) => exercise.id === item.id) + 1).padStart(2, '0')}</span><div><h2>{item.exerciseName}</h2><p>{item.prescription} · {item.note}</p>{item.source !== 'template' && <span className={`source-badge ${item.source}`}>{item.source === 'added' ? 'Heute hinzugefügt' : `Heute ersetzt: ${availableExerciseById.get(item.replacedExerciseId ?? '')?.name ?? item.replacedExerciseId}`}</span>}</div><details className="session-exercise-menu"><summary aria-label={`${item.exerciseName} Aktionen`}>…</summary><div><button onClick={() => setPicker({ mode: 'replace', exerciseIndex })}>Für heute ersetzen</button><button onClick={() => updateExercise(exerciseIndex, (exercise) => ({ ...exercise, removed: true }))}>Für heute entfernen</button><button onClick={() => updateExercise(exerciseIndex, (exercise) => ({ ...exercise, skipped: !exercise.skipped }))}>{item.skipped ? 'Übung fortsetzen' : 'Überspringen'}</button></div></details></div>
      {detail && <details className="instructions"><summary>Ausführung & Ersatz</summary><p>{detail.execution}</p><small>Ersatz: {detail.substitute}</small></details>}
      {previousSets.length > 0 && <div className="previous-values"><span>Letztes Mal</span><strong>{previousSets.map((set) => `${set.weight ? `${set.weight} kg × ` : ''}${set.reps || '–'}`).join(' · ')}</strong></div>}
      {!item.skipped && <>
        <div className="exercise-rest-setting"><span>Pause <strong>{formatSeconds(item.restSeconds)}</strong></span><div><button onClick={() => updateExercise(exerciseIndex, (exercise) => ({ ...exercise, restSeconds: Math.max(30, exercise.restSeconds - 30) }))}>−30</button><button onClick={() => updateExercise(exerciseIndex, (exercise) => ({ ...exercise, restSeconds: Math.min(600, exercise.restSeconds + 30) }))}>+30</button></div></div>
        <div className="set-labels"><span>Satz</span><span>{usesWeight ? 'kg' : '–'}</span><span>{repetitionLabel}</span><span>RIR</span><span>Fertig</span></div>
        <div className="sets">{item.sets.map((set, setIndex) => <div className={set.done ? 'set-row done' : 'set-row'} key={set.id}>
          <span className="set-number">{setIndex + 1}</span>
          <input disabled={!usesWeight} aria-label={`${item.exerciseName} Gewicht Satz ${setIndex + 1}`} inputMode="decimal" placeholder={usesWeight ? previousSets[setIndex]?.weight || '–' : '–'} value={usesWeight ? set.weight : ''} onChange={(event) => updateExercise(exerciseIndex, (exercise) => ({ ...exercise, sets: exercise.sets.map((current) => current.id === set.id ? { ...current, weight: event.target.value.replace('.', ',') } : current) }))} />
          <input aria-label={`${item.exerciseName} ${trackingMode === 'duration' ? 'Dauer' : 'Wiederholungen'} Satz ${setIndex + 1}`} inputMode="numeric" placeholder={previousSets[setIndex]?.reps || '–'} value={set.reps} onChange={(event) => updateExercise(exerciseIndex, (exercise) => ({ ...exercise, sets: exercise.sets.map((current) => current.id === set.id ? { ...current, reps: event.target.value } : current) }))} />
          <input aria-label={`${item.exerciseName} RIR Satz ${setIndex + 1}`} inputMode="numeric" placeholder="–" value={set.rir} onChange={(event) => updateExercise(exerciseIndex, (exercise) => ({ ...exercise, sets: exercise.sets.map((current) => current.id === set.id ? { ...current, rir: event.target.value } : current) }))} />
          <button aria-label={`${item.exerciseName} Satz ${setIndex + 1} abhaken`} className="check-button" onClick={() => toggleSet(exerciseIndex, set.id)}>{set.done ? '✓' : ''}</button>
        </div>)}</div>
        <div className="set-actions"><button onClick={() => updateExercise(exerciseIndex, (exercise) => ({ ...exercise, sets: [...exercise.sets, createSet()] }))}>+ Satz</button><button disabled={item.sets.length <= 1} onClick={() => updateExercise(exerciseIndex, (exercise) => ({ ...exercise, sets: exercise.sets.slice(0, -1) }))}>− Satz</button></div>
        <textarea className="exercise-note" placeholder="Notiz zu dieser Übung …" value={item.userNote} onChange={(event) => updateExercise(exerciseIndex, (exercise) => ({ ...exercise, userNote: event.target.value }))} />
      </>}
    </article>
  }

  return <div className="active-workout">
    <header className="workout-header"><div><span className="live-dot">● LIVE</span><h1>{session.unitName}</h1><small>{elapsed} Min · {doneSets}/{totalSets} Sätze</small></div><button className="icon-button" onClick={togglePause}>{session.isPaused ? '▶' : 'Ⅱ'}</button></header>
    <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
    {session.isPaused && <div className="paused-banner"><strong>Training pausiert</strong><button onClick={togglePause}>Fortsetzen</button></div>}
    {session.kind === 'strength' && <RestTimer session={session} tick={tick} onChange={onChange} />}
    {session.kind === 'strength' ? <>
      {renderCompactSection('warmup', 'ca. 7 Minuten')}
      <div className="workout-section-heading"><span>Krafttraining</span><small>{session.exercises.filter((item) => item.section === 'strength' && !item.removed).length} Übungen</small></div>
      <div className="active-exercises">{session.exercises.map((item, exerciseIndex) => item.section === 'strength' && !item.removed ? renderStrengthExercise(item, exerciseIndex) : null)}</div>
      <button className="add-exercise-button" onClick={() => setPicker({ mode: 'add' })}>+ Übung hinzufügen</button>
      {renderCompactSection('core', 'optional')}
      {renderCompactSection('cooldown', 'ca. 3–5 Minuten')}
    </> : <div className="routine-session-list">{session.exercises.map((item, index) => !item.removed && <div className="compact-exercise" key={item.id}><button className={item.sets[0]?.done ? 'compact-check done' : 'compact-check'} onClick={() => item.sets[0] && toggleSet(index, item.sets[0].id)}>{item.sets[0]?.done ? '✓' : ''}</button><span><strong>{item.exerciseName}</strong><small>{item.prescription}</small></span></div>)}</div>}
    {session.exercises.some((item) => item.removed) && <details className="removed-exercises"><summary>Für heute entfernt ({session.exercises.filter((item) => item.removed).length})</summary>{session.exercises.map((item, index) => item.removed && <button key={item.id} onClick={() => updateExercise(index, (exercise) => ({ ...exercise, removed: false }))}>{item.exerciseName} wiederherstellen</button>)}</details>}
    <div className="workout-end-actions"><button className="finish-button" onClick={() => sessionHasCompletedSet(session) ? setFinishOpen(true) : setEmptyOpen(true)}>Training beenden</button><button className="abort-button" onClick={() => setAbortOpen(true)}>Training abbrechen</button></div>
    {finishOpen && <FinishSheet session={{ ...session, durationMinutes: session.durationMinutes || elapsed }} onClose={() => setFinishOpen(false)} onComplete={completeCurrentSession} />}
    {abortOpen && <AbortWorkoutSheet onClose={() => setAbortOpen(false)} onAbort={abortCurrentSession} />}
    {emptyOpen && <EmptyWorkoutSheet onClose={() => setEmptyOpen(false)} onAbort={abortCurrentSession} />}
    {picker && <ExercisePicker mode={picker.mode} currentExerciseId={picker.exerciseIndex === undefined ? undefined : session.exercises[picker.exerciseIndex]?.exerciseId} availableExercises={availableExercises} recentIds={recentExerciseIds(history)} onCreateCustom={onCreateCustom} onSelect={chooseExercise} onClose={() => setPicker(null)} />}
  </div>
}

function RestTimer({ session, tick, onChange }: { session: WorkoutSession; tick: number; onChange: (session: WorkoutSession) => void }) {
  const remaining = session.restEndsAt ? Math.max(0, Math.ceil((new Date(session.restEndsAt).getTime() - Date.now()) / 1000)) : 0
  const activeExercise = session.exercises.find((item) => item.id === session.restExerciseId)
  const adjust = (seconds: number) => onChange({ ...session, restEndsAt: new Date(Math.max(Date.now(), new Date(session.restEndsAt ?? Date.now()).getTime() + seconds * 1000)).toISOString() })
  const stop = () => onChange({ ...session, restEndsAt: undefined, restExerciseId: undefined })
  return <div className={session.restEndsAt ? 'rest-timer running' : 'rest-timer'} data-tick={tick}><div><small>{activeExercise ? `Pause nach ${activeExercise.exerciseName}` : 'Pausentimer · Standard'}</small><strong>{session.restEndsAt ? formatSeconds(remaining) : formatSeconds(DEFAULT_REST_SECONDS)}</strong></div>{session.restEndsAt ? <><button onClick={() => adjust(-30)}>−30</button><button onClick={() => adjust(30)}>+30</button><button className="ghost" onClick={stop}>{remaining ? 'Überspringen' : 'Beenden'}</button></> : <button onClick={() => onChange({ ...session, restEndsAt: new Date(Date.now() + DEFAULT_REST_SECONDS * 1000).toISOString() })}>Start</button>}</div>
}

function formatSeconds(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function trackingModeLabel(mode: ExerciseTrackingMode) {
  if (mode === 'weight_reps') return 'Gewicht + Wiederholungen'
  if (mode === 'reps_only') return 'Nur Wiederholungen'
  if (mode === 'duration') return 'Dauer'
  return 'Körpergewicht + Wiederholungen'
}

function ExercisePicker({ mode, currentExerciseId, availableExercises, recentIds, onCreateCustom, onSelect, onClose }: { mode: 'add' | 'replace'; currentExerciseId?: string; availableExercises: Exercise[]; recentIds: string[]; onCreateCustom: (input: CustomExerciseInput) => Promise<Exercise>; onSelect: (exercise: Exercise) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ExerciseFilter>('all')
  const [creating, setCreating] = useState(false)
  const eligible = useMemo(() => availableExercises.filter((exercise) => exercise.id !== currentExerciseId), [availableExercises, currentExerciseId])
  const candidates = useMemo(() => filterExercises(eligible, query, filter, recentIds), [eligible, filter, query, recentIds])

  return <div className="sheet-backdrop"><section className="exercise-picker" role="dialog" aria-modal="true"><div className="sheet-handle" /><div className="sheet-title"><div><span className="eyebrow">Nur diese Session</span><h2>{mode === 'add' ? 'Übung hinzufügen' : 'Übung ersetzen'}</h2></div><button className="icon-button" onClick={onClose}>×</button></div>
    {creating ? <CustomExerciseForm onCreate={async (input) => onSelect(await onCreateCustom(input))} onCancel={() => setCreating(false)} /> : <>
      <button className="create-exercise-button compact" onClick={() => setCreating(true)}>+ Eigene Übung erstellen</button>
      <label className="search"><span>⌕</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, Kategorie oder Muskel" /></label>
      <div className="filter-row picker-filters">{exerciseFilters.map((item) => <button key={item.id} className={filter === item.id ? 'chip active' : 'chip'} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>
      <div className="picker-list">{candidates.map((exercise) => <button key={exercise.id} onClick={() => onSelect(exercise)}><ExerciseArt category={exercise.category} /><span><strong>{exercise.name}</strong><small>{exercise.primaryMuscle} · {exercise.equipment}{exercise.custom ? ' · Eigene Übung' : ''}</small></span><b>+</b></button>)}{candidates.length === 0 && <div className="picker-empty">{filter === 'recent' && recentIds.length === 0 ? 'Noch keine verwendeten Übungen.' : 'Keine passende Übung gefunden.'}</div>}</div>
    </>}
  </section></div>
}

function CustomExerciseForm({ onCreate, onCancel }: { onCreate: (input: CustomExerciseInput) => Promise<void | Exercise>; onCancel: () => void }) {
  const [draft, setDraft] = useState<CustomExerciseInput>({ name: '', category: 'Brust', trackingMode: 'weight_reps', primaryMuscle: '', equipment: '', laterality: 'bilateral' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const categories: Category[] = ['Brust', 'Rücken', 'Schultern', 'Arme', 'Beine', 'Core', 'Mobility', 'Knie', 'Nacken/HWS']
  const save = async () => {
    if (!draft.name.trim()) {
      setError('Bitte gib einen Namen ein.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onCreate(draft)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Die Übung konnte nicht gespeichert werden.')
      setSaving(false)
    }
  }
  return <div className="custom-exercise-form">
    <p>Die Übung wird dauerhaft nur auf diesem Gerät gespeichert.</p>
    <label className="field"><span>Name *</span><input autoFocus value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="z. B. Hack Squat neues Gerät" /></label>
    <label className="field"><span>Kategorie *</span><select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as Category })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
    <label className="field"><span>Tracking *</span><select value={draft.trackingMode} onChange={(event) => setDraft({ ...draft, trackingMode: event.target.value as ExerciseTrackingMode })}><option value="weight_reps">Gewicht + Wiederholungen</option><option value="reps_only">Nur Wiederholungen</option><option value="duration">Dauer</option><option value="bodyweight_reps">Körpergewicht + Wiederholungen</option></select></label>
    <label className="field"><span>Primäre Muskelgruppe</span><input value={draft.primaryMuscle} onChange={(event) => setDraft({ ...draft, primaryMuscle: event.target.value })} placeholder="optional" /></label>
    <label className="field"><span>Equipment</span><input value={draft.equipment} onChange={(event) => setDraft({ ...draft, equipment: event.target.value })} placeholder="optional" /></label>
    <label className="field"><span>Ausführung</span><select value={draft.laterality} onChange={(event) => setDraft({ ...draft, laterality: event.target.value as 'unilateral' | 'bilateral' })}><option value="bilateral">Beidseitig</option><option value="unilateral">Einseitig</option></select></label>
    {error && <p className="form-error">{error}</p>}
    <div className="custom-form-actions"><button className="secondary-button" onClick={onCancel}>Abbrechen</button><button className="primary" disabled={saving} onClick={save}>{saving ? 'Speichert …' : 'Übung speichern'}</button></div>
  </div>
}

function AbortWorkoutSheet({ onClose, onAbort }: { onClose: () => void; onAbort: () => Promise<void> }) {
  return <div className="sheet-backdrop"><section className="finish-sheet confirmation-sheet" role="dialog" aria-modal="true"><div className="sheet-handle" /><span className="eyebrow">Eingaben verwerfen</span><h2>Training wirklich abbrechen?</h2><p>Alle Eingaben dieser Trainingseinheit werden verworfen.</p><div className="confirmation-actions"><button className="secondary-button" onClick={onClose}>Weitertrainieren</button><button className="destructive-button" onClick={onAbort}>Training abbrechen</button></div></section></div>
}

function EmptyWorkoutSheet({ onClose, onAbort }: { onClose: () => void; onAbort: () => Promise<void> }) {
  return <div className="sheet-backdrop"><section className="finish-sheet confirmation-sheet" role="dialog" aria-modal="true"><div className="sheet-handle" /><span className="eyebrow">Noch keine Leistung</span><h2>In diesem Training wurde noch kein Satz abgeschlossen.</h2><p>Leere Trainings werden nicht im Verlauf gespeichert und beeinflussen keine Statistik.</p><div className="confirmation-actions"><button className="secondary-button" onClick={onClose}>Weitertrainieren</button><button className="destructive-button" onClick={onAbort}>Training abbrechen</button></div></section></div>
}

function FinishSheet({ session, onClose, onComplete }: { session: WorkoutSession; onClose: () => void; onComplete: (session: WorkoutSession) => void }) {
  const [draft, setDraft] = useState(session)
  const painFields: Array<[keyof WorkoutSession['pain'], string]> = [['neck', 'Nacken'], ['lowerBack', 'Unterer Rücken'], ['hip', 'Hüfte'], ['leftKnee', 'Linkes Knie']]
  return <div className="sheet-backdrop"><section className="finish-sheet" role="dialog" aria-modal="true"><div className="sheet-handle" /><div className="sheet-title"><div><span className="eyebrow">Fast geschafft</span><h2>Training abschließen</h2></div><button className="icon-button" onClick={onClose}>×</button></div>
    <label className="field"><span>Trainingsdauer</span><div className="input-suffix"><input inputMode="numeric" value={draft.durationMinutes} onChange={(event) => setDraft({ ...draft, durationMinutes: Number(event.target.value) })} /><b>Min</b></div></label>
    <RangeField label="Anstrengung" value={draft.effort} min={1} onChange={(value) => setDraft({ ...draft, effort: value })} />
    <h3 className="subheading">Beschwerden nach dem Training</h3>
    {painFields.map(([key, label]) => <RangeField key={key} label={label} value={draft.pain[key]} min={0} onChange={(value) => setDraft({ ...draft, pain: { ...draft.pain, [key]: value } })} />)}
    <label className="field"><span>Allgemeine Notiz</span><textarea value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="Wie lief das Training?" /></label>
    <button className="primary wide" onClick={() => onComplete({ ...draft, status: 'completed', completedAt: new Date().toISOString(), isPaused: false, pauseStartedAt: undefined })}>Vollständig speichern</button>
  </section></div>
}

function RangeField({ label, value, min, onChange }: { label: string; value: number; min: number; onChange: (value: number) => void }) {
  return <label className="range-field"><span>{label}<strong>{value}/10</strong></span><input type="range" min={min} max="10" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>
}

function History({ sessions, exerciseById, detailId, onOpen, onBack, onDelete }: { sessions: WorkoutSession[]; exerciseById: Map<string, Exercise>; detailId: string | null; onOpen: (id: string) => void; onBack: () => void; onDelete: (id: string) => void }) {
  const detail = sessions.find((session) => session.id === detailId)
  if (detail) return <HistoryDetail session={detail} exerciseById={exerciseById} onBack={onBack} onDelete={onDelete} />
  return <><PageHeader eyebrow="Lokal auf diesem Gerät" title="Verlauf" text={`${sessions.length} abgeschlossene ${sessions.length === 1 ? 'Einheit' : 'Einheiten'}`} />
    {sessions.length === 0 ? <div className="empty-state"><span>↻</span><h2>Noch kein Verlauf</h2><p>Schließe ein Training ab. Danach findest du hier alle Sätze, Werte und Notizen.</p></div> : <div className="timeline">{sessions.map((session) => <button className="timeline-item" key={session.id} onClick={() => onOpen(session.id)}><span className="timeline-dot" /><div><small>{formatDate(session.completedAt)}</small><strong>{session.unitName}</strong><p>{session.durationMinutes} Min · Anstrengung {session.effort}/10</p></div><b>›</b></button>)}</div>}
  </>
}

function HistoryDetail({ session, exerciseById, onBack, onDelete }: { session: WorkoutSession; exerciseById: Map<string, Exercise>; onBack: () => void; onDelete: (id: string) => void }) {
  const summary = calculateWorkoutSummary(session, exerciseById)
  return <><button className="back-button" onClick={onBack}>← Verlauf</button><PageHeader eyebrow={formatDate(session.completedAt)} title={session.unitName} />
    <div className="stat-grid history-overview"><div><strong>{session.durationMinutes}</strong><small>Minuten</small></div><div><strong>{session.effort}/10</strong><small>Anstrengung</small></div><div><strong>{summary.completedExercises}</strong><small>Übungen</small></div><div><strong>{summary.completedWorkSets}</strong><small>Arbeitssätze</small></div><div><strong>{summary.totalVolume !== null ? formatNumber(summary.totalVolume) : '–'}</strong><small>Volumen kg</small></div></div>
    <div className="pain-summary"><strong>Beschwerden</strong><div><span>Nacken <b>{session.pain.neck}/10</b></span><span>Unterer Rücken <b>{session.pain.lowerBack}/10</b></span><span>Hüfte <b>{session.pain.hip}/10</b></span><span>Linkes Knie <b>{session.pain.leftKnee}/10</b></span></div></div>
    <div className="history-exercises">{session.exercises.map((item, index) => {
      const completedSets = item.sets.map((set, setIndex) => ({ set, setIndex })).filter(({ set }) => isSetCompleted(set))
      const notCompleted = !item.removed && !item.skipped && completedSets.length === 0
      const className = item.removed ? 'removed' : notCompleted ? 'not-completed' : ''
      const trackingMode = exerciseById.get(item.exerciseId)?.trackingMode ?? 'weight_reps'
      return <article className={className} key={item.id}><div><span>{String(index + 1).padStart(2, '0')}</span><h3>{item.exerciseName}</h3>{item.source === 'added' && <small className="history-source added">Hinzugefügt</small>}{item.source === 'replacement' && <small className="history-source replacement">Ersetzt {systemExerciseById.get(item.replacedExerciseId ?? '')?.name ?? item.replacedExerciseId}</small>}{item.removed && <small className="history-source removed">Für diese Session entfernt</small>}{item.skipped && !item.removed && <small>Übersprungen</small>}{notCompleted && <small className="history-source not-completed">Nicht durchgeführt</small>}{item.section !== 'strength' && completedSets.length > 0 && <small className="history-source completed">Abgehakt</small>}</div>{item.section === 'strength' && completedSets.length > 0 && <><div className="history-rest">Pause {formatSeconds(item.restSeconds)}</div><div className="history-sets">{completedSets.map(({ set, setIndex }) => <p key={set.id}><span>Satz {setIndex + 1}</span><strong>{formatSetPerformance(toSetPerformance(set, trackingMode), trackingMode)}{set.rir ? ` · RIR ${set.rir}` : ''}{set.restSeconds ? ` · Pause ${formatSeconds(set.restSeconds)}` : ''}</strong><b>✓</b></p>)}</div></>}{item.userNote && <blockquote>{item.userNote}</blockquote>}</article>
    })}</div>
    {session.note && <div className="session-note"><strong>Notiz</strong><p>{session.note}</p></div>}
    <button className="danger-button" onClick={() => { if (window.confirm('Dieses Training wirklich löschen?')) onDelete(session.id) }}>Training löschen</button>
  </>
}

function Settings({ sessions, onRefresh, onToast }: { sessions: WorkoutSession[]; onRefresh: () => Promise<void>; onToast: (message: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const exportData = () => {
    const backup: BackupFile = { app: 'trainings-app', version: 1, exportedAt: new Date().toISOString(), sessions }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `trainings-app-sicherung-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }
  const importData = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const value: unknown = JSON.parse(await file.text())
      if (!isValidBackup(value)) throw new Error('invalid')
      if (!window.confirm(`Die Sicherung enthält ${value.sessions.length} Einträge. Alle aktuellen lokalen Daten überschreiben?`)) return
      await importBackup(value)
      await onRefresh()
      onToast('Sicherung erfolgreich importiert.')
    } catch {
      onToast('Diese Datei ist keine gültige Trainings-App-Sicherung.')
    }
  }
  const wipe = async () => {
    if (!window.confirm('Wirklich alle lokalen Trainingsdaten löschen? Das kann nicht rückgängig gemacht werden.')) return
    await clearSessions()
    await onRefresh()
    onToast('Alle lokalen Daten wurden gelöscht.')
  }
  return <><PageHeader eyebrow="Privat & offline" title="Einstellungen" text="Deine Trainingsdaten verlassen dieses Gerät nicht." />
    <section className="settings-section"><div className="settings-title"><span>⇩</span><div><h2>Datensicherung</h2><p>{sessions.length} lokale Einträge</p></div></div><button className="setting-row" onClick={exportData}><span><strong>Daten exportieren</strong><small>Als JSON-Datei sichern</small></span><b>›</b></button><button className="setting-row" onClick={() => inputRef.current?.click()}><span><strong>Sicherung importieren</strong><small>Vorhandene Daten überschreiben</small></span><b>›</b></button><input ref={inputRef} className="hidden" type="file" accept="application/json,.json" onChange={importData} /></section>
    <section className="settings-section"><div className="settings-title"><span>⌂</span><div><h2>Offline-App</h2><p>Bereit für den iPhone-Homescreen</p></div></div><div className="offline-steps"><p><b>1</b>In Safari auf „Teilen“ tippen.</p><p><b>2</b>„Zum Home-Bildschirm“ wählen.</p><p><b>3</b>Die App einmal vollständig online öffnen.</p></div></section>
    <section className="notice danger"><strong>Medizinischer Hinweis</strong><p>{medicalNotice}</p></section>
    <button className="danger-button" onClick={wipe}>Alle lokalen Daten löschen</button>
    <p className="version">Trainingsplan Version 7 · App Version 1.0</p>
  </>
}

export default App
