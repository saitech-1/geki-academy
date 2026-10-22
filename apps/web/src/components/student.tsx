"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { PendingPayments } from "./qr-payments";
import type {
  Course,
  Dashboard,
  Devices,
  Playback,
  Attempt,
  Question,
} from "@/lib/types";
import { api, json, deviceKey, deviceStorageName, ApiError } from "@/lib/api";
import { useAuth, useData } from "./providers";
import { loadVideoBridge, type VideoControl } from "@/lib/video-player";
import {
  Heading,
  Button,
  Icon,
  Badge,
  Loading,
  Message,
  Empty,
  ProgressBar,
  Modal,
} from "./ui";
const when = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export function DashboardPage({
  learningOnly = false,
}: {
  learningOnly?: boolean;
}) {
  const { account } = useAuth();
  const { data, error, loading } = useData<Dashboard>(
    account ? "/me/dashboard" : null,
  );
  const { data: allCourses } = useData<Course[]>("/catalog");
  const courses = allCourses?.filter((c) =>
    account?.purchases.some((p) => p.courseId === c.id && !p.revokedAt),
  );
  if (loading) return <Loading />;
  if (error) return <Message error>{error}</Message>;
  const latest = data?.progress[0];
  const lesson = latest?.video.lessons[0];
  const total =
    courses?.flatMap((c) => c.sections.flatMap((s) => s.lessons)).length || 0;
  const completed = data?.progress.filter((p) => p.completedAt).length || 0;
  return (
    <>
      <Heading
        eyebrow={learningOnly ? "MY LEARNING" : "YOUR ACADEMY"}
        title={
          learningOnly
            ? "A practice worth returning to."
            : "Your journey to mastery continues."
        }
        description={
          account?.language === "mm"
            ? "သင်ယူမှုကို ဆက်လက်လုပ်ဆောင်ပါ"
            : "Pick up where you left off. Bring one more detail into focus."
        }
      />
      {!account?.onboarded ? (
        <Message>
          Complete your learner profile in{" "}
          <Link href="/settings">Settings</Link>, including adult or
          parent-managed account details.
        </Message>
      ) : null}
      <div className="dashboard-grid">
        <div>
          {lesson ? (
            <div className="continue-card">
              <img src="/images/kumite.jpg" alt="Training reference" />
              <div className="stack">
                <div className="eyebrow light">CONTINUE LEARNING</div>
                <h2>{lesson.title}</h2>
                <p>{lesson.section.course.title}</p>
                <ProgressBar
                  value={
                    latest.video.duration
                      ? (latest.watchedSeconds / latest.video.duration) * 100
                      : 0
                  }
                  label="Lesson watched"
                />
                <div>
                  <Button href={"/lessons/" + lesson.id}>
                    Resume lesson <Icon name="play" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Empty title="Your practice starts here.">
              <p>Explore an available course and open your first lesson.</p>
              <Button href="/courses">
                Explore courses <Icon name="arrow" />
              </Button>
            </Empty>
          )}
          <div className="stats-inline">
            <div>
              <b>
                {completed}
                <span className="muted" style={{ fontSize: 16 }}>
                  {" "}
                  / {total}
                </span>
              </b>
              <small>Lessons completed</small>
            </div>
            <div>
              <b>{data?.attempts.filter((a) => a.passed).length || 0}</b>
              <small>Quiz passes</small>
            </div>
            <div>
              <b>{courses?.length || 0}</b>
              <small>Available courses</small>
            </div>
          </div>
          <div className="block-head">
            <h3>Your learning records</h3>
          </div>
          <div className="mini-list">
            {data?.progress.map((p) => (
              <Link key={p.videoId} href={"/lessons/" + p.video.lessons[0]?.id}>
                <div className="stack sm" style={{ flex: 1 }}>
                  <h4>{p.video.title}</h4>
                  <p>
                    {p.completedAt
                      ? "Completed"
                      : `Resume at ${Math.floor(p.position / 60)}:${String(Math.floor(p.position % 60)).padStart(2, "0")}`}
                  </p>
                </div>
                <Icon name="arrow" />
              </Link>
            ))}
          </div>
        </div>
        <aside className="side-info">
          <div className="panel stack">
            <Badge
              tone={
                account?.purchases.some((p) => !p.revokedAt) ? "green" : "amber"
              }
            >
              {account?.purchases.some((p) => !p.revokedAt)
                ? "Courses purchased"
                : "Explore course packages"}
            </Badge>
            <h3>
              {account?.purchases.some((p) => !p.revokedAt)
                ? "Your academy is open."
                : "Your next chapter."}
            </h3>
            <p>Each course is purchased separately with ongoing access.</p>
            <Button href="/purchases" secondary>
              My purchased courses
            </Button>
          </div>
          <div className="panel stack">
            <h3>Quiz results</h3>
            {data?.attempts.length ? (
              data.attempts.slice(0, 5).map((a) => (
                <div className="row between" key={a.id}>
                  <span>{a.score}%</span>
                  <Badge tone={a.passed ? "green" : "amber"}>
                    {a.passed ? "Passed" : "Try again"}
                  </Badge>
                </div>
              ))
            ) : (
              <p>No attempts yet. Open a course to find its final quiz.</p>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
type LessonInfo = {
  id: string;
  title: string;
  description: string;
  preview: boolean;
  videoId: string;
  duration: number;
  courseId: string;
};
export function LessonPage({
  lessonId,
  publicPreview = false,
}: {
  lessonId?: string;
  publicPreview?: boolean;
}) {
  const { account, loading: authLoading } = useAuth();
  const {
    data: catalog,
    loading: catalogLoading,
    error: catalogError,
  } = useData<Course[]>("/catalog");
  const previewLesson = catalog
    ?.flatMap((c) => c.sections.flatMap((s) => s.lessons))
    .find((l) => l.preview);
  const selected = lessonId || previewLesson?.id;
  const {
    data: lesson,
    error,
    loading,
  } = useData<LessonInfo>(selected ? "/lessons/" + selected : null);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const [transfer, setTransfer] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const protectedVideo = useRef<VideoControl | null>(null);
  const session = useRef<Playback | null>(null);
  const currentCourse = catalog?.find((c) => c.id === lesson?.courseId);
  const canAccessCourse =
    !!account &&
    account.purchases.some(
      (p) => p.courseId === lesson?.courseId && !p.revokedAt,
    );
  const locked = !!lesson && !lesson.preview && !canAccessCourse;
  useEffect(() => {
    setPlayback(null);
    session.current = null;
    setFailure("");
  }, [selected]);
  useEffect(() => {
    if (!playback?.sessionId) return;
    let active = true;
    let sending = false;
    const heartbeat = async (finishedInterval = false) => {
      const el = video.current || protectedVideo.current;
      if (!el || !active) return;
      if (sending || !Number.isFinite(el.currentTime)) return;
      sending = true;
      try {
        await api("/me/playback/" + playback.sessionId + "/heartbeat", {
          method: "POST",
          body: json({
            position: el.currentTime,
            playing: finishedInterval || !el.paused || el.ended,
          }),
        });
      } catch (e) {
        if (active) {
          void el.pause();
          setPlayback(null);
          session.current = null;
          setFailure(e instanceof Error ? e.message : "Playback ended.");
        }
      } finally {
        sending = false;
      }
    };
    const timer = setInterval(() => void heartbeat(), 5000);
    const flush: EventListener = () => {
      void heartbeat(true);
    };
    let bound: VideoControl | null = null;
    const bind = (control: VideoControl) => {
      if (!active) return;
      bound = control;
      control.addEventListener("pause", flush);
      control.addEventListener("ended", flush);
    };
    if (video.current) bind(video.current);
    if (playback.kind === "vdocipher" && frame.current) {
      const target = frame.current;
      void loadVideoBridge()
        .then((sdk) => {
          if (!active) return;
          const control = sdk.getInstance(target).video;
          protectedVideo.current = control;
          const resume: EventListener = () => {
            control.currentTime = playback.position || 0;
            control.removeEventListener("loadedmetadata", resume);
          };
          control.addEventListener("loadedmetadata", resume);
          bind(control);
        })
        .catch((e) => {
          if (active) {
            setPlayback(null);
            setFailure(e.message);
          }
        });
    }
    return () => {
      active = false;
      clearInterval(timer);
      bound?.removeEventListener("pause", flush);
      bound?.removeEventListener("ended", flush);
      protectedVideo.current = null;
    };
  }, [playback]);
  async function start(force = false) {
    if (!selected || locked) return;
    setBusy(true);
    setFailure("");
    try {
      let data: Playback;
      if (canAccessCourse && (!publicPreview || !lesson?.preview)) {
        await api("/me/devices", {
          method: "POST",
          body: json({
            key: deviceKey(),
            label: /Mobile|Android|iPhone/i.test(navigator.userAgent)
              ? "Mobile browser"
              : "Desktop browser",
          }),
        });
        data = await api<Playback>("/me/playback/" + selected, {
          method: "POST",
          body: json({ transfer: force }),
        });
      } else {
        if (!lesson?.preview)
          throw new Error(
            "Purchase this course to unlock its lessons. Your progress remains saved.",
          );
        data = await api<Playback>("/lessons/" + selected + "/preview");
      }
      setPlayback(data);
      session.current = data;
      setTransfer(false);
    } catch (e) {
      if (e instanceof ApiError && e.code === "STREAM_IN_USE")
        setTransfer(true);
      else
        setFailure(
          e instanceof Error ? e.message : "Unable to start playback.",
        );
    } finally {
      setBusy(false);
    }
  }
  if (loading || authLoading || catalogLoading) return <Loading />;
  if (error || catalogError)
    return <Message error>{error || catalogError}</Message>;
  if (!lesson)
    return (
      <Empty title="Your first lesson is being prepared.">
        <p>GEKI will publish the free Kihon video after content review.</p>
        <Button href="/courses">Browse courses</Button>
      </Empty>
    );
  const lessons = currentCourse?.sections.flatMap((s) => s.lessons) || [];
  const index = lessons.findIndex((l) => l.id === selected);
  return (
    <>
      <div className="learn-layout">
        <div>
          <div className="row between" style={{ marginBottom: 18 }}>
            <Link
              className="text-link"
              href={"/courses/" + currentCourse?.slug}
            >
              ← {currentCourse?.title || "Course"}
            </Link>
            {lesson.preview ? <Badge tone="free">Free preview</Badge> : null}
          </div>
          <div className={`video-box ${locked ? "lesson-paywall" : ""}`}>
            {locked ? (
              <>
                <img
                  src={currentCourse?.thumbnail || "/images/hero.jpg"}
                  alt=""
                  aria-hidden="true"
                />
                <section
                  className="lesson-lock-content"
                  aria-label="Locked lesson"
                >
                  <span className="lesson-lock-symbol">
                    <Icon name="lock" />
                  </span>
                  <Badge>COURSE PURCHASE REQUIRED</Badge>
                  <h2>Unlock your next lesson.</h2>
                  <p>
                    Pay the course fee for{" "}
                    <strong>{currentCourse?.title || "this course"}</strong> to
                    access this lesson and the full course.
                  </p>
                  {currentCourse?.priceMinor ? (
                    <strong className="lesson-lock-price">
                      {new Intl.NumberFormat("en", {
                        style: "currency",
                        currency: currentCourse.currency,
                        maximumFractionDigits: 0,
                      }).format(currentCourse.priceMinor / 100)}{" "}
                      <small>one-time payment</small>
                    </strong>
                  ) : null}
                  <div className="row wrap">
                    <Button
                      href={
                        currentCourse
                          ? "/checkout/" + currentCourse.slug
                          : "/courses"
                      }
                    >
                      Pay course fee <Icon name="arrow" />
                    </Button>
                    <Button
                      secondary
                      href={
                        currentCourse
                          ? "/courses/" + currentCourse.slug
                          : "/courses"
                      }
                    >
                      View course
                    </Button>
                  </div>
                  <small>
                    Ongoing course access after payment confirmation. Free
                    previews stay open.
                  </small>
                </section>
              </>
            ) : playback?.kind === "local" ? (
              <video
                ref={video}
                controls
                autoPlay
                playsInline
                controlsList="nodownload"
                src={playback.url}
                onLoadedMetadata={() => {
                  if (video.current)
                    video.current.currentTime = playback.position || 0;
                }}
                onError={() =>
                  setFailure(
                    "The video could not load. Check your connection and try again.",
                  )
                }
                style={{
                  width: "100%",
                  height: "100%",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {playback.subtitles?.map((t) => (
                  <track
                    key={t.language}
                    kind="subtitles"
                    src={t.url}
                    srcLang={t.language === "mm" ? "my" : "en"}
                    label={t.language === "mm" ? "Burmese" : "English"}
                    default={t.language === "en"}
                  />
                ))}
              </video>
            ) : playback?.kind === "vdocipher" ? (
              <iframe
                ref={frame}
                title={lesson.title}
                src={playback.embedUrl}
                allow="encrypted-media; fullscreen"
                allowFullScreen
                style={{
                  width: "100%",
                  height: "100%",
                  border: 0,
                  position: "relative",
                  zIndex: 1,
                }}
              />
            ) : (
              <>
                <img src="/images/hero.jpg" alt="Lesson cover" />
                <button
                  className="play-big"
                  onClick={() => void start()}
                  disabled={busy}
                  aria-label="Start lesson"
                >
                  <Icon name="play" />
                </button>
              </>
            )}
            <div className="player-top" style={{ pointerEvents: "none" }}>
              <span />
              <div className="watermark">
                {playback?.watermark || "GEKI ACADEMY"}
              </div>
            </div>
          </div>
          {failure ? (
            <div className="stack" style={{ marginTop: 20 }}>
              <Message error>{failure}</Message>
              <div className="row wrap">
                <Button onClick={() => void start()} disabled={busy}>
                  Try playback again
                </Button>
                <Button href="/devices" secondary>
                  Manage devices
                </Button>
                <Button href="/purchases" secondary>
                  My Courses
                </Button>
              </div>
            </div>
          ) : null}
          <div className="lesson-detail">
            <div className="eyebrow">
              KYOKUSHIN · {Math.round(lesson.duration / 60)} MIN
            </div>
            <h1>{lesson.title}</h1>
            <p>{lesson.description}</p>
            <div className="panel stack">
              <h4>Bring this into your practice</h4>
              <p>
                Observe carefully. Practice within your ability and follow your
                dojo instructor’s guidance.
              </p>
            </div>
            <div className="next-prev">
              {lessons[index - 1] ? (
                <Button href={"/lessons/" + lessons[index - 1]!.id} secondary>
                  Previous lesson
                </Button>
              ) : (
                <span />
              )}
              {lessons[index + 1] ? (
                <Button href={"/lessons/" + lessons[index + 1]!.id}>
                  Next lesson <Icon name="arrow" />
                </Button>
              ) : currentCourse?.quiz?.published ? (
                <Button href={"/quizzes/" + currentCourse.quiz.id}>
                  Final quiz
                </Button>
              ) : null}
            </div>
          </div>
        </div>
        <aside className="lesson-aside">
          <div className="aside-head">
            <div className="eyebrow">YOUR COURSE</div>
            <h3>{currentCourse?.title}</h3>
            <p style={{ fontSize: 12 }}>
              All lessons open after purchasing this course.
            </p>
          </div>
          {currentCourse?.sections.map((s) => (
            <details key={s.id} open>
              <summary>
                {s.title} <Icon name="down" />
              </summary>
              {s.lessons.map((l) => (
                <Link
                  key={l.id}
                  className={`lesson-row ${l.id === selected ? "current" : ""}`}
                  href={"/lessons/" + l.id}
                >
                  <Icon name={l.preview || canAccessCourse ? "play" : "lock"} />
                  <div className="row-copy">
                    <span>{l.title}</span>
                    <small>
                      {Math.round(l.video.duration / 60)} min{" "}
                      {l.preview
                        ? "· Free preview"
                        : !canAccessCourse
                          ? "· Locked"
                          : ""}
                    </small>
                  </div>
                </Link>
              ))}
            </details>
          ))}
        </aside>
      </div>
      {transfer ? (
        <Modal title="Move playback here?" onClose={() => setTransfer(false)}>
          <p>
            Your other active stream will end. Continue this lesson on the
            current device.
          </p>
          <Button onClick={() => void start(true)} disabled={busy}>
            Transfer playback here
          </Button>
        </Modal>
      ) : null}
    </>
  );
}
export function QuizPage({ quizId }: { quizId: string }) {
  const { account } = useAuth();
  const { data, error, loading } = useData<{
    id: string;
    course: { title: string };
    questions: (Question & { id: string })[];
  }>(account ? "/me/quizzes/" + quizId : null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFailure("");
    try {
      setAttempt(
        await api<Attempt>("/me/quizzes/" + quizId + "/attempts", {
          method: "POST",
          body: json({ answers }),
        }),
      );
    } catch (e) {
      setFailure(
        e instanceof Error ? e.message : "Unable to submit your quiz.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <Loading />;
  if (error) return <Message error>{error}</Message>;
  if (!data)
    return (
      <Message>Purchase this course and sign in to open its quiz.</Message>
    );
  if (attempt)
    return (
      <div className="quiz-wrap">
        <Heading
          eyebrow="ASSESSMENT COMPLETE"
          title={
            attempt.passed
              ? "Your understanding is taking shape."
              : "Another look. A deeper understanding."
          }
        />
        <div className="panel quiz-results">
          <div className="score">{attempt.score}%</div>
          <Badge tone={attempt.passed ? "green" : "amber"}>
            {attempt.passed ? "Passed" : "Try again"}
          </Badge>
          <p style={{ marginTop: 20 }}>
            Passing score: 80% · Unlimited retries
          </p>
          <Button
            secondary
            onClick={() => {
              setAttempt(null);
              setAnswers({});
            }}
          >
            Retry quiz
          </Button>
        </div>
        <div className="stack" style={{ marginTop: 24 }}>
          {attempt.review.map((q, i) => (
            <div className="panel stack" key={i}>
              <h4>{q.prompt}</h4>
              <p>Correct answer: {q.options[q.correctIndex]}</p>
              <p>{q.explanation}</p>
            </div>
          ))}
        </div>
      </div>
    );
  return (
    <div className="quiz-wrap">
      <Heading
        eyebrow="COURSE ASSESSMENT"
        title="Understand. Then apply."
        description={data.course.title}
      />
      <form className="stack" onSubmit={submit}>
        {data.questions.map((q, i) => (
          <section key={q.id} className="panel quiz-panel">
            <div className="eyebrow">
              QUESTION {i + 1} OF {data.questions.length}
            </div>
            <h2>{q.prompt}</h2>
            <div className="answers">
              {q.options.map((option, j) => (
                <label
                  key={j}
                  className={`answer ${answers[q.id] === j ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name={q.id}
                    value={j}
                    required
                    checked={answers[q.id] === j}
                    onChange={() => setAnswers((a) => ({ ...a, [q.id]: j }))}
                    style={{ minHeight: 0, accentColor: "#d71920" }}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </section>
        ))}
        {failure ? <Message error>{failure}</Message> : null}
        <Button
          type="submit"
          disabled={
            busy || Object.keys(answers).length !== data.questions.length
          }
        >
          {busy ? "Grading…" : "Submit quiz"}
          <Icon name="quiz" />
        </Button>
        <small>No timer. Take your time and review before submitting.</small>
      </form>
    </div>
  );
}
export function AccountPage({ route }: { route: string }) {
  const { account, refresh, logout } = useAuth();
  const { data, error, loading, reload } = useData<Dashboard>(
    account ? "/me/dashboard" : null,
  );
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await api("/me/profile", {
        method: "PATCH",
        body: json({
          displayName: f.get("displayName"),
          language: f.get("language"),
          accountType: f.get("accountType"),
          consent: f.get("consent") === "on",
        }),
      });
      await refresh();
      setMessage("Profile saved.");
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Unable to save profile.");
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <Loading />;
  if (error) return <Message error>{error}</Message>;
  if (route === "/notifications")
    return (
      <>
        <Heading
          eyebrow="NOTIFICATIONS"
          title="The updates that matter."
          description="Your account, purchases and learning access."
        />
        <div className="table-wrap">
          {data?.notifications.length ? (
            data.notifications.map((n) => (
              <div
                className={`notification ${!n.readAt ? "unread" : ""}`}
                key={n.id}
              >
                <span className="icon-wrap">
                  <Icon name="bell" />
                </span>
                <div className="stack">
                  <h3>{n.title}</h3>
                  <p>{n.body}</p>
                  <small>{when(n.createdAt)}</small>
                  <Link className="text-link" href={n.href}>
                    View details
                  </Link>
                  {!n.readAt ? (
                    <button
                      className="text-link"
                      onClick={() =>
                        void api("/me/notifications/" + n.id, {
                          method: "PATCH",
                        }).then(reload)
                      }
                    >
                      Mark read
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <Empty title="You’re all caught up." />
          )}
        </div>
      </>
    );
  if (route === "/purchases" || route === "/membership")
    return (
      <>
        <Heading
          eyebrow="MY COURSES"
          title="Your purchased course packages."
          description="One-time purchases. Ongoing access to each course you own."
        />
        <PendingPayments />
        <div className="grid-3">
          {data?.purchases.map((p) => (
            <div className="panel stack" key={p.id}>
              <Badge tone={p.revokedAt ? "red" : "green"}>
                {p.revokedAt ? "Access revoked" : "Purchased"}
              </Badge>
              <h3>{p.course.title}</h3>
              <p>Purchased {when(p.purchasedAt)}</p>
              <small>{p.paymentReference}</small>
              {!p.revokedAt ? (
                <Button href={"/courses/" + p.course.slug}>Open course</Button>
              ) : null}
            </div>
          ))}
        </div>
        {!data?.purchases.length ? (
          <Empty title="No course purchases yet.">
            <Button href="/courses">Explore courses</Button>
          </Empty>
        ) : null}
      </>
    );
  return (
    <>
      <Heading
        eyebrow="ACCOUNT SETTINGS"
        title="Your space. Your preferences."
      />
      {message ? <Message>{message}</Message> : null}
      {failure ? <Message error>{failure}</Message> : null}
      <div className="settings-grid">
        <form className="panel stack" onSubmit={save}>
          <h3>Learner profile</h3>
          <label>
            Learner display name
            <input
              name="displayName"
              defaultValue={account?.displayName}
              required
              minLength={2}
            />
          </label>
          <label>
            Account / guardian email
            <input value={account?.email || ""} readOnly />
          </label>
          <label>
            Language
            <select
              key={account?.language}
              name="language"
              defaultValue={account?.language}
            >
              <option value="en">English</option>
              <option value="mm">မြန်မာ</option>
            </select>
          </label>
          <label>
            Account type
            <select name="accountType" defaultValue={account?.accountType}>
              <option value="ADULT">Myself · Age 18+</option>
              <option value="GUARDIAN">My child · Age 12–17</option>
            </select>
          </label>
          <label className="consent">
            <input type="checkbox" name="consent" required />
            <span>
              I am an adult or the parent/guardian responsible for this
              learner’s account.
            </span>
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </form>
        <div className="stack">
          <div className="panel stack">
            <h3>Security</h3>
            <Button href="/forgot" secondary>
              Reset password
            </Button>
            <Button href="/devices" secondary>
              Registered devices
            </Button>
          </div>
          <div className="panel stack">
            <h3>Account notifications</h3>
            <p>
              Essential verification, recovery and purchase messages are
              retained.
            </p>
            <small>
              Full Burmese interface copy is under editorial review.
            </small>
          </div>
          <Button secondary onClick={() => void logout()}>
            Sign out <Icon name="logout" />
          </Button>
        </div>
      </div>
    </>
  );
}
export function DevicesPage() {
  const { account } = useAuth();
  const { data, error, loading, reload } = useData<Devices>(
    account ? "/me/devices" : null,
  );
  const [remove, setRemove] = useState<string | null>(null);
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  async function revoke() {
    if (!remove) return;
    setBusy(true);
    try {
      await api("/me/devices/" + remove, { method: "DELETE" });
      if (data?.devices.find((d) => d.id === remove)?.current)
        localStorage.removeItem(deviceStorageName());
      setRemove(null);
      reload();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Unable to remove device.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="DEVICE MANAGEMENT"
        title="Your practice, on your devices."
        description="Two registered browsers/devices. One active video stream."
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <Message error>{error}</Message>
      ) : (
        <div className="settings-grid">
          <div className="panel stack">
            <div className="row between">
              <h3>Registered devices</h3>
              <Badge>{data?.devices.length || 0} / 2</Badge>
            </div>
            {data?.devices.map((d) => (
              <div className="device-card" key={d.id}>
                <Icon name="devices" />
                <div className="device-copy">
                  <h4>{d.label}</h4>
                  <p>Last active {when(d.lastSeenAt)}</p>
                </div>
                <button onClick={() => setRemove(d.id)}>Remove</button>
              </div>
            ))}
            {!data?.devices.length ? (
              <p>Devices are registered when you start a paid lesson.</p>
            ) : null}
            <Message>
              {data?.replacementsRemaining ?? 2} replacements available in the
              rolling 30-day window.
            </Message>
          </div>
          <div className="panel stack">
            <h3>One focused stream.</h3>
            <p>
              Starting a lesson on another device offers an explicit playback
              transfer.
            </p>
            <p>
              Browser data resets may require registering again. An
              administrator can help reset devices.
            </p>
          </div>
        </div>
      )}
      {failure ? <Message error>{failure}</Message> : null}
      {remove ? (
        <Modal
          title="Remove registered device?"
          onClose={() => setRemove(null)}
        >
          <p>
            This revokes the device’s access and uses one of your two
            replacements per 30 days.
          </p>
          <Button disabled={busy} onClick={() => void revoke()}>
            Remove device
          </Button>
        </Modal>
      ) : null}
    </>
  );
}
