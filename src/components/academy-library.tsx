"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { AcademyCourse } from "@/lib/types";
import { useAuth, useData } from "./providers";
import { useLocale } from "./locale";
import {
  Badge,
  Button,
  Empty,
  Heading,
  Icon,
  Message,
  ProgressBar,
} from "./ui";

export function useAcademyCourses(scope: "owned" | "catalog") {
  const { account, refresh: refreshAccount } = useAuth();
  const result = useData<AcademyCourse[]>(
    account ? `/me/course-library?scope=${scope}` : null,
  );
  useEffect(() => {
    if (
      result.data?.some(
        (course) =>
          course.learning.hasAccess &&
          !account?.purchases.some(
            (p) => p.courseId === course.id && !p.revokedAt,
          ),
      )
    )
      void refreshAccount().catch(() => {});
  }, [result.data, account, refreshAccount]);
  useEffect(() => {
    if (!account) return;
    const refresh = () => {
      if (document.visibilityState === "visible") result.reload();
    };
    const timer = setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    window.addEventListener("geki:payment-updated", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("geki:payment-updated", refresh);
    };
  }, [account?.id, result.reload]);
  return result;
}

const statuses = {
  LOCKED: "Locked",
  AWAITING_PAYMENT: "Awaiting payment",
  PENDING_PAYMENT: "Pending Payment",
  PAYMENT_REJECTED: "Payment Rejected",
  ENROLLED: "Enrolled",
  COMPLETED: "Completed",
} as const;

export function AcademyCourseCard({ course }: { course: AcademyCourse }) {
  const { language, t } = useLocale();
  const title =
    language === "mm" && course.titleMm ? course.titleMm : course.title;
  const description =
    language === "mm" && course.descriptionMm
      ? course.descriptionMm
      : course.description;
  const { learning } = course;
  const href =
    learning.hasAccess && learning.resumeLessonId
      ? `/lessons/${learning.resumeLessonId}`
      : learning.hasAccess || learning.status === "LOCKED"
        ? `/courses/${course.slug}`
        : `/checkout/${course.slug}`;
  const action = learning.hasAccess
    ? learning.status === "COMPLETED"
      ? "Review course"
      : "Continue Learning"
    : learning.status === "PENDING_PAYMENT"
      ? "View payment status"
      : learning.status === "PAYMENT_REJECTED"
        ? "Review and resubmit"
        : learning.status === "AWAITING_PAYMENT"
          ? "Continue payment"
          : "Explore course";
  return (
    <article className="academy-course-card" data-access={learning.status}>
      <Link
        href={`/courses/${course.slug}`}
        className="academy-course-art"
        aria-label={`${t("Open course")}: ${title}`}
      >
        <img
          src={course.thumbnail}
          alt=""
          loading="lazy"
          onError={(event) => {
            if (!event.currentTarget.src.endsWith("/images/kumite.jpg"))
              event.currentTarget.src = "/images/kumite.jpg";
          }}
        />
        <span className="academy-category">{t(course.category)}</span>
        <span className="academy-art-arrow">
          <Icon name={learning.hasAccess ? "play" : "lock"} />
        </span>
      </Link>
      <div className="academy-course-copy">
        <Badge
          tone={
            learning.hasAccess
              ? "green"
              : learning.status === "PAYMENT_REJECTED"
                ? "red"
                : "amber"
          }
        >
          {t(statuses[learning.status])}
        </Badge>
        <h2>
          <Link href={`/courses/${course.slug}`}>{title}</Link>
        </h2>
        <p className="academy-instructor">{course.instructor}</p>
        <p className="academy-course-description">{description}</p>
        <div className="academy-course-meta">
          <span>
            {learning.totalLessons} {t("lessons")}
          </span>
          <span>
            {Math.ceil(
              course.sections
                .flatMap((s) => s.lessons)
                .reduce((n, l) => n + l.video.duration, 0) / 60,
            )}{" "}
            {t("min")}
          </span>
        </div>
        {learning.hasAccess ? (
          <div className="academy-course-progress">
            <ProgressBar
              value={learning.percent}
              label={t("Course progress")}
            />
            <small>
              {learning.completedLessons} / {learning.totalLessons}{" "}
              {t("Lessons completed")}
            </small>
          </div>
        ) : (
          <p className="academy-access-note">
            {t(
              learning.status === "PENDING_PAYMENT"
                ? "Your receipt is under review. Access starts after approval."
                : learning.status === "PAYMENT_REJECTED"
                  ? "Review the payment feedback before resubmitting. Do not pay twice."
                  : "One payment. Ongoing access to this course.",
            )}
          </p>
        )}
        <Button href={href} secondary={!learning.hasAccess}>
          {t(action)}
          <Icon name="arrow" />
        </Button>
      </div>
    </article>
  );
}

