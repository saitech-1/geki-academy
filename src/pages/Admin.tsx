import {
  Plus,
  Search,
  MoreHorizontal,
  TrendingUp,
  Upload,
} from 'lucide-react'

import { Button, Stat, Tag } from '../components/ui'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'

import type { ReactNode } from 'react'

const growth = [
  { m: 'Apr', v: 34 },
  { m: 'May', v: 52 },
  { m: 'Jun', v: 68 },
  { m: 'Jul', v: 84 },
  { m: 'Aug', v: 98 },
  { m: 'Sep', v: 124 },
]

export function AdminOverview() {
  return (
    <div className="p-5 md:p-8">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[.2em] text-black/40">
          Dashboard
        </div>

        <h1 className="mt-3 text-3xl font-semibold">
          Academy Overview
        </h1>
      </div>

      <div className="mt-7 grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {[
          ['Total Students', '1,248'],
          ['Active Students', '984'],
          ['Courses', '18'],
          ['Enrollments', '2,406'],
          ['Completion Rate', '71%'],
          ['Watch Time', '8.4k h'],
        ].map(([a, b]) => (
          <div
            className="rounded-2xl border border-black/8 bg-white p-4"
            key={a}
          >
            <div className="text-[10px] uppercase tracking-[.16em] text-black/35">
              {a}
            </div>

            <div className="mt-2 text-2xl font-semibold">
              {b}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <section className="rounded-2xl border border-black/8 bg-white p-5">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[.18em] text-black/35">
                Registration growth
              </div>

              <h2 className="mt-2 text-xl font-semibold">
                New Students
              </h2>
            </div>

            <TrendingUp size={18} />
          </div>

          <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growth}>
                <XAxis dataKey="m" stroke="#777" fontSize={11} />
                <YAxis stroke="#777" fontSize={11} />
                <Tooltip />

                <Line
                  type="monotone"
                  dataKey="v"
                  stroke="#111"
                  strokeWidth={2.5}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-black/8 bg-white p-5">
          <div className="text-[10px] uppercase tracking-[.18em] text-black/35">
            Popular courses
          </div>

          <div className="mt-5 space-y-4">
            {[
              'Kumite Fundamentals',
              'Tournament Kumite',
              'Modern Strength & Conditioning',
              'Kata Performance',
            ].map((x, i) => (
              <div key={x}>
                <div className="flex justify-between text-sm">
                  <span>{x}</span>

                  <span className="text-black/40">
                    {82 - i * 11}%
                  </span>
                </div>

                <div className="mt-2 h-1.5 bg-black/8">
                  <div
                    className="h-full bg-black"
                    style={{
                      width: `${82 - i * 11}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export function AdminUsers() {
  const rows = [
    [
      'Mika Aung',
      'mika@geki.academy',
      'Student',
      'Intermediate',
      '12',
      'Active',
    ],
    [
      'Ko Lin',
      'ko@geki.academy',
      'Coach',
      'Advanced',
      '18',
      'Active',
    ],
    [
      'Nandar',
      'nandar@geki.academy',
      'Instructor',
      'Competitive',
      '21',
      'Active',
    ],
    [
      'Aung Htet',
      'aung@geki.academy',
      'Student',
      'Beginner',
      '3',
      'Suspended',
    ],
  ]

  return (
    <AdminTablePage
      title="Users"
      action="New User"
      search={true}
    >
      <div className="mt-5 overflow-hidden rounded-2xl border border-black/8 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/8 text-[10px] uppercase tracking-[.14em] text-black/35">
            <tr>
              {[
                'User',
                'Email',
                'Role',
                'Experience',
                'Courses',
                'Status',
                '',
              ].map((h) => (
                <th className="px-4 py-4" key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr
                className="border-b border-black/6 last:border-0"
                key={r[1]}
              >
                {r.map((c, i) => (
                  <td className="px-4 py-4" key={i}>
                    {i === 5 ? (
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] ${
                          c === 'Active'
                            ? 'bg-black text-white'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {c}
                      </span>
                    ) : (
                      c
                    )}
                  </td>
                ))}

                <td className="px-4">
                  <MoreHorizontal size={17} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminTablePage>
  )
}

export function AdminCourses() {
  return (
    <AdminTablePage
      title="Courses"
      action="New Course"
    >
      <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[
          ['Kumite Fundamentals', '18 lessons', 'Published'],
          ['Tournament Kumite', '24 lessons', 'Draft'],
          ['Kyokushin Kihon System', '21 lessons', 'Published'],
          [
            'Modern Strength & Conditioning',
            '16 lessons',
            'Published',
          ],
          ['Kata Performance', '14 lessons', 'Archived'],
          [
            'Sports Science for Martial Artists',
            '20 lessons',
            'Published',
          ],
        ].map(([a, b, c]) => (
          <div
            key={a}
            className="rounded-2xl border border-black/8 bg-white p-5"
          >
            <div className="flex items-start justify-between">
              <Tag>{c}</Tag>
              <MoreHorizontal size={17} />
            </div>

            <h3 className="mt-5 text-lg font-semibold">
              {a}
            </h3>

            <p className="mt-1 text-xs text-black/40">
              GEKI Team · {b}
            </p>

            <div className="mt-7 flex gap-2">
              <button className="rounded-full border border-black/10 px-3 py-2 text-xs">
                Edit
              </button>

              <button className="rounded-full border border-black/10 px-3 py-2 text-xs">
                Duplicate
              </button>
            </div>
          </div>
        ))}
      </div>
    </AdminTablePage>
  )
}

export function AdminBuilder() {
  return (
    <div className="p-5 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[.2em] text-black/35">
            Course Builder
          </div>

          <h1 className="mt-2 text-3xl font-semibold">
            Kumite Fundamentals
          </h1>
        </div>

        <div className="flex gap-2">
          <button className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm">
            Preview
          </button>

          <Button>Publish</Button>
        </div>
      </div>

      <div className="mt-7 grid min-h-[650px] gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-2xl border border-black/8 bg-white p-4">
          <div className="text-[10px] uppercase tracking-[.18em] text-black/35">
            Course structure
          </div>

          <div className="mt-4 rounded-xl bg-black p-3 text-sm text-white">
            Kumite Fundamentals
          </div>

          {[
            'Foundation',
            'Movement',
            'Technical Development',
            'Application',
            'Performance',
          ].map((m, i) => (
            <div key={m} className="mt-4">
              <div className="px-2 text-[10px] font-semibold uppercase tracking-[.16em] text-black/35">
                Module 0{i + 1}
              </div>

              <div className="mt-2 space-y-1">
                {['Distance', 'Timing', 'Footwork']
                  .slice(0, i === 4 ? 3 : 2)
                  .map((x) => (
                    <div
                      className="rounded-lg px-3 py-2 text-xs text-black/60 hover:bg-black/5"
                      key={x}
                    >
                      Lesson · {x}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </aside>

        <section className="rounded-2xl border border-black/8 bg-white p-6">
          <div className="flex items-center justify-between border-b border-black/8 pb-5">
            <div>
              <div className="text-[10px] uppercase tracking-[.18em] text-black/35">
                Lesson editor
              </div>

              <h2 className="mt-2 text-xl font-semibold">
                Footwork & Angles
              </h2>
            </div>

            <Tag>17:05</Tag>
          </div>

          <div className="mt-7 grid gap-5">
            <label className="text-sm font-medium">
              Lesson title

              <input
                value="Footwork & Angles"
                readOnly
                className="mt-2 w-full rounded-xl border border-black/10 bg-[#f8f8f6] px-4 py-3 outline-none"
              />
            </label>

            <label className="text-sm font-medium">
              Description

              <textarea
                value="Build the movement patterns that let you enter, exit and create productive angles."
                readOnly
                rows={5}
                className="mt-2 w-full rounded-xl border border-black/10 bg-[#f8f8f6] px-4 py-3 outline-none"
              />
            </label>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="rounded-xl border border-dashed border-black/15 p-6">
                <Upload size={18} />

                <div className="mt-3 text-sm font-medium">
                  Video
                </div>

                <div className="mt-1 text-xs text-black/40">
                  Drag file or paste video URL
                </div>
              </div>

              <div className="rounded-xl border border-black/10 p-6">
                <div className="text-sm font-medium">
                  Learning objectives
                </div>

                {[
                  'Understand angle creation',
                  'Connect steps to attacks',
                  'Maintain posture',
                ].map((x) => (
                  <div
                    key={x}
                    className="mt-3 flex items-center gap-2 text-xs text-black/55"
                  >
                    <div className="size-1.5 rounded-full bg-black" />
                    {x}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button className="rounded-full border border-black/10 px-4 py-2 text-sm">
              Save Draft
            </button>

            <button className="rounded-full bg-black px-4 py-2 text-sm text-white">
              Publish
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

export function AdminAnalytics() {
  return (
    <div className="p-5 md:p-8">
      <div className="text-[10px] uppercase tracking-[.2em] text-black/35">
        Analytics
      </div>

      <h1 className="mt-2 text-3xl font-semibold">
        Performance signals
      </h1>

      <div className="mt-7 grid gap-4 md:grid-cols-4">
        <Stat label="Active Students" value="984" />
        <Stat label="New Students" value="124" />
        <Stat label="Completion" value="71%" />
        <Stat label="Watch Time" value="8.4k h" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-black/8 bg-white p-5">
          <div className="text-xs font-semibold">
            Registration Growth
          </div>

          <div className="mt-5 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={growth}>
                <XAxis dataKey="m" />
                <YAxis />
                <Tooltip />

                <Bar
                  dataKey="v"
                  fill="#111"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-black/8 bg-white p-5">
          <div className="text-xs font-semibold">
            Operational focus
          </div>

          <div className="mt-5 space-y-3">
            {[
              [
                'Lesson completion',
                'Increase completion on module 02',
              ],
              [
                'Average watch time',
                'Identify high-drop-off videos',
              ],
              [
                'Popular courses',
                'Refresh top 3 entry points',
              ],
            ].map(([a, b]) => (
              <div
                className="rounded-xl bg-[#f6f6f3] p-4"
                key={a}
              >
                <div className="font-medium">{a}</div>

                <div className="mt-1 text-xs text-black/45">
                  {b}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function AdminTablePage({
  title,
  action,
  search = false,
  children,
}: {
  title: string
  action: string
  search?: boolean
  children: ReactNode
}) {
  return (
    <div className="p-5 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[.2em] text-black/35">
            Management
          </div>

          <h1 className="mt-2 text-3xl font-semibold">
            {title}
          </h1>
        </div>

        <Button>
          <Plus size={15} />
          {action}
        </Button>
      </div>

      {search && (
        <div className="mt-5 flex max-w-sm items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-3">
          <Search size={16} />

          <input
            className="w-full outline-none"
            placeholder="Search users..."
          />
        </div>
      )}

      {children}
    </div>
  )
}

export function AdminSimple({ title }: { title: string }) {
  return (
    <div className="p-5 md:p-8">
      <div className="text-[10px] uppercase tracking-[.2em] text-black/35">
        Admin
      </div>

      <h1 className="mt-2 text-3xl font-semibold">
        {title}
      </h1>

      <div className="mt-7 rounded-2xl border border-black/8 bg-white p-8 text-black/45">
        Production-ready shell for {title.toLowerCase()}.
        Connect your API layer to populate records and permissions.
      </div>
    </div>
  )
}

