"use client";
import { useState, useEffect, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Course, Video, Student, Question } from "@/lib/types";
import { api, json, uploadVideo, videoDuration } from "@/lib/api";
import { useAuth, useData } from "./providers";
import { ProtectedUpload } from "./protected-upload";
import {
  Heading,
  Button,
  Icon,
  Badge,
  Loading,
  Message,
  Empty,
  Modal,
} from "./ui";
function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length ? <Empty title="No records yet." /> : null}
    </div>
  );
}
export function AdminOverview() {
  const { account } = useAuth();
  const { data, error, loading } = useData<{
    students: number;
    activePurchasers: number;
    videos: number;
    courses: number;
    queue: number;
    mediaMode: string;
  }>(account && account.role !== "STUDENT" ? "/admin/overview" : null);
  return (
    <>
      <Heading
        eyebrow="ADMIN WORKSPACE"
        title="Keep the academy moving."
        description="Live data from your GEKI database."
        action={
          <Button href="/admin/videos">
            <Icon name="upload" />
            Manage media
          </Button>
        }
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <Message error>{error}</Message>
      ) : data ? (
        <>
          <div className="grid-4">
            {[
              ["Registered learners", data.students],
              ["Learners with purchases", data.activePurchasers],
              ["Published courses", data.courses],
              ["Video records", data.videos],
            ].map(([label, value]) => (
              <div className="metric" key={label}>
                <span className="metric-label">{label}</span>
                <b>{value}</b>
              </div>
            ))}
          </div>
          <div className="admin-columns">
            <div className="panel stack">
              <h3>Content readiness</h3>
              <p>{data.queue} videos need processing or subtitle review.</p>
              <Button href="/admin/videos" secondary>
                Review media
              </Button>
            </div>
            <div className="panel stack">
              <h3>Service configuration</h3>
              <p>Media mode: {data.mediaMode}</p>
              <Message>
                KBZPay QR payments require manual verification. Purchases are
                audited admin actions.
              </Message>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
export function AdminCourses() {
  const { account } = useAuth();
  const { data, error, loading, reload } = useData<Course[]>(
    account && account.role !== "STUDENT" ? "/admin/courses" : null,
  );
  const [create, setCreate] = useState(false);
  const [failure, setFailure] = useState("");
  const [deleting, setDeleting] = useState<Course | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFailure("");
    const f = new FormData(e.currentTarget);
    try {
      const c = await api<Course>("/admin/courses", {
        method: "POST",
        body: json({
          title: f.get("title"),
          description: f.get("description"),
        }),
      });
      router.push("/admin/courses/" + c.id);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Unable to create course.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="CONTENT MANAGEMENT"
        title="Build a clear learning path."
        action={
          <Button onClick={() => setCreate(true)}>
            <Icon name="plus" />
            Create course
          </Button>
        }
      />
      <label className="search">
        <Icon name="search" />
        <input
          aria-label="Search admin courses"
          placeholder="Search courses"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {failure && !create ? <Message error>{failure}</Message> : null}
      {loading ? (
        <Loading />
      ) : error ? (
        <Message error>{error}</Message>
      ) : (
        <Table
          headers={["Course", "Status", "Lessons", "Actions"]}
          rows={
            data
              ?.filter((c) =>
                c.title.toLowerCase().includes(query.toLowerCase()),
              )
              .map((c) => [
                c.title,
                <Badge key="s" tone={c.status === "PUBLISHED" ? "green" : ""}>
                  {c.status}
                </Badge>,
                c.sections.flatMap((s) => s.lessons).length,
                <div className="admin-actions" key="actions">
                  <Link
                    key="e"
                    className="text-link"
                    href={"/admin/courses/" + c.id}
                  >
                    Edit course →
                  </Link>
                  <button
                    className="text-link danger-link"
                    onClick={() => setDeleting(c)}
                  >
                    Delete
                  </button>
                </div>,
              ]) || []
          }
        />
      )}
      {create ? (
        <Modal title="Create course" onClose={() => setCreate(false)}>
          <form className="stack" onSubmit={submit}>
            <label>
              Course title
              <input name="title" required minLength={3} />
            </label>
            <label>
              Description
              <textarea name="description" required />
            </label>
            {failure ? <Message error>{failure}</Message> : null}
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create draft"}
            </Button>
          </form>
        </Modal>
      ) : null}
      {deleting ? (
        <ReasonModal
          title="Delete this course?"
          description={`Delete “${deleting.title}” and its sections, lessons and quiz. Source videos remain in the media library. Courses with student quiz history must be unpublished instead.`}
          confirmLabel="Delete course"
          onClose={() => setDeleting(null)}
          onConfirm={async (reason) => {
            await api("/admin/courses/" + deleting.id, {
              method: "DELETE",
              body: json({ reason }),
            });
            setDeleting(null);
            reload();
          }}
        />
      ) : null}
    </>
  );
}
export function CourseEditor({ courseId }: { courseId: string }) {
  const { account } = useAuth();
  const allowed = account && account.role !== "STUDENT";
  const {
    data: courses,
    error,
    loading,
    reload,
  } = useData<Course[]>(allowed ? "/admin/courses" : null);
  const { data: videos } = useData<Video[]>(allowed ? "/admin/videos" : null);
  const c = courses?.find((c) => c.id === courseId);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const [addTo, setAddTo] = useState<string | null>(null);
  const [publish, setPublish] = useState(false);
  const [editingSection, setEditingSection] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [editingLesson, setEditingLesson] = useState<{
    id: string;
    title: string;
    description: string;
    preview: boolean;
  } | null>(null);
  const [remove, setRemove] = useState<{ path: string; label: string } | null>(
    null,
  );
  const [unpublish, setUnpublish] = useState(false);
  async function mutate(path: string, body: unknown, method = "POST") {
    setFailure("");
    setMessage("");
    try {
      await api(path, { method, body: json(body) });
      reload();
      setMessage("Saved to the database.");
      return true;
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Save failed.");
      return false;
    }
  }
  if (loading) return <Loading />;
  if (error || !c)
    return <Message error>{error || "Course not found."}</Message>;
  return (
    <>
      <Heading
        eyebrow="COURSE EDITOR"
        title={c.title}
        action={
          <div className="admin-actions">
            {c.status === "PUBLISHED" ? (
              <Button secondary onClick={() => setUnpublish(true)}>
                Unpublish
              </Button>
            ) : null}
            <Button onClick={() => setPublish(true)}>
              Publish course <Icon name="up" />
            </Button>
          </div>
        }
      />
      {message ? <Message>{message}</Message> : null}
      {failure ? <Message error>{failure}</Message> : null}
      <div className="editor-grid">
        <div className="stack">
          <form
            key={c.updatedAt}
            className="panel stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void mutate(
                "/admin/courses/" + c.id,
                {
                  title: f.get("title"),
                  titleMm: f.get("titleMm"),
                  description: f.get("description"),
                  descriptionMm: f.get("descriptionMm"),
                  instructor: f.get("instructor"),
                  category: f.get("category"),
                  thumbnail: f.get("thumbnail"),
                  priceMinor: f.get("price")
                    ? Math.round(Number(f.get("price")) * 100)
                    : null,
                  currency: f.get("currency"),
                  kbzPayEnabled: f.get("kbzPayEnabled") === "on",
                },
                "PATCH",
              );
            }}
          >
            <h3>Course details</h3>
            <label className="consent">
              <input
                name="kbzPayEnabled"
                type="checkbox"
                defaultChecked={c.kbzPayEnabled}
              />
              <span>
                Enable KBZPay QR checkout (MMK only, admin verification
                required)
              </span>
            </label>
            <label>
              Course price
              <input
                name="price"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={c.priceMinor ? c.priceMinor / 100 : ""}
              />
            </label>
            <label>
              Currency
              <select name="currency" defaultValue={c.currency}>
                <option>MMK</option>
                <option>USD</option>
              </select>
            </label>
            <small>
              One-time purchase with ongoing course access. Leave price blank
              until approved.
            </small>
            <label>
              English title
              <input name="title" defaultValue={c.title} required />
            </label>
            <label>
              Burmese title
              <input name="titleMm" defaultValue={c.titleMm} />
            </label>
            <label>
              English description
              <textarea name="description" defaultValue={c.description} />
            </label>
            <label>
              Burmese description
              <textarea
                className="myanmar"
                name="descriptionMm"
                defaultValue={c.descriptionMm}
              />
            </label>
            <label>
              Instructor credit
              <input name="instructor" defaultValue={c.instructor} />
            </label>
            <label>
              Category
              <select
                name="category"
                aria-label="Course category"
                defaultValue={c.category}
              >
                {["Kihon", "Kihon Ido", "Basic Kumite", "Kata"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Course thumbnail URL
              <input
                name="thumbnail"
                defaultValue={c.thumbnail}
                required
                placeholder="https://…"
              />
            </label>
            <Button type="submit" secondary>
              Save course
            </Button>
          </form>
          <form
            className="panel row wrap"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void mutate("/admin/courses/" + c.id + "/sections", {
                title: f.get("title"),
              });
            }}
          >
            <label style={{ flex: 1 }}>
              New section
              <input name="title" required minLength={2} />
            </label>
            <Button type="submit">Add section</Button>
          </form>
          {c.sections.map((s) => (
            <div className="editor-section" key={s.id}>
              <header>
                <span>{s.title}</span>
                <div className="admin-actions">
                  <button
                    className="text-link"
                    onClick={() => setEditingSection(s)}
                  >
                    Rename
                  </button>
                  <button
                    className="text-link danger-link"
                    onClick={() =>
                      setRemove({
                        path: "/admin/sections/" + s.id,
                        label: "section",
                      })
                    }
                  >
                    Delete section
                  </button>
                  <button
                    onClick={() => setAddTo(s.id)}
                    aria-label={"Add lesson to " + s.title}
                  >
                    <Icon name="plus" />
                  </button>
                </div>
              </header>
              {s.lessons.map((l, i) => (
                <div className="editor-lesson" key={l.id}>
                  <span style={{ flex: 1 }}>{l.title}</span>
                  <button
                    className="text-link"
                    onClick={() => setEditingLesson(l)}
                  >
                    Edit lesson
                  </button>
                  <button
                    className="text-link danger-link"
                    onClick={() =>
                      setRemove({
                        path: "/admin/lessons/" + l.id,
                        label: "lesson",
                      })
                    }
                  >
                    Remove
                  </button>
                  {l.preview ? <Badge tone="free">Preview</Badge> : null}
                  <Button
                    secondary
                    disabled={i === s.lessons.length - 1}
                    onClick={() => {
                      const ids = s.lessons.map((l) => l.id);
                      [ids[i], ids[i + 1]] = [ids[i + 1]!, ids[i]!];
                      void mutate("/admin/sections/" + s.id + "/reorder", {
                        ids,
                      });
                    }}
                  >
                    ↓
                  </Button>
                  <button
                    className="text-link"
                    onClick={() =>
                      void mutate(
                        "/admin/lessons/" + l.id,
                        {
                          title: l.title,
                          description: l.description,
                          preview: !l.preview,
                        },
                        "PATCH",
                      )
                    }
                  >
                    {l.preview ? "Remove preview" : "Make preview"}
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
        <aside className="side-info">
          <div className="panel stack">
            <h3>Publishing checks</h3>
            <p>
              Every lesson needs a published video with approved English and
              Burmese subtitles.
            </p>
            <Badge>{c.status}</Badge>
            <Button href="/admin/videos" secondary>
              Manage videos
            </Button>
          </div>
          <QuizEditor course={c} onSaved={reload} />
        </aside>
      </div>
      {addTo ? (
        <Modal title="Add reusable video lesson" onClose={() => setAddTo(null)}>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void mutate("/admin/sections/" + addTo + "/lessons", {
                title: f.get("title"),
                videoId: f.get("videoId"),
                preview: f.get("preview") === "on",
              }).then((ok) => {
                if (ok) setAddTo(null);
              });
            }}
          >
            <label>
              Lesson title
              <input name="title" required minLength={2} />
            </label>
            <label>
              Video
              <select name="videoId" required>
                <option value="">Choose video</option>
                {videos?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title} · {v.status}
                  </option>
                ))}
              </select>
            </label>
            <label className="consent">
              <input type="checkbox" name="preview" />
              <span>Free public preview</span>
            </label>
            <Button type="submit">Add lesson</Button>
          </form>
        </Modal>
      ) : null}
      {publish ? (
        <ReasonModal
          title="Publish this course?"
          onClose={() => setPublish(false)}
          onConfirm={async (reason) => {
            if (await mutate("/admin/courses/" + c.id + "/publish", { reason }))
              setPublish(false);
          }}
        />
      ) : null}
      {unpublish ? (
        <ReasonModal
          title="Unpublish course?"
          description="This removes the course from the public library and stops paid lesson access. Student learning records remain saved."
          confirmLabel="Unpublish course"
          onClose={() => setUnpublish(false)}
          onConfirm={async (reason) => {
            await api("/admin/courses/" + c.id + "/unpublish", {
              method: "POST",
              body: json({ reason }),
            });
            setUnpublish(false);
            reload();
          }}
        />
      ) : null}
      {remove ? (
        <ReasonModal
          title={`Delete ${remove.label}?`}
          description="The lesson link will be removed and the course returned to draft. Source videos and watched progress remain saved."
          confirmLabel={`Delete ${remove.label}`}
          onClose={() => setRemove(null)}
          onConfirm={async (reason) => {
            await api(remove.path, {
              method: "DELETE",
              body: json({ reason }),
            });
            setRemove(null);
            reload();
          }}
        />
      ) : null}
      {editingSection ? (
        <Modal title="Rename section" onClose={() => setEditingSection(null)}>
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              const f = new FormData(event.currentTarget);
              void mutate(
                "/admin/sections/" + editingSection.id,
                { title: f.get("title") },
                "PATCH",
              ).then((ok) => {
                if (ok) setEditingSection(null);
              });
            }}
          >
            <label>
              Section title
              <input
                name="title"
                defaultValue={editingSection.title}
                required
                minLength={2}
              />
            </label>
            <Button type="submit">Save section</Button>
            {failure ? <Message error>{failure}</Message> : null}
          </form>
        </Modal>
      ) : null}
      {editingLesson ? (
        <Modal title="Edit lesson" onClose={() => setEditingLesson(null)}>
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              const f = new FormData(event.currentTarget);
              void mutate(
                "/admin/lessons/" + editingLesson.id,
                {
                  title: f.get("title"),
                  description: f.get("description"),
                  preview: f.get("preview") === "on",
                },
                "PATCH",
              ).then((ok) => {
                if (ok) setEditingLesson(null);
              });
            }}
          >
            <label>
              Lesson title
              <input
                name="title"
                defaultValue={editingLesson.title}
                required
                minLength={2}
              />
            </label>
            <label>
              Description
              <textarea
                name="description"
                defaultValue={editingLesson.description}
              />
            </label>
            <label className="consent">
              <input
                name="preview"
                type="checkbox"
                defaultChecked={editingLesson.preview}
              />
              <span>Free public preview</span>
            </label>
            <Button type="submit">Save lesson</Button>
            {failure ? <Message error>{failure}</Message> : null}
          </form>
        </Modal>
      ) : null}
    </>
  );
}
function QuizEditor({
  course,
  onSaved,
}: {
  course: Course;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState<Question[]>(
    course.quiz?.questions || [],
  );
  const [failure, setFailure] = useState("");
  async function save(published: boolean) {
    try {
      await api("/admin/courses/" + course.id + "/quiz", {
        method: "PUT",
        body: json({
          published,
          questions: questions.map((q) => ({
            prompt: q.prompt,
            options: q.options,
            correctIndex: q.correctIndex ?? 0,
            explanation: q.explanation || "",
          })),
        }),
      });
      onSaved();
      setOpen(false);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Unable to save quiz.");
    }
  }
  return (
    <>
      <div className="panel stack">
        <h3>Final quiz</h3>
        <p>80% passing score. Unlimited attempts.</p>
        <Button secondary onClick={() => setOpen(true)}>
          Edit questions
        </Button>
      </div>
      {open ? (
        <Modal title="Course quiz editor" onClose={() => setOpen(false)}>
          <div className="stack">
            {questions.map((q, i) => (
              <div className="panel stack" key={i}>
                <label>
                  Question {i + 1}
                  <textarea
                    value={q.prompt}
                    onChange={(e) =>
                      setQuestions((items) =>
                        items.map((v, j) =>
                          j === i ? { ...v, prompt: e.target.value } : v,
                        ),
                      )
                    }
                  />
                </label>
                {q.options.map((opt, j) => (
                  <label key={j}>
                    Option {String.fromCharCode(65 + j)}
                    <input
                      value={opt}
                      onChange={(e) =>
                        setQuestions((items) =>
                          items.map((v, k) =>
                            k === i
                              ? {
                                  ...v,
                                  options: v.options.map((o, n) =>
                                    n === j ? e.target.value : o,
                                  ),
                                }
                              : v,
                          ),
                        )
                      }
                    />
                  </label>
                ))}
                <label>
                  Correct answer
                  <select
                    value={q.correctIndex ?? 0}
                    onChange={(e) =>
                      setQuestions((items) =>
                        items.map((v, j) =>
                          j === i
                            ? { ...v, correctIndex: Number(e.target.value) }
                            : v,
                        ),
                      )
                    }
                  >
                    {q.options.map((_, j) => (
                      <option key={j} value={j}>
                        Option {String.fromCharCode(65 + j)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Explanation
                  <textarea
                    value={q.explanation || ""}
                    onChange={(e) =>
                      setQuestions((items) =>
                        items.map((v, j) =>
                          j === i ? { ...v, explanation: e.target.value } : v,
                        ),
                      )
                    }
                  />
                </label>
              </div>
            ))}
            <Button
              secondary
              onClick={() =>
                setQuestions((q) => [
                  ...q,
                  {
                    prompt: "",
                    options: ["", "", "", ""],
                    correctIndex: 0,
                    explanation: "",
                  },
                ])
              }
            >
              Add question
            </Button>
            {failure ? <Message error>{failure}</Message> : null}
            <div className="row wrap">
              <Button secondary onClick={() => void save(false)}>
                Save draft
              </Button>
              <Button onClick={() => void save(true)}>Publish quiz</Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
export function AdminVideos() {
  const { account } = useAuth();
  const { data, error, loading, reload } = useData<Video[]>(
    account && account.role !== "STUDENT" ? "/admin/videos" : null,
  );
  const [selected, setSelected] = useState<Video | null>(null);
  const [deleting, setDeleting] = useState<Video | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDuration, setDraftDuration] = useState("");
  const [query, setQuery] = useState("");
  const [create, setCreate] = useState(false);
  const [failure, setFailure] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (selected?.id) {
      const current = data?.find((v) => v.id === selected.id);
      if (current) setSelected(current);
    }
  }, [data, selected?.id]);
  useEffect(() => setPreview(null), [selected?.id]);
  async function createVideo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setFailure("");
    setUploadPercent(null);
    try {
      let v = await api<Video>("/admin/videos", {
        method: "POST",
        body: json({
          title: draftTitle,
          duration: Number(draftDuration),
          ...(f.get("assetId") ? { providerAssetId: f.get("assetId") } : {}),
        }),
      });
      setCreate(false);
      setSelected({ ...v, subtitles: [] });
      if (draftFile) {
        setUploadPercent(0);
        v = await uploadVideo<Video>(
          "/admin/videos/" + v.id + "/upload",
          draftFile,
          setUploadPercent,
          Number(draftDuration),
        );
        setSelected(v);
        setMessage(
          "Source uploaded. Preview it, then review your subtitle tracks.",
        );
      }
      reload();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Unable to create video.");
      reload();
    } finally {
      setBusy(false);
      setUploadPercent(null);
    }
  }
  async function upload(file: File) {
    if (!selected) return;
    setBusy(true);
    setFailure("");
    setUploadPercent(0);
    setPreview(null);
    try {
      const duration = await videoDuration(file);
      const updated = await uploadVideo<Video>(
        "/admin/videos/" + selected.id + "/upload",
        file,
        setUploadPercent,
        duration,
      );
      setSelected(updated);
      setMessage("Video uploaded. Add and approve both subtitle tracks.");
      reload();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      setUploadPercent(null);
    }
  }
  async function subtitle(e: FormEvent<HTMLFormElement>, lang: string) {
    e.preventDefault();
    if (!selected) return;
    const f = new FormData(e.currentTarget);
    setFailure("");
    setBusy(true);
    try {
      await api("/admin/videos/" + selected.id + "/subtitles/" + lang, {
        method: "PUT",
        body: json({
          content: f.get("content"),
          approved: f.get("approved") === "on",
        }),
      });
      setMessage(lang.toUpperCase() + " subtitles saved.");
      reload();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Unable to save subtitles.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="MEDIA LIBRARY"
        title="Every detail, ready to teach."
        action={
          <Button
            onClick={() => {
              setDraftFile(null);
              setDraftTitle("");
              setDraftDuration("");
              setFailure("");
              setCreate(true);
            }}
          >
            <Icon name="plus" />
            Add video
          </Button>
        }
      />
      <label className="search">
        <Icon name="search" />
        <input
          aria-label="Search admin videos"
          placeholder="Search videos"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {loading ? (
        <Loading />
      ) : error ? (
        <Message error>{error}</Message>
      ) : (
        <Table
          headers={["Video", "Duration", "Status", "Subtitles", "Actions"]}
          rows={
            data
              ?.filter((v) =>
                v.title.toLowerCase().includes(query.toLowerCase()),
              )
              .map((v) => [
                v.title,
                Math.round(v.duration / 60) + " min",
                <Badge key="s">{v.status}</Badge>,
                v.subtitles
                  .map((s) => s.language + (s.approved ? " ✓" : " review"))
                  .join(" · "),
                <div className="admin-actions" key="actions">
                  <button
                    key="e"
                    className="text-link"
                    onClick={() => {
                      setSelected(v);
                      setFailure("");
                      setMessage("");
                    }}
                  >
                    Manage →
                  </button>
                  <button
                    className="text-link danger-link"
                    onClick={() => setDeleting(v)}
                  >
                    Delete
                  </button>
                </div>,
              ]) || []
          }
        />
      )}
      {create ? (
        <Modal
          title="Add a video"
          dismissible={!busy}
          onClose={() => {
            if (!busy) setCreate(false);
          }}
        >
          <form className="stack" onSubmit={createVideo}>
            <label className="upload-zone">
              Choose video from your computer
              <input
                type="file"
                accept=".mp4,.webm,video/mp4,video/webm"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  setDraftFile(null);
                  setFailure("");
                  if (file) {
                    setBusy(true);
                    void videoDuration(file)
                      .then((duration) => {
                        setDraftFile(file);
                        setDraftDuration(String(duration));
                        if (!draftTitle)
                          setDraftTitle(file.name.replace(/\.[^.]+$/, ""));
                      })
                      .catch((e) => setFailure(e.message))
                      .finally(() => setBusy(false));
                  }
                }}
              />
              <small>
                MP4 or WebM · up to 500 MB · duration detected automatically
              </small>
            </label>
            <label>
              Title
              <input
                name="title"
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                required
                minLength={2}
              />
            </label>
            <label>
              Duration in seconds
              <input
                name="duration"
                type="number"
                min={1}
                max={21600}
                required
                value={draftDuration}
                onChange={(event) => setDraftDuration(event.target.value)}
              />
            </label>
            <label>
              DRM provider asset ID (optional)
              <input name="assetId" />
            </label>
            <small>
              Upload a private source file now, or create a record for an
              existing protected provider asset.
            </small>
            {failure ? <Message error>{failure}</Message> : null}
            <Button type="submit" disabled={busy}>
              {busy
                ? "Preparing video…"
                : draftFile
                  ? "Create & upload video"
                  : "Create video"}
            </Button>
          </form>
        </Modal>
      ) : null}
      {selected ? (
        <Modal
          title={selected.title}
          dismissible={!busy}
          onClose={() => {
            if (!busy) setSelected(null);
          }}
        >
          <div className="stack">
            {failure ? <Message error>{failure}</Message> : null}
            {message ? <Message>{message}</Message> : null}
            <form
              key={selected.updatedAt}
              className="stack"
              onSubmit={(event) => {
                event.preventDefault();
                const f = new FormData(event.currentTarget);
                setBusy(true);
                setFailure("");
                void api<Video>("/admin/videos/" + selected.id, {
                  method: "PATCH",
                  body: json({
                    title: f.get("title"),
                    duration: Number(f.get("duration")),
                    providerAssetId: String(f.get("assetId") || "") || null,
                  }),
                })
                  .then((updated) => {
                    setSelected(updated);
                    reload();
                    setMessage("Video details saved.");
                  })
                  .catch((e) => setFailure(e.message))
                  .finally(() => setBusy(false));
              }}
            >
              <label>
                Video title
                <input
                  name="title"
                  defaultValue={selected.title}
                  required
                  minLength={2}
                />
              </label>
              <div className="form-grid">
                <label>
                  Duration in seconds
                  <input
                    name="duration"
                    type="number"
                    min={1}
                    max={21600}
                    defaultValue={selected.duration}
                    required
                  />
                </label>
                <label>
                  Protected provider asset ID
                  <input
                    name="assetId"
                    defaultValue={selected.providerAssetId || ""}
                  />
                </label>
              </div>
              <Button type="submit" disabled={busy} secondary>
                Save video details
              </Button>
            </form>
            <div className="row wrap">
              <Badge>{selected.status}</Badge>
              <small>
                {selected._count?.lessons || 0} lesson links ·{" "}
                {selected._count?.progress || 0} learning records
              </small>
            </div>
            <label className="upload-zone">
              {selected.localPath
                ? "Replace source file"
                : "Upload source video"}
              <input
                type="file"
                accept=".mp4,.webm,video/mp4,video/webm"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                }}
              />
            </label>
            {uploadPercent !== null ? (
              <div role="status">
                <p>Uploading source · {uploadPercent}%</p>
                <progress
                  className="upload-progress"
                  max={100}
                  value={uploadPercent}
                />
              </div>
            ) : null}
            <small>
              Your source upload is private and can be previewed by admins. Paid
              student streaming still requires configured protection. Replacing
              footage resets subtitle approval.
            </small>
            {selected.localPath ? (
              <Button
                secondary
                disabled={busy}
                onClick={() => {
                  setFailure("");
                  void api<{ url: string }>(
                    "/admin/videos/" + selected.id + "/preview",
                    { method: "POST" },
                  )
                    .then((result) => setPreview(result.url))
                    .catch((e) => setFailure(e.message));
                }}
              >
                Preview uploaded video
              </Button>
            ) : null}
            {preview ? (
              <video
                className="source-preview"
                src={preview}
                controls
                playsInline
                onError={() =>
                  setFailure(
                    "Preview could not play. Try H.264 MP4 or WebM, or refresh the preview link.",
                  )
                }
              />
            ) : null}
            <ProtectedUpload
              key={selected.id}
              videoId={selected.id}
              hasSource={Boolean(selected.localPath)}
              assetId={selected.providerAssetId}
              onChange={reload}
            />
            {["en", "mm"].map((lang) => (
              <form
                className="panel stack"
                key={selected.id + lang + selected.updatedAt}
                onSubmit={(e) => void subtitle(e, lang)}
              >
                <h4>{lang === "en" ? "English" : "Burmese"} subtitles</h4>
                <small>
                  Add the spoken words on the line below each timestamp. A
                  timeline without text cannot be approved or synced.
                </small>
                <label>
                  WebVTT content
                  <textarea
                    name="content"
                    defaultValue={
                      selected.subtitles.find((s) => s.language === lang)
                        ?.content || "WEBVTT\n\n00:00.000 --> 00:05.000\n"
                    }
                    required
                    rows={6}
                  />
                </label>
                <label className="consent">
                  <input
                    name="approved"
                    type="checkbox"
                    defaultChecked={
                      selected.subtitles.find((s) => s.language === lang)
                        ?.approved || false
                    }
                  />
                  <span>I reviewed timing, meaning and technique names.</span>
                </label>
                <Button type="submit" disabled={busy} secondary>
                  Save track
                </Button>
              </form>
            ))}
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                setFailure("");
                setBusy(true);
                void api("/admin/videos/" + selected.id + "/publish", {
                  method: "POST",
                  body: json({ reason: f.get("reason") }),
                })
                  .then(() => {
                    reload();
                    setSelected(null);
                  })
                  .catch((e) => setFailure(e.message))
                  .finally(() => setBusy(false));
              }}
            >
              <label>
                Publication reason
                <input name="reason" required minLength={8} />
              </label>
              <Button type="submit" disabled={busy}>
                Publish reviewed video
              </Button>
            </form>
            <div className="admin-actions">
              {selected.status === "PUBLISHED" ? (
                <Button
                  secondary
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void api("/admin/videos/" + selected.id + "/unpublish", {
                      method: "POST",
                      body: json({
                        reason: "Administrator removed video from publication",
                      }),
                    })
                      .then(() => {
                        reload();
                        setMessage(
                          "Video unpublished. Source and learning records are saved.",
                        );
                      })
                      .catch((e) => setFailure(e.message))
                      .finally(() => setBusy(false));
                  }}
                >
                  Unpublish video
                </Button>
              ) : null}
              <button
                className="text-link danger-link"
                disabled={busy}
                onClick={() => {
                  setDeleting(selected);
                  setSelected(null);
                }}
              >
                Delete video
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
      {deleting ? (
        <ReasonModal
          title="Delete this video?"
          description={`Permanently delete “${deleting.title}”, its private source file and subtitle tracks. Videos linked to lessons or student progress cannot be deleted; unpublish those instead.`}
          confirmLabel="Delete video"
          onClose={() => setDeleting(null)}
          onConfirm={async (reason) => {
            await api("/admin/videos/" + deleting.id, {
              method: "DELETE",
              body: json({ reason }),
            });
            setDeleting(null);
            reload();
          }}
        />
      ) : null}
    </>
  );
}
export function AdminStudents() {
  const { account } = useAuth();
  const [query, setQuery] = useState("");
  const { data, error, loading, reload } = useData<Student[]>(
    account && account.role !== "STUDENT"
      ? "/admin/students?q=" + encodeURIComponent(query)
      : null,
  );
  const [target, setTarget] = useState<Student | null>(null);
  const [action, setAction] = useState("GRANT");
  const [courseId, setCourseId] = useState("");
  const { data: courseOptions } = useData<Course[]>(
    account && account.role !== "STUDENT" ? "/admin/courses" : null,
  );
  const [role, setRole] = useState("STUDENT");
  const [failure, setFailure] = useState("");
  return (
    <>
      <Heading eyebrow="STUDENT OPERATIONS" title="Support every learner." />
      <div className="filters">
        <div className="search">
          <Icon name="search" />
          <input
            aria-label="Search learners"
            placeholder="Search learner or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <Message error>{error}</Message>
      ) : (
        <Table
          headers={["Learner", "Email", "Account", "Role", "Devices", "Manage"]}
          rows={
            data?.map((s) => [
              s.displayName,
              s.email,
              <Badge key="s" tone={s.suspended ? "red" : "green"}>
                {s.suspended ? "Suspended" : "Active"}
              </Badge>,
              s.role,
              s._count.devices,
              <button
                key="m"
                className="text-link"
                onClick={() => {
                  setTarget(s);
                  setFailure("");
                }}
              >
                Manage →
              </button>,
            ]) || []
          }
        />
      )}
      {target ? (
        <Modal title={target.displayName} onClose={() => setTarget(null)}>
          <div className="stack">
            <p>{target.email}</p>
            <div className="stack sm">
              {target.purchases.map((m) => (
                <small key={m.id}>
                  {m.course.title} · Purchased{" "}
                  {new Date(m.purchasedAt).toLocaleDateString()}{" "}
                  {m.revokedAt ? "· Revoked" : ""} · {m.paymentReference}
                </small>
              ))}
            </div>
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void api("/admin/students/" + target.id + "/action", {
                  method: "POST",
                  body: json({
                    action,
                    reason: f.get("reason"),
                    courseId,
                    ...(action === "GRANT"
                      ? { paymentReference: f.get("paymentReference") }
                      : {}),
                    ...(action === "ROLE" ? { role } : {}),
                  }),
                })
                  .then(() => {
                    setTarget(null);
                    reload();
                  })
                  .catch((e) => setFailure(e.message));
              }}
            >
              <label>
                Administrative action
                <select
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                >
                  <option value="GRANT">Confirm paid course purchase</option>
                  <option value="REVOKE">Revoke course access</option>
                  <option value="RESET_DEVICES">
                    Reset registered devices
                  </option>
                  <option value="SUSPEND">Suspend account</option>
                  <option value="RESTORE">Restore account</option>
                  {account?.role === "SUPER_ADMIN" ? (
                    <option value="ROLE">Assign role</option>
                  ) : null}
                </select>
              </label>
              {["GRANT", "REVOKE"].includes(action) ? (
                <label>
                  Course package
                  <select
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    required
                  >
                    <option value="">Choose a course</option>
                    {courseOptions?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {action === "GRANT" ? (
                <label>
                  Verified payment reference
                  <input
                    name="paymentReference"
                    required
                    minLength={3}
                    maxLength={150}
                  />
                  <small>
                    Confirm only after checking that the course payment was
                    received. Never enter a fabricated reference.
                  </small>
                </label>
              ) : null}
              {action === "ROLE" ? (
                <label>
                  Role
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option>STUDENT</option>
                    <option>ADMIN</option>
                    <option>SUPER_ADMIN</option>
                  </select>
                </label>
              ) : null}
              <label>
                Required reason
                <textarea
                  name="reason"
                  required
                  minLength={8}
                  maxLength={500}
                />
              </label>
              <Message>
                This operation changes real database records and creates an
                audit event.
              </Message>
              {failure ? <Message error>{failure}</Message> : null}
              <Button type="submit">Confirm administrative action</Button>
            </form>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
export function AdminAudit() {
  const { account } = useAuth();
  const { data, error, loading } = useData<
    {
      id: string;
      action: string;
      target: string;
      reason: string;
      createdAt: string;
      actor: { displayName: string };
    }[]
  >(account && account.role !== "STUDENT" ? "/admin/audit" : null);
  return (
    <>
      <Heading
        eyebrow="ACCOUNTABILITY"
        title="Every important change, recorded."
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <Message error>{error}</Message>
      ) : (
        <Table
          headers={["Time", "Actor", "Action", "Target", "Reason"]}
          rows={
            data?.map((a) => [
              new Date(a.createdAt).toLocaleString(),
              a.actor.displayName,
              a.action,
              a.target,
              a.reason,
            ]) || []
          }
        />
      )}
    </>
  );
}
function ReasonModal({
  title,
  onClose,
  onConfirm,
  description = "The server verifies publication readiness and records this operation.",
  confirmLabel = "Confirm publication",
}: {
  title: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  description?: string;
  confirmLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  return (
    <Modal title={title} onClose={onClose} dismissible={!busy}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          setFailure("");
          void onConfirm(String(f.get("reason")))
            .catch((e) =>
              setFailure(e instanceof Error ? e.message : "Operation failed."),
            )
            .finally(() => setBusy(false));
        }}
      >
        <p>{description}</p>
        <label>
          Reason
          <textarea name="reason" required minLength={8} maxLength={500} />
        </label>
        {failure ? <Message error>{failure}</Message> : null}
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : confirmLabel}
        </Button>
      </form>
    </Modal>
  );
}