export function AcademyLibrary({
  catalog = false,
  embedded = false,
}: {
  catalog?: boolean;
  embedded?: boolean;
}) {
  const { t } = useLocale();
  const { data, error, loading, reload } = useAcademyCourses(
    catalog ? "catalog" : "owned",
  );
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const categories = ["All", ...new Set(data?.map((c) => c.category) || [])];
  const filtered = data?.filter(
    (c) =>
      (category === "All" || c.category === category) &&
      `${c.title} ${c.titleMm} ${c.description} ${c.descriptionMm} ${c.instructor}`
        .normalize("NFC")
        .toLocaleLowerCase()
        .includes(query.trim().normalize("NFC").toLocaleLowerCase()),
  );
  return (
    <div className="academy-library">
      {!embedded && (
        <Heading
          eyebrow={t(catalog ? "COURSE CATALOG" : "MY COURSE LIBRARY")}
          title={t(
            catalog
              ? "Find your next practice."
              : "Your training. Your progress.",
          )}
          description={t(
            catalog
              ? "Explore published courses. Choose your next step."
              : "Your enrolled courses, ready whenever you are.",
          )}
        />
      )}
      <div className="academy-library-tabs" aria-label={t("Course views")}>
        <Link href="/my-learning" aria-current={!catalog ? "page" : undefined}>
          {t("My Course Library")}
        </Link>
        <Link
          href="/academy/courses"
          aria-current={catalog ? "page" : undefined}
        >
          {t("Course Catalog")}
        </Link>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          aria-label={t("Refresh courses")}
        >
          <Icon name="up" />
          {t("Refresh")}
        </button>
      </div>
      <div className="filters academy-library-filters">
        <div className="search">
          <Icon name="search" />
          <input
            aria-label={t("Search courses")}
            placeholder={t("Search your training")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="chips" aria-label={t("Course category")}>
          {categories.map((c) => (
            <button
              type="button"
              key={c}
              className={`chip ${c === category ? "active" : ""}`}
              aria-pressed={c === category}
              onClick={() => setCategory(c)}
            >
              {t(c)}
            </button>
          ))}
        </div>
      </div>
      {loading && !data ? (
        <div
          className="academy-course-grid"
          role="status"
          aria-label={t("Loading courses")}
          aria-busy="true"
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="academy-course-card academy-course-skeleton"
              aria-hidden="true"
            >
              <div className="skeleton large" />
              <div className="stack">
                <div className="skeleton" />
                <div className="skeleton" />
                <div className="skeleton" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <Empty title={t("Your courses could not be loaded.")}>
          <p>{t("Your purchases and progress are saved. Please try again.")}</p>
          <Button onClick={reload}>{t("Try again")}</Button>
          <Message error>{error}</Message>
        </Empty>
      ) : filtered?.length ? (
        <>
          <p className="academy-result-count" role="status">
            {filtered.length} {t(filtered.length === 1 ? "course" : "courses")}
          </p>
          <div className="academy-course-grid">
            {filtered.map((c) => (
              <AcademyCourseCard key={c.id} course={c} />
            ))}
          </div>
        </>
      ) : (
        <Empty
          title={t(
            data?.length
              ? "No courses match your search."
              : catalog
                ? "No published courses yet."
                : "Your course library starts here.",
          )}
        >
          <p>
            {t(
              data?.length
                ? "Try another search or category."
                : catalog
                  ? "New training will appear here after publication."
                  : "Approved purchases appear here automatically. Pending payments stay in your payment history.",
            )}
          </p>
          {data?.length ? (
            <Button
              secondary
              onClick={() => {
                setQuery("");
                setCategory("All");
              }}
            >
              {t("Clear filters")}
            </Button>
          ) : (
            !catalog && (
              <Button href="/academy/courses">
                {t("Explore courses")}
                <Icon name="arrow" />
              </Button>
            )
          )}
        </Empty>
      )}
    </div>
  );
}
