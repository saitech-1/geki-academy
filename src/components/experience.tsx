"use client";
import { Home, Library, CourseDetail, CourseCheckout } from "./catalog";
import { AuthPage } from "./auth-pages";
import { AppShell, PublicLayout } from "./shell";
import {
  DashboardPage,
  LessonPage,
  QuizPage,
  AccountPage,
  DevicesPage,
} from "./student";
import {
  AdminOverview,
  AdminCourses,
  CourseEditor,
  AdminVideos,
  AdminStudents,
  AdminAudit,
} from "./admin";
import { Button, Empty, Loading } from "./ui";
import { useAuth } from "./providers";
import { AdminPaymentReviews } from "./qr-payments";
export function Experience({ route }: { route: string }) {
  if (route === "/") return <Home />;
  if (
    [
      "/signin",
      "/signup",
      "/verify",
      "/forgot",
      "/reset",
      "/recovery",
    ].includes(route)
  )
    return <AuthPage key={route} route={route} />;
  if (route === "/courses") return <Library />;
  if (route.startsWith("/courses/"))
    return <CourseDetail key={route} slug={route.split("/")[2]!} />;
  if (route === "/preview" || route.startsWith("/preview/"))
    return (
      <PublicLayout>
        <LessonPage publicPreview lessonId={route.split("/")[2]} />
      </PublicLayout>
    );
  if (route.startsWith("/lessons/"))
    return <LessonRoute lessonId={route.split("/")[2]!} route={route} />;
  if (route.startsWith("/quizzes/"))
    return (
      <AppShell route={route}>
        <QuizPage key={route} quizId={route.split("/")[2]!} />
      </AppShell>
    );
  if (route.startsWith("/checkout/"))
    return <CourseCheckout slug={route.split("/")[2]!} />;
  if (route === "/dashboard" || route === "/my-learning")
    return (
      <AppShell route={route}>
        <DashboardPage learningOnly={route === "/my-learning"} />
      </AppShell>
    );
  if (
    ["/settings", "/membership", "/purchases", "/notifications"].includes(route)
  )
    return (
      <AppShell route={route}>
        <AccountPage key={route} route={route} />
      </AppShell>
    );
  if (route === "/devices")
    return (
      <AppShell route={route}>
        <DevicesPage />
      </AppShell>
    );
  if (route.startsWith("/admin")) {
    const body =
      route === "/admin" ? (
        <AdminOverview />
      ) : route === "/admin/courses" ? (
        <AdminCourses />
      ) : route.startsWith("/admin/courses/") ? (
        <CourseEditor courseId={route.split("/")[3]!} />
      ) : route === "/admin/videos" ? (
        <AdminVideos />
      ) : route === "/admin/payments" ? (
        <AdminPaymentReviews />
      ) : route === "/admin/students" ? (
        <AdminStudents />
      ) : route === "/admin/audit" ? (
        <AdminAudit />
      ) : (
        <Empty title="Page not found." />
      );
    return (
      <AppShell route={route} admin>
        {body}
      </AppShell>
    );
  }
  return (
    <PublicLayout>
      <Empty title="This page could not be found.">
        <Button href="/">Return home</Button>
      </Empty>
    </PublicLayout>
  );
}

function LessonRoute({ lessonId, route }: { lessonId: string; route: string }) {
  const { account, loading } = useAuth();
  if (loading)
    return (
      <PublicLayout>
        <Loading />
      </PublicLayout>
    );
  const lesson = <LessonPage key={route} lessonId={lessonId} />;
  return account ? (
    <AppShell route={route}>{lesson}</AppShell>
  ) : (
    <PublicLayout>{lesson}</PublicLayout>
  );
}
