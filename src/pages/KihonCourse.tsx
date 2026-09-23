import React, { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  CirclePlay,
  ClipboardCheck,
  Clock3,
  Dumbbell,
  LockKeyhole,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from "lucide-react"
import { Button, ProgressBar, Tag } from "../components/ui"
import {
  allKihonLessons,
  kihonModules,
  kihonWeeks,
  totalKihonLessons,
  type KihonLesson,
} from "../data/kihonCourse"

const STORAGE_KEY = "geki-kihon-progress"
const COURSE_PATH = "/app-courses/geki-kihon"
const lessonPath = (id: string) => `${COURSE_PATH}/lesson/${id}`

function readProgress(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function youtubeEmbed(id: string, autoplay = false) {
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    controls: "1",
    enablejsapi: "1",
  })
  if (autoplay) params.set("autoplay", "1")
  return `https://www.youtube.com/embed/${id}?${params.toString()}`
}

export function VideoModal({
  lesson, onClose, onComplete, onNext, onPrevious,
  isComplete = false, hasNext = false, hasPrevious = false,
  previewMode = false,
}: {
  lesson: KihonLesson | null
  onClose: () => void
  onComplete?: () => void
  onNext?: () => void
  onPrevious?: () => void
  isComplete?: boolean
  hasNext?: boolean
  hasPrevious?: boolean
  previewMode?: boolean
}) {
  useEffect(() => {
    if (!lesson) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
      if (event.key === "ArrowRight" && hasNext) onNext?.()
      if (event.key === "ArrowLeft" && hasPrevious) onPrevious?.()
    }
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [lesson, onClose, onNext, onPrevious, hasNext, hasPrevious])

  if (!lesson) return null

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/85 p-3 backdrop-blur-xl animate-in fade-in duration-200 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={lesson.title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/10 bg-[#0b0b0d] shadow-[0_30px_120px_rgba(0,0,0,.75)] animate-in zoom-in-95 slide-in-from-bottom-2 duration-300 lg:max-w-4xl xl:max-w-5xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 md:px-5 lg:py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Tag>GEKI KIHON</Tag>
              <span className="text-[10px] uppercase tracking-[.18em] text-white/30">{lesson.number}</span>
            </div>
            <h2 className="mt-2 truncate text-base font-semibold md:text-xl">{lesson.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 grid size-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[.04] text-white/60 transition hover:scale-105 hover:bg-white/[.08] hover:text-white"
            aria-label="Close video"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex justify-center bg-black">
          <div className="aspect-video w-full max-w-[960px] lg:h-[54vh] lg:w-auto lg:max-w-[96vw]">
            <iframe
              className="h-full w-full"
              src={youtubeEmbed(lesson.youtubeId, true)}
              title={lesson.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>

        <div className="border-t border-white/10 bg-white/[.02] p-3 md:p-4 lg:p-4">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="text-[10px] uppercase tracking-[.18em] text-white/35">Lesson focus</div>
              <p className="mt-2 text-sm leading-6 text-white/55">{lesson.description}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-white/30">
                <Clock3 size={14} /> {lesson.duration}
              </div>
            </div>

            {!previewMode && (
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                {hasPrevious && (
                  <Button variant="outline" onClick={onPrevious}>
                    <ArrowLeft size={14} /> Previous
                  </Button>
                )}
                {onComplete && (
                  <Button variant={isComplete ? "outline" : undefined} onClick={onComplete}>
                    <Check size={14} /> {isComplete ? "Completed" : "Mark done"}
                  </Button>
                )}
                {hasNext && (
                  <Button onClick={onNext}>
                    Next video <ArrowRight size={14} />
                  </Button>
                )}
                {!hasNext && isComplete && (
                  <Button onClick={onClose}>
                    <ArrowLeft size={14} /> Back to course
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function LessonRow({
  lesson,
  done,
  locked,
  onPlay,
}: {
  lesson: KihonLesson
  done: boolean
  locked?: boolean
  onPlay: () => void
}) {
  return (
    <div
      className={`group flex items-center gap-3 rounded-2xl border p-3 transition ${
        locked
          ? "border-transparent opacity-45"
          : "border-white/6 bg-white/[.015] hover:border-white/10 hover:bg-white/[.04]"
      }`}
    >
      <div
        className={`grid size-9 shrink-0 place-items-center rounded-full ${
          done
            ? "bg-[#e11d2e]/12 text-[#e11d2e]"
            : "border border-white/10 text-white/30"
        }`}
      >
        {done ? <Check size={15} /> : <span className="text-[11px]">{lesson.number.split(".")[1]}</span>}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{lesson.title}</div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-white/30">
          <span>{lesson.type}</span>
          <span>·</span>
          <span>{lesson.duration}</span>
        </div>
      </div>

      <button
        type="button"
        disabled={locked}
        onClick={onPlay}
        className="grid size-9 place-items-center rounded-full border border-white/10 text-white/45 transition hover:bg-white hover:text-black disabled:pointer-events-none"
        aria-label={`Play ${lesson.title}`}
      >
        {locked ? <LockKeyhole size={14} /> : <Play size={14} fill="currentColor" />}
      </button>
    </div>
  )
}

export function KihonCourse() {
  const navigate = useNavigate()
  const [openModule, setOpenModule] = useState("foundations")
  const [completed, setCompleted] = useState<string[]>(readProgress)
  const [previewLesson, setPreviewLesson] = useState<KihonLesson | null>(null)

  const completedCount = completed.filter((id) => allKihonLessons.some((lesson) => lesson.id === id)).length
  const progress = Math.round((completedCount / totalKihonLessons) * 100)

  const nextLesson = useMemo(
    () => allKihonLessons.find((lesson) => !completed.includes(lesson.id)) ?? allKihonLessons[0],
    [completed],
  )

  const toggleComplete = (id: string) => {
    setCompleted((current) => {
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]

      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  return (
    <div className="min-h-screen bg-[#080809] text-white">
      <div className="mx-auto max-w-7xl p-5 md:p-8">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[#0d0d0f] p-6 md:p-10">
          <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-[#e11d2e]/15 blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-120px] left-[35%] size-72 rounded-full bg-white/[.035] blur-3xl" />

          <div className="relative grid gap-10 lg:grid-cols-[1.25fr_.75fr] lg:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Tag>GEKI ACADEMY</Tag>
                <Tag>KIHON BASICS</Tag>
                <span className="text-[10px] uppercase tracking-[.18em] text-white/30">
                  Level 01
                </span>
              </div>

              <h1 className="font-display mt-7 max-w-4xl text-6xl uppercase leading-[.88] tracking-[-.04em] md:text-8xl">
                Build the
                <br />
                <span className="text-[#e11d2e]">foundation.</span>
              </h1>

              <p className="mt-7 max-w-2xl text-sm leading-7 text-white/50 md:text-base">
                A structured Kihon system built around awareness, stance, control, power,
                movement and repetition. Learn the technique. Practice the process. Own the
                basics.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button onClick={() => navigate(lessonPath(nextLesson.id))}>
                  <Play size={15} fill="currentColor" />
                  {completedCount ? "Continue training" : "Start course"}
                </Button>
                <Button variant="outline" onClick={() => setPreviewLesson(allKihonLessons[0])}>
                  <CirclePlay size={15} />
                  Preview first lesson
                </Button>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/35">
                <span className="inline-flex items-center gap-2"><Clock3 size={14} /> 4–6 week path</span>
                <span className="inline-flex items-center gap-2"><Target size={14} /> {totalKihonLessons} lessons</span>
                <span className="inline-flex items-center gap-2"><ShieldCheck size={14} /> Self-check system</span>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[.025] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[.18em] text-white/30">
                    Your progress
                  </div>
                  <div className="mt-2 text-3xl font-semibold">{progress}%</div>
                </div>
                <div className="grid size-12 place-items-center rounded-full border border-[#e11d2e]/30 bg-[#e11d2e]/10 text-[#e11d2e]">
                  <Sparkles size={18} />
                </div>
              </div>

              <div className="mt-5">
                <ProgressBar value={progress} />
              </div>

              <div className="mt-3 flex justify-between text-xs text-white/30">
                <span>{completedCount} complete</span>
                <span>{totalKihonLessons - completedCount} remaining</span>
              </div>

              <div className="mt-6 border-t border-white/8 pt-5">
                <div className="text-[10px] uppercase tracking-[.18em] text-white/30">
                  Next lesson
                </div>
                <div className="mt-2 font-medium">{nextLesson.title}</div>
                <div className="mt-1 text-xs text-white/35">{nextLesson.description}</div>
              </div>
            </div>
          </div>
        </section>

        {/* PROTOCOL */}
        <section className="mt-6 grid gap-5 lg:grid-cols-[.82fr_1.18fr]">
          <div className="rounded-[26px] border border-white/10 bg-white/[.025] p-6 md:p-7">
            <Tag>THE GEKI PROTOCOL</Tag>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">How every lesson works.</h2>
            <p className="mt-3 text-sm leading-6 text-white/45">
              The same practice logic follows you through every technique in the course.
            </p>

            <div className="mt-6 space-y-2">
              {[
                ["01", "Shizentai", "Awareness"],
                ["02", "Dachi", "Position"],
                ["03", "Yoi", "Preparation"],
                ["04", "Kamaete", "Ready"],
                ["05", "Technique", "Execute"],
                ["06", "×6 Control", "Slow + precise"],
                ["07", "Kiai Irete", "Power"],
                ["08", "×10–20", "Volume"],
                ["09", "Naore", "Reset"],
              ].map(([number, title, sub]) => (
                <div key={number} className="flex items-center gap-3 rounded-xl border border-white/7 bg-black/15 p-3">
                  <span className="text-[10px] font-semibold text-[#e11d2e]">{number}</span>
                  <span className="w-28 text-sm font-medium">{title}</span>
                  <span className="text-xs text-white/30">{sub}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-white/[.025] p-6 md:p-7">
            <div className="flex items-end justify-between gap-4">
              <div>
                <Tag>6-WEEK PATH</Tag>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight">Train in sequence.</h2>
              </div>
              <div className="text-right text-xs text-white/30">
                <div className="text-lg font-semibold text-white">{progress}%</div>
                <div>course progress</div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {kihonWeeks.map((item) => (
                <div key={item.week} className="rounded-2xl border border-white/7 bg-black/15 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[.18em] text-[#e11d2e]">
                      Week {item.week}
                    </span>
                    <ChevronRight size={14} className="text-white/20" />
                  </div>
                  <div className="mt-3 font-medium">{item.title}</div>
                  <p className="mt-1 text-xs leading-5 text-white/35">{item.focus}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CURRICULUM */}
        <section className="mt-10">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <Tag>CURRICULUM</Tag>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight">The complete Kihon path.</h2>
              <p className="mt-2 max-w-2xl text-sm text-white/40">
                Work through each module in order. Each lesson includes key points, a practice task
                and a self-check before you move on.
              </p>
            </div>
            <div className="text-xs text-white/30">
              {completedCount}/{totalKihonLessons} lessons complete
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {kihonModules.map((module) => {
              const moduleDone = module.lessons.filter((lesson) => completed.includes(lesson.id)).length
              const isOpen = openModule === module.id

              return (
                <section
                  key={module.id}
                  className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[.02]"
                >
                  <button
                    type="button"
                    onClick={() => setOpenModule(isOpen ? "" : module.id)}
                    className="flex w-full items-center gap-4 px-5 py-5 text-left transition hover:bg-white/[.025] md:px-6"
                  >
                    <div className="grid size-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-black/15 text-xs font-semibold text-[#e11d2e]">
                      {module.number}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] uppercase tracking-[.18em] text-white/30">
                          {module.eyebrow}
                        </span>
                        <span className="text-[10px] text-white/20">{module.week}</span>
                      </div>
                      <h3 className="mt-1 text-lg font-semibold">{module.title}</h3>
                      <p className="mt-1 max-w-3xl text-xs leading-5 text-white/35">
                        {module.description}
                      </p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <div className="text-xs text-white/40">
                        {moduleDone}/{module.lessons.length}
                      </div>
                      <div className="mt-2 w-24">
                        <ProgressBar value={(moduleDone / module.lessons.length) * 100} />
                      </div>
                    </div>
                    {isOpen ? <ChevronDown size={18} className="text-white/35" /> : <ChevronRight size={18} className="text-white/35" />}
                  </button>

                  {isOpen && (
                    <div className="border-t border-white/8 p-4 md:p-5">
                      <div className="grid gap-2">
                        {module.lessons.map((lesson) => (
                          <LessonRow
                            key={lesson.id}
                            lesson={lesson}
                            done={completed.includes(lesson.id)}
                            onPlay={() => setPreviewLesson(lesson)}
                            locked={false}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        </section>

        {/* TRAINING DASHBOARD */}
        <section className="mt-10 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <div className="rounded-[26px] border border-white/10 bg-white/[.025] p-6 md:p-7">
            <div className="flex items-center justify-between">
              <div>
                <Tag>PRACTICE SYSTEM</Tag>
                <h2 className="mt-4 text-2xl font-semibold">Don't just watch. Train.</h2>
              </div>
              <Dumbbell size={20} className="text-white/25" />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ["01", "Watch", "Understand the movement and key points."],
                ["02", "Drill", "Use the slow repetitions to own the mechanics."],
                ["03", "Reflect", "Self-check, record yourself and progress."],
              ].map(([num, title, body]) => (
                <div key={num} className="rounded-2xl border border-white/7 bg-black/15 p-4">
                  <div className="text-[10px] font-semibold text-[#e11d2e]">{num}</div>
                  <div className="mt-4 font-medium">{title}</div>
                  <p className="mt-1 text-xs leading-5 text-white/35">{body}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-[#e11d2e]/20 bg-[#e11d2e]/5 p-5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#ff7a84]">
                <ClipboardCheck size={15} />
                Weekly practice rule
              </div>
              <p className="mt-2 text-sm leading-6 text-white/55">
                Repeat the same technique on at least three separate training days before moving on.
                Quality first. Speed and power only come after consistency.
              </p>
            </div>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-white/[.025] p-6 md:p-7">
            <Tag>COURSE RESET</Tag>
            <h2 className="mt-4 text-2xl font-semibold">Need to start again?</h2>
            <p className="mt-3 text-sm leading-6 text-white/40">
              Resetting is useful when you want to run the course as a new training block.
            </p>
            <Button
              variant="outline"
              className="mt-6 w-full"
              onClick={() => {
                localStorage.removeItem(STORAGE_KEY)
                setCompleted([])
              }}
            >
              <RotateCcw size={15} />
              Reset my progress
            </Button>
          </div>
        </section>
      </div>

      <VideoModal
        lesson={previewLesson}
        onClose={() => setPreviewLesson(null)}
        previewMode
      />
    </div>
  )
}

export function KihonLesson() {
  const { lessonId } = useParams<{ lessonId: string }>()
  const navigate = useNavigate()
  const lesson = allKihonLessons.find((item) => item.id === lessonId) ?? allKihonLessons[0]

  const [completed, setCompleted] = useState<string[]>(readProgress)
  const [showVideo, setShowVideo] = useState(false)
  const [checks, setChecks] = useState<string[]>([])
  const [practiceChecks, setPracticeChecks] = useState<string[]>([])

  const lessonIndex = allKihonLessons.findIndex((item) => item.id === lesson.id)
  const previous = allKihonLessons[lessonIndex - 1]
  const next = allKihonLessons[lessonIndex + 1]
  const done = completed.includes(lesson.id)

  const markComplete = () => {
    const nextState = done
      ? completed.filter((item) => item !== lesson.id)
      : [...completed, lesson.id]

    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
    setCompleted(nextState)


  }

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>, id: string) => {
    setter((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  const currentProgress = Math.round(
    (completed.filter((id) => allKihonLessons.some((item) => item.id === id)).length / totalKihonLessons) * 100,
  )

  return (
    <div className="min-h-screen bg-[#080809] text-white">
      <div className="mx-auto max-w-7xl p-5 md:p-8">
        <div className="flex flex-wrap items-center gap-2 text-xs text-white/30">
          <Link to={COURSE_PATH} className="hover:text-white">GEKI Kihon Basics</Link>
          <span>/</span>
          <span>{lesson.title}</span>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_360px]">
          <main>
            <div className="overflow-hidden rounded-[26px] border border-white/10 bg-[#0d0d0f]">
              <button
                type="button"
                onClick={() => setShowVideo(true)}
                className="group relative aspect-video w-full overflow-hidden bg-black"
              >
                <img
                  src={`https://i.ytimg.com/vi/${lesson.youtubeId}/hqdefault.jpg`}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-65 transition duration-500 group-hover:scale-[1.02] group-hover:opacity-75"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/15" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(225,29,46,.18),transparent_45%)]" />
                <div className="absolute left-5 top-5 flex items-center gap-2">
                  <Tag>GEKI KIHON</Tag>
                  <span className="text-[10px] uppercase tracking-[.18em] text-white/25">{lesson.number}</span>
                </div>

                <div className="absolute inset-0 grid place-items-center">
                  <div className="grid size-20 place-items-center rounded-full bg-white text-black shadow-[0_18px_80px_rgba(255,255,255,.12)] transition duration-300 group-hover:scale-105">
                    <Play size={28} fill="currentColor" />
                  </div>
                </div>

                <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4 text-left">
                  <div>
                    <div className="text-xs text-white/35">{lesson.type} · {lesson.duration}</div>
                    <div className="mt-1 text-lg font-semibold md:text-2xl">{lesson.title}</div>
                  </div>
                  <div className="hidden rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/50 sm:flex sm:items-center sm:gap-2">
                    <CirclePlay size={14} />
                    Open video
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-7">
              <div className="flex flex-wrap items-center gap-2">
                <Tag>{lesson.type}</Tag>
                <Tag>{lesson.duration}</Tag>
                {done && <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e11d2e]/20 bg-[#e11d2e]/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.15em] text-[#ff7a84]"><Check size={12} /> Complete</span>}
              </div>

              <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">{lesson.title}</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/50">{lesson.description}</p>

              <div className="mt-8 grid gap-3 md:grid-cols-3">
                {lesson.keyPoints.map((point) => (
                  <div key={point} className="rounded-2xl border border-white/8 bg-white/[.02] p-4">
                    <div className="mb-3 grid size-8 place-items-center rounded-lg bg-white/[.05] text-[#e11d2e]">
                      <Target size={14} />
                    </div>
                    <div className="text-sm leading-6 text-white/65">{point}</div>
                  </div>
                ))}
              </div>

              <section className="mt-8 rounded-[26px] border border-white/10 bg-white/[.025] p-5 md:p-7">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Tag>PRACTICE TASK</Tag>
                    <h2 className="mt-4 text-xl font-semibold">Do the work.</h2>
                  </div>
                  <Dumbbell className="text-white/20" size={20} />
                </div>

                <div className="mt-6 space-y-2">
                  {lesson.practice.map((task) => (
                    <label
                      key={task.id}
                      className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition ${
                        practiceChecks.includes(task.id)
                          ? "border-[#e11d2e]/20 bg-[#e11d2e]/5"
                          : "border-white/8 bg-black/10 hover:bg-white/[.025]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={practiceChecks.includes(task.id)}
                        onChange={() => toggle(setPracticeChecks, task.id)}
                        className="mt-1 accent-[#e11d2e]"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{task.label}{task.reps ? ` · ${task.reps}` : ""}</span>
                        <span className="mt-1 block text-xs leading-5 text-white/35">{task.detail}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </section>

              <section className="mt-5 rounded-[26px] border border-white/10 bg-white/[.025] p-5 md:p-7">
                <div className="flex items-center justify-between">
                  <div>
                    <Tag>SELF-CHECK</Tag>
                    <h2 className="mt-4 text-xl font-semibold">Would your Senpai see it?</h2>
                  </div>
                  <ShieldCheck size={20} className="text-white/20" />
                </div>

                <p className="mt-2 text-sm text-white/35">
                  Tick only the points you can reproduce consistently.
                </p>

                <div className="mt-6 grid gap-2 md:grid-cols-2">
                  {lesson.selfCheck.map((item) => (
                    <label
                      key={item.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                        checks.includes(item.id)
                          ? "border-[#e11d2e]/20 bg-[#e11d2e]/5 text-white"
                          : "border-white/7 text-white/45 hover:bg-white/[.025]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checks.includes(item.id)}
                        onChange={() => toggle(setChecks, item.id)}
                        className="accent-[#e11d2e]"
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </section>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button onClick={markComplete}>
                  {done ? <RotateCcw size={15} /> : <Check size={15} />}
                  {done ? "Mark as incomplete" : "Mark as complete"}
                </Button>
                {previous && (
                  <Button variant="outline" onClick={() => navigate(lessonPath(previous.id))}>
                    <ArrowLeft size={15} />
                    Previous
                  </Button>
                )}
                {next && (
                  <Button variant="outline" onClick={() => navigate(lessonPath(next.id))}>
                    Next lesson
                    <ArrowRight size={15} />
                  </Button>
                )}
              </div>
            </div>
          </main>

          <aside className="h-fit rounded-[26px] border border-white/10 bg-white/[.025] p-4 xl:sticky xl:top-6">
            <div className="flex items-center justify-between px-2 py-3">
              <div>
                <div className="text-[10px] uppercase tracking-[.18em] text-white/30">Course progress</div>
                <div className="mt-1 text-xl font-semibold">{currentProgress}%</div>
              </div>
              <Link to={COURSE_PATH} className="text-xs text-white/35 hover:text-white">
                Overview
              </Link>
            </div>

            <div className="px-2">
              <ProgressBar value={currentProgress} />
            </div>

            <div className="mt-5 space-y-4">
              {kihonModules.map((module) => (
                <div key={module.id}>
                  <div className="px-2 text-[10px] uppercase tracking-[.17em] text-white/25">
                    {module.number} · {module.title}
                  </div>
                  <div className="mt-2 space-y-1">
                    {module.lessons.map((item) => (
                      <Link
                        key={item.id}
                        to={lessonPath(item.id)}
                        className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs transition ${
                          item.id === lesson.id
                            ? "bg-white/[.07] text-white"
                            : "text-white/35 hover:bg-white/[.04] hover:text-white"
                        }`}
                      >
                        <span className={`grid size-6 place-items-center rounded-full ${
                          completed.includes(item.id)
                            ? "bg-[#e11d2e]/12 text-[#e11d2e]"
                            : "border border-white/8"
                        }`}>
                          {completed.includes(item.id) ? <Check size={11} /> : <span>{item.number.split(".")[1]}</span>}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>

      <VideoModal
        lesson={showVideo ? lesson : null}
        onClose={() => setShowVideo(false)}
        isComplete={done}
        hasPrevious={Boolean(previous)}
        hasNext={Boolean(next)}
        onComplete={() => { if (!done) markComplete() }}
        onPrevious={() => {
          if (previous) {
            navigate(lessonPath(previous.id))
          }
        }}
        onNext={() => {
          if (next) {
            if (!done) markComplete()
            navigate(lessonPath(next.id))
          }
        }}
      />
    </div>
  )
}
