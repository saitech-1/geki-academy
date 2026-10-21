"use client";
import {
  Home,
  Library,
  CourseDetail,
  Pricing,
  CourseCheckout,
} from "./catalog";
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
import { Heading, Button, Message, Empty } from "./ui";
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
  if (route === "/library") return <Library />;
  if (route === "/pricing") return <Pricing />;
  if (route.startsWith("/courses/"))
    return <CourseDetail key={route} slug={route.split("/")[2]!} />;
  if (route === "/preview" || route.startsWith("/preview/"))
    return (
      <PublicLayout>
        <LessonPage publicPreview lessonId={route.split("/")[2]} />
      </PublicLayout>
    );
  if (route.startsWith("/lessons/"))
    return (
      <AppShell route={route}>
        <LessonPage key={route} lessonId={route.split("/")[2]!} />
      </AppShell>
    );
  if (route.startsWith("/quizzes/"))
    return (
      <AppShell route={route}>
        <QuizPage key={route} quizId={route.split("/")[2]!} />
      </AppShell>
    );
  if (route.startsWith("/checkout/"))
    return <CourseCheckout slug={route.split("/")[2]!} />;
  if (route === "/checkout") return <Pricing />;
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
