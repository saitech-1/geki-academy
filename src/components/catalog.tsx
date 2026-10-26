"use client";
import { RevealSection } from "./motion";
import { KbzPayCheckout } from "./qr-payments";
import { useState } from "react";
import Link from "next/link";
import type { Course } from "@/lib/types";
import { useData, useAuth } from "./providers";
import { useLocale } from "./locale";
import { PublicNav, Footer, PublicLayout } from "./shell";
import { Button, Icon, Badge, Heading, Loading, Message, Empty } from "./ui";
export function CourseCard({ course }: { course: Course }) {
  const { account } = useAuth();
  const owned =
    !!account &&
    account.purchases.some((p) => p.courseId === course.id && !p.revokedAt);
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
          {lessons.length} {t("lessons ·")}{" "}
          {Math.round(lessons.reduce((n, l) => n + l.video.duration, 0) / 60)}{" "}
          {t("min")}
        </span>
      </div>
      <div className="card-body">
        <div className="eyebrow">{t("KYOKUSHIN · FOUNDATIONS")}</div>
        <h3>{title}</h3>
        <p>
          {language === "mm" && course.descriptionMm
            ? course.descriptionMm
            : course.description}
        </p>
        <div className="card-foot">
          <span>
            {owned
              ? t("Purchased / Start learning")
              : course.priceMinor
                ? new Intl.NumberFormat("en", {
                    style: "currency",
                    currency: course.currency,
                  }).format(course.priceMinor / 100)
                : t("Price to be announced")}
          </span>
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
            {t("THE KYOKUSHIN LEARNING EXPERIENCE")}
          </div>
          <h1 className="reveal delay">
            <span>{t("MASTER THE ART.")}</span>
            <span className="outline">{t("BUILD THE SPIRIT.")}</span>
          </h1>
          <p className="reveal delay">
            {t(
              "Authentic Kyokushin Karate education, guided by experience and powered by modern learning.",
            )}
          </p>
          <div className="row wrap reveal delay">
            <Button href="/courses">
              {t("Start learning")} <Icon name="up" />
            </Button>
            <Button href="/preview" secondary>
              {t("Watch free lesson")} <Icon name="play" />
            </Button>
          </div>
        </div>
        <div className="hero-bottom shell full">
          <span>{t("01 / THE JOURNEY BEGINS")}</span>
          <span>{t("ENGLISH INSTRUCTION · EN / MM SUBTITLES")}</span>
          <a href="#about">{t("SCROLL TO DISCOVER ↓")}</a>
        </div>
      </section>
      <RevealSection className="section shell" id="about">
        <div className="intro">
          <div className="eyebrow">{t("DISCOVER GEKI")}</div>
          <div className="stack">
            <h2>
              {t("More than knowing the movement.")}
              <br />
              <span>{t("Understanding what makes it matter.")}</span>
            </h2>
            <p>
              {t(
                "Detailed visual explanations. A structured learning path. Knowledge you can bring back to your dojo.",
              )}
            </p>
          </div>
        </div>
        <div className="pills-band">
          <span>{t("Spirit.")}</span>
          <span>{t("Science.")}</span>
          <span>↗</span>
          <span>{t("Growth.")}</span>
        </div>
      </RevealSection>
      <RevealSection className="section shell">
        <div className="section-head">
          <div className="stack">
            <div className="eyebrow">{t("YOUR FOUNDATION STARTS HERE")}</div>
            <h2>
              {t("One practice.")}
              <br />
              {t("Many layers of understanding.")}
            </h2>
          </div>
          <Link className="text-link" href="/courses">
            {t("Explore your training")} <Icon name="up" />
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
          <Empty title={t("The academy is preparing its first courses.")}>
            <p>{t("Check back soon for published lessons.")}</p>
          </Empty>
        )}
      </RevealSection>
      <RevealSection className="section shell">
        <div className="feature">
          <div className="feature-photo">
            <img src="/images/kumite.jpg" alt="Kyokushin training reference" />
            <span className="vertical" aria-hidden>
              基本
            </span>
          </div>
          <div className="feature-content">
            <div className="eyebrow">{t("THE SIGNATURE LEARNING JOURNEY")}</div>
            <h2>
              Geki Kihon
              <br />
              {t("Package.")}
            </h2>
            <p>
              {t(
                "A structured path from Kihon to movement, basic Kumite and Kata. Learn the why behind the technique.",
              )}
            </p>
            <div className="feature-steps">
              {["Kihon fundamentals", "Kihon Ido", "Basic Kumite", "Kata"].map(
                (step, i) => (
                  <span key={step}>
                    <b>0{i + 1}</b>
                    {t(step)}
                  </span>
                ),
              )}
            </div>
            <Button href="/courses">
              {t("Explore the academy")} <Icon name="arrow" />
            </Button>
          </div>
        </div>
      </RevealSection>
      <section className="closing">
        <div className="shell">
          <div className="eyebrow">{t("YOUR NEXT CHAPTER")}</div>
          <h2>
            {t("Step onto the mat.")}
            <br />
            {t("With a clearer mind.")}
          </h2>
          <Button href="/courses">
            {t("Explore courses")} <Icon name="up" />
          </Button>
        </div>
      </section>
      <Footer />
    </main>
  );
}
export function Library() {
  const { t } = useLocale();

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
        eyebrow={t("THE GEKI LIBRARY")}
        title={t("Explore your training.")}
        description={t("A deeper understanding starts with a closer look.")}
      />
      <div className="filters">
        <div className="search">
          <Icon name="search" />
          <input
            placeholder={t("Search your training")}
            aria-label={t("Search courses")}
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
              {t(c)}
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
        <Empty title={t("No courses to show yet.")}>
          <p>
            {data?.length
              ? t("Try another search or category.")
              : t(
                  "Courses appear after the GEKI team reviews and publishes them.",
                )}
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
  const ownsCourse =
    !!account &&
    account.purchases.some((p) => p.courseId === course.id && !p.revokedAt);
  const first = course.sections.flatMap((s) => s.lessons)[0];
  return (
    <PublicLayout>
      <div className="eyebrow">
        <Link href="/courses">{t("COURSE LIBRARY")}</Link> / {course.category}
      </div>
      <section className="course-hero">
        <img src={course.thumbnail} alt="Course artwork" />
        <div className="stack">
          <div className="eyebrow">{t("KYOKUSHIN · FOUNDATIONS")}</div>
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
              {course.sections.flatMap((s) => s.lessons).length} {t("lessons")}
            </span>
          </div>
          {first ? (
            <Button
              href={
                ownsCourse ? "/lessons/" + first.id : "/checkout/" + course.slug
              }
            >
              {t(ownsCourse ? t("Start course") : t("Pay course fee"))}
              <Icon name="arrow" />
            </Button>
          ) : null}
          <Badge>{t("One payment / Ongoing course access")}</Badge>
          <p>
            {course.priceMinor
              ? new Intl.NumberFormat("en", {
                  style: "currency",
                  currency: course.currency,
                }).format(course.priceMinor / 100)
              : t("Price to be announced")}
          </p>
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
                    (l.preview && !ownsCourse ? "/preview/" : "/lessons/") +
                    l.id
                  }
                  className="lesson-row"
                >
                  <Icon name={l.preview || ownsCourse ? "play" : "lock"} />
                  <div className="row-copy">
                    <span>{l.title}</span>
                    <small>
                      {Math.round(l.video.duration / 60)} {t("min")}
                    </small>
                  </div>
                  {l.preview ? (
                    <Badge tone="free">{t("Free preview")}</Badge>
                  ) : !ownsCourse ? (
                    <Badge>{t("Locked / Pay course fee")}</Badge>
                  ) : null}
                </Link>
              ))}
            </details>
          ))}
          {course.quiz?.published ? (
            <Button
              href={
                ownsCourse
                  ? "/quizzes/" + course.quiz.id
                  : "/checkout/" + course.slug
              }
            >
              {t("Final course quiz")} <Icon name="quiz" />
            </Button>
          ) : null}
        </div>
        <aside className="panel stack">
          <h3>
            {t("A clear path.")}
            <br />
            {t("Your own pace.")}
          </h3>
          <p>
            {t(
              "Revisit any available lesson. Your progress saves as you watch.",
            )}
          </p>
          <p>
            {t(
              "English instruction, with reviewed English and Burmese subtitle tracks.",
            )}
          </p>
          <Button href="/devices" secondary>
            {t("Device management")}
          </Button>
        </aside>
      </div>
    </PublicLayout>
  );
}
export function CourseCheckout({ slug }: { slug: string }) {
  const { data: course, error } = useData<Course>(
    "/courses/" + encodeURIComponent(slug),
  );
  if (error)
    return (
      <PublicLayout>
        <Message error>{error}</Message>
      </PublicLayout>
    );
  if (!course)
    return (
      <PublicLayout>
        <Loading />
      </PublicLayout>
    );
  return (
    <PublicLayout>
      <KbzPayCheckout course={course} />
    </PublicLayout>
  );
}
