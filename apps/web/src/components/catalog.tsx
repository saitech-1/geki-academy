"use client";
import { useState } from "react";
import Link from "next/link";
import type { Course } from "@/lib/types";
import { useData, useAuth } from "./providers";
import { useLocale } from "./locale";
import { PublicNav, Footer, PublicLayout } from "./shell";
import { Button, Icon, Badge, Heading, Loading, Message, Empty } from "./ui";
export function CourseCard({ course }: { course: Course }) {
  const { language, t } = useLocale();
  const title =
    language === "mm" && course.titleMm ? course.titleMm : course.title;
  const lessons = course.sections.flatMap((s) => s.lessons);
  return (
    <Link className="course-card" href={"/courses/" + course.slug}>
      <div className="card-image">
        <img src={course.thumbnail} alt="Course artwork" />
        <Badge>{course.category}</Badge>
        <span className="duration">
          {lessons.length} lessons ·{" "}
          {Math.round(lessons.reduce((n, l) => n + l.video.duration, 0) / 60)}{" "}
          min
        </span>
      </div>
      <div className="card-body">
        <div className="eyebrow">KYOKUSHIN · FOUNDATIONS</div>
        <h3>{title}</h3>
        <p>
          {language === "mm" && course.descriptionMm
            ? course.descriptionMm
            : course.description}
        </p>
        <div className="card-foot">
          <span>{t("Included with membership")}</span>
          <Icon name="up" />
        </div>
      </div>
    </Link>
  );
}
export function Home() {
  const { t } = useLocale();
  const { data, error } = useData<Course[]>("/catalog");
  return (
    <main id="main">
      <section className="hero">
        <img
          className="hero-photo"
          src="/images/hero.jpg"
          alt="Karate practitioner demonstrating a punch"
        />
        <PublicNav />
        <div className="hero-mark" aria-hidden>
          極真
        </div>
        <div className="hero-content shell full">
          <div className="eyebrow light reveal">
            THE KYOKUSHIN LEARNING EXPERIENCE
          </div>
          <h1 className="reveal delay">
            <span>MASTER THE ART.</span>
            <span className="outline">BUILD THE SPIRIT.</span>
          </h1>
          <p className="reveal delay">
            Authentic Kyokushin Karate education, guided by experience and
            powered by modern learning.
          </p>
          <div className="row wrap reveal delay">
            <Button href="/library">
              {t("Start learning")} <Icon name="up" />
            </Button>
            <Button href="/preview" secondary>
              {t("Watch free lesson")} <Icon name="play" />
            </Button>
          </div>
        </div>
        <div className="hero-bottom shell full">
          <span>01 / THE JOURNEY BEGINS</span>
          <span>ENGLISH INSTRUCTION · EN / MM SUBTITLES</span>
          <a href="#about">SCROLL TO DISCOVER ↓</a>
        </div>
      </section>
      <section className="section shell" id="about">
        <div className="intro">
          <div className="eyebrow">DISCOVER GEKI</div>
          <div className="stack">
            <h2>
              More than knowing the movement.
              <br />
              <span>Understanding what makes it matter.</span>
            </h2>
            <p>
              Detailed visual explanations. A structured learning path.
              Knowledge you can bring back to your dojo.
            </p>
          </div>
        </div>
        <div className="pills-band">
          <span>Spirit.</span>
          <span>Science.</span>
          <span>↗</span>
          <span>Growth.</span>
        </div>
      </section>
      <section className="section shell">
        <div className="section-head">
          <div className="stack">
            <div className="eyebrow">YOUR FOUNDATION STARTS HERE</div>
            <h2>
              One practice.
              <br />
              Many layers of understanding.
            </h2>
          </div>
          <Link className="text-link" href="/library">
            Explore your training <Icon name="up" />
          </Link>
        </div>
        {error ? (
          <Message error>{error}</Message>
        ) : data?.length ? (
          <div className="grid-3">
            {data.slice(0, 3).map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        ) : (
          <Empty title="The academy is preparing its first courses.">
            <p>Check back soon for published lessons.</p>
          </Empty>
        )}
      </section>
      <section className="section shell">
        <div className="feature">
          <div className="feature-photo">
            <img src="/images/kumite.jpg" alt="Kyokushin training reference" />
            <span className="vertical" aria-hidden>
              基本
            </span>
          </div>
          <div className="feature-content">
            <div className="eyebrow">THE SIGNATURE LEARNING JOURNEY</div>
            <h2>
              Geki Kihon
              <br />
              Package.
            </h2>
            <p>
              A structured path from Kihon to movement, basic Kumite and Kata.
              Learn the why behind the technique.
            </p>
            <div className="feature-steps">
              {["Kihon fundamentals", "Kihon Ido", "Basic Kumite", "Kata"].map(
                (t, i) => (
                  <span key={t}>
                    <b>0{i + 1}</b>
                    {t}
                  </span>
                ),
              )}
            </div>
            <Button href="/library">
              Explore the academy <Icon name="arrow" />
            </Button>
          </div>
        </div>
      </section>
      <section className="closing">
        <div className="shell">
          <div className="eyebrow">YOUR NEXT CHAPTER</div>
          <h2>
            Step onto the mat.
            <br />
            With a clearer mind.
          </h2>
          <Button href="/pricing">
            Explore membership <Icon name="up" />
          </Button>
        </div>
      </section>
      <Footer />
    </main>
  );
}
export function Library() {
  const { data, error, loading } = useData<Course[]>("/catalog");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const results = data?.filter(
    (c) =>
      (category === "All" || c.category === category) &&
      `${c.title} ${c.titleMm} ${c.description} ${c.descriptionMm}`
        .normalize("NFC")
        .toLowerCase()
        .includes(query.normalize("NFC").toLowerCase()),
  );
  return (
    <PublicLayout>
      <Heading
        eyebrow="THE GEKI LIBRARY"
        title="Explore your training."
        description="A deeper understanding starts with a closer look."
      />
      <div className="filters">
        <div className="search">
          <Icon name="search" />
          <input
            placeholder="Search your training"
            aria-label="Search courses"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="chips">
          {["All", "Kihon", "Kihon Ido", "Basic Kumite", "Kata"].map((c) => (
            <button
              key={c}
              className={`chip ${category === c ? "active" : ""}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <Message error>{error}</Message>
      ) : results?.length ? (
        <div className="grid-3">
          {results.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      ) : (
        <Empty title="No courses to show yet.">
          <p>
            {data?.length
              ? "Try another search or category."
              : "Courses appear after the GEKI team reviews and publishes them."}
          </p>
        </Empty>
      )}
    </PublicLayout>
  );
}
export function CourseDetail({ slug }: { slug: string }) {
  const { language, t } = useLocale();
  const {
    data: course,
    error,
    loading,
  } = useData<Course>("/courses/" + encodeURIComponent(slug));
  const { account } = useAuth();
  if (loading)
    return (
      <PublicLayout>
        <Loading />
      </PublicLayout>
    );
  if (error || !course)
    return (
      <PublicLayout>
        <Message error>{error || "Course not found."}</Message>
      </PublicLayout>
    );
  const first = course.sections.flatMap((s) => s.lessons)[0];
  return (
    <PublicLayout>
      <div className="eyebrow">
        <Link href="/library">COURSE LIBRARY</Link> / {course.category}
      </div>
      <section className="course-hero">
        <img src={course.thumbnail} alt="Course artwork" />
        <div className="stack">
          <div className="eyebrow">KYOKUSHIN · FOUNDATIONS</div>
          <h1>
            {language === "mm" && course.titleMm
              ? course.titleMm
              : course.title}
          </h1>
          <p>
            {language === "mm" && course.descriptionMm
              ? course.descriptionMm
              : course.description}
          </p>
          <div className="metadata">
            <span>{course.instructor}</span>
            <span>
              {course.sections.flatMap((s) => s.lessons).length} lessons
            </span>
          </div>
          {first ? (
            <Button
              href={account?.membership ? "/lessons/" + first.id : "/pricing"}
            >
              {t(account?.membership ? "Start course" : "Explore membership")}
              <Icon name="arrow" />
            </Button>
          ) : null}
          <Badge>{t("All lessons open to active members")}</Badge>
        </div>
      </section>
      <div className="detail-columns">
        <div className="stack">
          <h2 style={{ fontSize: 30 }}>{t("Your course curriculum")}</h2>
          {course.sections.map((s) => (
            <details className="lesson-section" key={s.id} open>
              <summary>
                <span>{s.title}</span>
                <Icon name="down" />
              </summary>
              {s.lessons.map((l) => (
                <Link
                  key={l.id}
                  href={
                    (l.preview && !account?.membership
                      ? "/preview/"
                      : "/lessons/") + l.id
                  }
                  className="lesson-row"
                >
                  <Icon name="play" />
                  <div className="row-copy">
                    <span>{l.title}</span>
                    <small>{Math.round(l.video.duration / 60)} min</small>
                  </div>
                  {l.preview ? (
                    <Badge tone="free">Free preview</Badge>
                  ) : !account?.membership ? (
                    <Badge>Membership</Badge>
                  ) : null}
                </Link>
              ))}
            </details>
          ))}
          {course.quiz?.published ? (
            <Button href={"/quizzes/" + course.quiz.id}>
              Final course quiz <Icon name="quiz" />
            </Button>
          ) : null}
        </div>
        <aside className="panel stack">
          <h3>
            A clear path.
            <br />
            Your own pace.
          </h3>
          <p>Revisit any available lesson. Your progress saves as you watch.</p>
          <p>
            English instruction, with reviewed English and Burmese subtitle
            tracks.
          </p>
          <Button href="/devices" secondary>
            Device management
          </Button>
        </aside>
      </div>
    </PublicLayout>
  );
}
export function Pricing() {
  return (
    <PublicLayout>
      <div className="pricing-head">
        <div className="eyebrow">ONE ACADEMY. ONE MEMBERSHIP.</div>
        <h1>
          Make understanding
          <br />
          part of your practice.
        </h1>
        <p>Both plans include the same full learning access.</p>
      </div>
      <div className="price-grid">
        {["Monthly", "Annual"].map((p, i) => (
          <div className={`price-card ${i ? "annual" : ""}`} key={p}>
            <div className="eyebrow">
              {i ? "A LONGER COMMITMENT" : "START YOUR PRACTICE"}
            </div>
            <h2>{p} membership</h2>
            <div className="price-value">Price to be announced</div>
            <ul className="check-list">
              {[
                "Full video library",
                "All available courses",
                "Saved progress & quizzes",
                "English and Burmese subtitles",
                "Two devices · One active stream",
              ].map((t) => (
                <li key={t}>
                  <Icon name="check" />
                  {t}
                </li>
              ))}
            </ul>
            <Button href="/checkout" secondary={!i}>
              View membership details <Icon name="arrow" />
            </Button>
            <small>{p} access duration. Renewal method to be confirmed.</small>
          </div>
        ))}
      </div>
      <Message>
        Local payment methods and prices are not configured yet. No automatic
        billing is implied.
      </Message>
    </PublicLayout>
  );
}
