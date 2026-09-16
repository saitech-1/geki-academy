import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Play,
} from 'lucide-react'

import ThreeHero from '../components/ThreeHero'
import { Button, CourseCard, Tag } from '../components/ui'
import { courses } from '../data/mock'

// ============================================================
// HOME
// ============================================================

export function Home() {
  const academyFeatures = [
    {
      number: '01',
      title: 'TECHNIQUE',
      description:
        'Kihon, kata, kumite, movement and tactical development.',
    },
    {
      number: '02',
      title: 'PERFORMANCE',
      description:
        'Strength, speed, power, conditioning, mobility and recovery.',
    },
    {
      number: '03',
      title: 'KNOWLEDGE',
      description:
        'Sports science, coaching, psychology, nutrition and athlete development.',
    },
  ]

  const academyStats = [
    ['120+', 'Lessons'],
    ['24/7', 'Access'],
    ['4', 'Learning tracks'],
    ['1', 'Mission'],
  ]

  return (
    <div className="noise">
      {/* ======================================================
          HERO
      ====================================================== */}

      <section className="relative grid min-h-screen items-center overflow-hidden border-b border-white/8">
        {/* Background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_45%,rgba(225,29,46,.12),transparent_38%),linear-gradient(90deg,#090909_20%,rgba(9,9,9,.86),rgba(9,9,9,.5))]" />

        <div className="absolute inset-0 opacity-80">
          <ThreeHero />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 mx-auto w-full max-w-7xl px-5 pt-28 lg:px-8">
          <div className="max-w-2xl reveal">
            <div className="mb-7 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.25em] text-white/45">
              <span className="size-1.5 rounded-full bg-[#e11d2e]" />
              KUMITE · KATA · S&C · SPORTS SCIENCE
            </div>

            <h1 className="font-display text-[clamp(4rem,11vw,9rem)] leading-[.82]">
              TRAIN HARD.
              <br />

              <span className="text-white/90">
                UNDERSTAND
              </span>

              <br />

              <span className="text-[#e11d2e]">
                MORE.
              </span>
            </h1>

            <p className="mt-8 max-w-xl text-base leading-7 text-white/55 md:text-lg">
              Structured martial arts education and modern
              sports-performance knowledge for athletes,
              coaches, and martial artists.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/courses">
                <Button>
                  Explore Academy
                  <ArrowRight size={16} />
                </Button>
              </Link>

              <Link to="/signup">
                <Button variant="outline">
                  Join GEKI
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Hero Bottom Text */}
        <div className="absolute bottom-8 right-8 hidden text-right lg:block">
          <div className="text-[10px] uppercase tracking-[.24em] text-white/30">
            Train. Understand. Perform.
          </div>

          <div className="mt-1 text-xs text-white/45">
            A digital dojo built for serious practitioners.
          </div>
        </div>
      </section>

      {/* ======================================================
          ACADEMY INTRODUCTION
      ====================================================== */}

      <section className="mx-auto max-w-7xl px-5 py-28 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <Tag>01 / Academy</Tag>

            <h2 className="font-display mt-6 text-6xl leading-[.9] md:text-8xl">
              MORE THAN
              <br />
              TRAINING.
            </h2>
          </div>

          <div className="max-w-2xl lg:pt-16">
            <p className="text-xl leading-8 text-white/65">
              GEKI Academy combines traditional martial arts
              practice with modern sports science to help
              athletes understand not only what to train,
              but why they train it.
            </p>

            <div className="mt-14 grid gap-10 border-t border-white/10 pt-8 md:grid-cols-3">
              {academyFeatures.map((feature) => (
                <div key={feature.number}>
                  <div className="text-xs text-[#e11d2e]">
                    {feature.number}
                  </div>

                  <h3 className="mt-3 text-lg font-semibold">
                    {feature.title}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-white/45">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================
          COURSES
      ====================================================== */}

      <section className="border-y border-white/8 bg-[#0c0c0c]">
        <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
          <div className="mb-12 flex items-end justify-between gap-6">
            <div>
              <Tag>02 / Academy</Tag>

              <h2 className="font-display mt-5 text-6xl leading-none md:text-8xl">
                LEARN FROM
                <br />
                THE DOJO.
              </h2>
            </div>

            <Link
              to="/courses"
              className="hidden text-sm text-white/50 hover:text-white md:flex md:items-center md:gap-2"
            >
              View all courses
              <ArrowRight size={15} />
            </Link>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {courses.slice(0, 6).map((course) => (
              <CourseCard
                key={course.id}
                course={course}
              />
            ))}
          </div>

          <div className="mt-8 md:hidden">
            <Link to="/courses">
              <Button variant="outline">
                View all courses
                <ArrowRight size={15} />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ======================================================
          DIGITAL DOJO
      ====================================================== */}

      <section className="mx-auto max-w-7xl px-5 py-28 lg:px-8">
        <div className="rounded-[2rem] border border-white/10 bg-white/[.03] p-8 md:p-12">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_.9fr] lg:items-end">
            <div>
              <Tag>03 / System</Tag>

              <h2 className="font-display mt-5 max-w-3xl text-6xl leading-[.9] md:text-8xl">
                A DIGITAL
                <br />

                <span className="text-[#e11d2e]">
                  DOJO
                </span>

                <br />

                FOR
                <br />
                THE NEXT LEVEL.
              </h2>
            </div>

            <div>
              <p className="text-sm leading-7 text-white/50">
                Lessons, seminars, progress tracking and
                athlete-development resources — designed as
                a complete learning environment rather than
                a video library.
              </p>

              <div className="mt-7 grid grid-cols-2 gap-3">
                {academyStats.map(([value, label]) => (
                  <div
                    key={label}
                    className="rounded-xl bg-black/30 p-4"
                  >
                    <div className="text-xl font-semibold">
                      {value}
                    </div>

                    <div className="mt-1 text-xs text-white/35">
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================
          UPCOMING SEMINAR
      ====================================================== */}

      <section className="border-t border-white/8">
        <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-white/35">
                Upcoming seminar
              </div>

              <h3 className="mt-3 text-3xl font-semibold">
                Kumite Performance Seminar
              </h3>

              <p className="mt-2 text-sm text-white/45">
                29 September 2026 · Google Meet · GEKI Founder — Sai Zay
              </p>
            </div>

            <Link to="/seminars">
              <Button>
                Register
                <ArrowRight size={15} />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

// ============================================================
// COURSES
// ============================================================

export function Courses() {
  const categories = [
    'All',
    'Kumite',
    'Kata',
    'S&C',
    'Sports Science',
  ]

  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-32 lg:px-8">
      {/* Header */}
      <div className="max-w-3xl">
        <Tag>ACADEMY / COURSES</Tag>

        <h1 className="font-display mt-6 text-7xl leading-[.9] md:text-9xl">
          BUILD YOUR
          <br />

          <span className="text-[#e11d2e]">
            EDGE.
          </span>
        </h1>

        <p className="mt-7 text-lg text-white/50">
          Structured pathways for technique, competition
          and performance.
        </p>
      </div>

      {/* Categories */}
      <div className="mt-14 flex flex-wrap gap-2 border-b border-white/10 pb-4">
        {categories.map((category, index) => (
          <button
            key={category}
            className={`rounded-full px-4 py-2 text-sm ${
              index === 0
                ? 'bg-white text-black'
                : 'text-white/45 hover:bg-white/5 hover:text-white'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Course Grid */}
      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
          />
        ))}
      </div>
    </div>
  )
}

// ============================================================
// COURSE DETAIL
// ============================================================

export function CourseDetail() {
  const course = courses[0]

  const learningStages = [
    {
      title: 'FOUNDATION',
      description: 'Get the technical language.',
    },
    {
      title: 'APPLICATION',
      description: 'Transfer principles into movement.',
    },
    {
      title: 'PERFORMANCE',
      description: 'Train the qualities that matter.',
    },
  ]

  const modules = [
    'Foundation',
    'Movement',
    'Technical Development',
    'Application',
    'Performance',
  ]

  const requirements = [
    'Basic Kyokushin experience',
    'Training notebook',
    'Open training space',
    'Consistent weekly practice',
  ]

  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-28 lg:px-8">
      {/* ======================================================
          COURSE HEADER
      ====================================================== */}

      <div className="grid gap-8 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
        <div>
          <Tag>
            {course.category} · {course.difficulty}
          </Tag>

          <h1 className="font-display mt-6 text-7xl leading-[.88] md:text-9xl">
            {course.title.toUpperCase()}
          </h1>

          <p className="mt-8 max-w-2xl text-lg leading-8 text-white/55">
            {course.description} Built for practitioners
            who want a clearer path from technical principles
            to live application.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button>
              Start Learning
              <Play
                size={15}
                fill="currentColor"
              />
            </Button>

            <Button variant="outline">
              Save course
            </Button>
          </div>
        </div>

        {/* Course Image */}
        <div className="overflow-hidden rounded-3xl border border-white/10">
          <div className="relative aspect-[16/10]">
            <img
              src={course.image}
              alt={course.title}
              className="h-full w-full object-cover"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />

            <div className="absolute bottom-5 left-5 flex items-center gap-2 text-xs text-white/60">
              <Clock3 size={14} />
              {course.duration}

              <span className="mx-1">
                ·
              </span>

              {course.lessons} lessons
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================
          COURSE CONTENT
      ====================================================== */}

      <div className="mt-16 grid gap-10 lg:grid-cols-[1fr_340px]">
        <div>
          {/* Learning Stages */}
          <div className="grid gap-3 md:grid-cols-3">
            {learningStages.map((stage) => (
              <div
                key={stage.title}
                className="rounded-2xl border border-white/10 p-5"
              >
                <div className="text-[10px] tracking-[.2em] text-white/35">
                  {stage.title}
                </div>

                <p className="mt-2 text-sm text-white/55">
                  {stage.description}
                </p>
              </div>
            ))}
          </div>

          {/* Curriculum */}
          <div className="mt-12 border-t border-white/10 pt-10">
            <h2 className="text-2xl font-semibold">
              Curriculum
            </h2>

            <div className="mt-5 space-y-3">
              {modules.map((module, index) => (
                <div
                  key={module}
                  className="rounded-2xl border border-white/10 bg-white/[.02] p-5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-[.18em] text-white/30">
                        Module{' '}
                        {String(index + 1).padStart(2, '0')}
                      </div>

                      <div className="mt-1 font-semibold">
                        {module}
                      </div>
                    </div>

                    <ChevronRight
                      className="text-white/30"
                      size={18}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Requirements */}
        <aside className="h-fit rounded-2xl border border-white/10 bg-white/[.03] p-6">
          <div className="text-[10px] uppercase tracking-[.18em] text-white/35">
            What you'll need
          </div>

          <div className="mt-5 space-y-4">
            {requirements.map((requirement) => (
              <div
                key={requirement}
                className="flex items-center gap-3 text-sm text-white/60"
              >
                <CheckCircle2
                  size={16}
                  className="text-[#e11d2e]"
                />

                {requirement}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}

// ============================================================
// SEMINARS
// ============================================================

export function Seminars() {
  const seminarDetails = [
    {
      label: 'Speaker',
      value: 'Sai Zay',
    },
    {
      label: 'Format',
      value: 'Google Meet',
    },
    {
      label: 'Status',
      value: 'Registration open',
    },
  ]

  const pastSessions = [
    'Kumite Preparation 2026',
    'Modern Strength for Fighters',
    'Kata Competition Analysis',
  ]

  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-32 lg:px-8">
      {/* Header */}
      <Tag>EVENTS / LIVE EDUCATION</Tag>

      <h1 className="font-display mt-6 text-7xl leading-none md:text-9xl">
        SEMINARS &
        <br />

        <span className="text-[#e11d2e]">
          SESSIONS.
        </span>
      </h1>

      {/* ======================================================
          UPCOMING SEMINAR
      ====================================================== */}

      <div className="mt-14 grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
        {/* Main Seminar */}
        <div className="rounded-3xl border border-white/10 bg-[#111] p-7 md:p-9">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tag>UPCOMING</Tag>

            <div className="text-sm text-white/40">
              29 SEP 2026
            </div>
          </div>

          <h2 className="mt-9 text-3xl font-semibold md:text-5xl">
            KUMITE PERFORMANCE SEMINAR
          </h2>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/50">
            An online session connecting sport science,
            strength & conditioning and practical kumite
            preparation.
          </p>

          {/* Seminar Details */}
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {seminarDetails.map((detail) => (
              <div
                key={detail.label}
                className="rounded-xl bg-white/[.04] p-4"
              >
                <div className="text-[10px] uppercase tracking-[.18em] text-white/30">
                  {detail.label}
                </div>

                <div className="mt-1 text-sm font-medium">
                  {detail.value}
                </div>
              </div>
            ))}
          </div>

          <Button className="mt-8">
            Register
            <ArrowRight size={15} />
          </Button>
        </div>

        {/* Past Sessions */}
        <div className="rounded-3xl border border-white/10 bg-[#e11d2e] p-8 text-white">
          <div className="text-xs uppercase tracking-[.2em] opacity-60">
            Past sessions
          </div>

          <div className="mt-9 text-7xl font-display">
            12+
          </div>

          <p className="mt-2 text-sm opacity-75">
            Recorded seminars and technical sessions
            available in the library.
          </p>
        </div>
      </div>

      {/* ======================================================
          SEMINAR ARCHIVE
      ====================================================== */}

      <div className="mt-16 border-t border-white/10 pt-8">
        <div className="text-xs uppercase tracking-[.2em] text-white/30">
          Archive
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {pastSessions.map((session, index) => (
            <div
              key={session}
              className="rounded-2xl border border-white/10 p-5"
            >
              <div className="text-[10px] text-white/30">
                {String(index + 1).padStart(2, '0')} · RECORDED
              </div>

              <div className="mt-3 font-medium">
                {session}
              </div>

              <div className="mt-8 text-xs text-white/35">
                Watch replay →
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
