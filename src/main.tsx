import React, { useEffect } from "react"
import ReactDOM from "react-dom/client"

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom"

import "./index.css"

import PublicLayout from "./layout/PublicLayout"
import AppLayout from "./layout/AppLayout"
import AdminLayout from "./layout/AdminLayout"

import {
  Home,
  Courses,
  CourseDetail,
  Seminars,
} from "./pages/Public"

import {
  Login,
  Signup,
  Onboarding,
} from "./pages/Auth"

import {
  Dashboard,
  Learning,
  Lesson,
  Achievements,
  Profile,
  SimplePage,
} from "./pages/AppPages"

import {
  AdminOverview,
  AdminUsers,
  AdminCourses,
  AdminBuilder,
  AdminAnalytics,
  AdminSimple,
} from "./pages/Admin"

import {
  KihonCourse,
  KihonLesson,
} from "./pages/KihonCourse"


// =====================================================
// SCROLL TO TOP
// =====================================================

function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant",
    })
  }, [pathname])

  return null
}


// =====================================================
// PAGE TRANSITION
// =====================================================

function PageTransition() {
  const location = useLocation()

  return (
    <div
      key={location.pathname}
      className="page-transition min-h-screen"
    >
      <Routes location={location}>

        {/* =====================================================
            PUBLIC WEBSITE
        ===================================================== */}

        <Route element={<PublicLayout />}>

          <Route
            path="/"
            element={<Home />}
          />

          <Route
            path="/login"
            element={<Login />}
          />

          <Route
            path="/signup"
            element={<Signup />}
          />

          <Route
            path="/onboarding"
            element={<Onboarding />}
          />

          <Route
            path="/courses"
            element={<Courses />}
          />

          <Route
            path="/course/:id"
            element={<CourseDetail />}
          />

          <Route
            path="/seminars"
            element={<Seminars />}
          />

        </Route>


        {/* =====================================================
            APPLICATION
        ===================================================== */}

        <Route element={<AppLayout />}>

          <Route
            path="/dashboard"
            element={<Dashboard />}
          />

          <Route
            path="/learning"
            element={<Learning />}
          />

          <Route
            path="/library"
            element={
              <SimplePage title="Library" />
            }
          />

          {/* =================================================
              COURSES
          ================================================= */}

          <Route
            path="/app-courses"
            element={<Courses />}
          />

          {/* GEKI KIHON COURSE */}

          <Route
            path="/app-courses/geki-kihon"
            element={<KihonCourse />}
          />

          {/* GEKI KIHON LESSON */}

          <Route
            path="/app-courses/geki-kihon/lesson/:lessonId"
            element={<KihonLesson />}
          />

          <Route
            path="/app-seminars"
            element={<Seminars />}
          />

          <Route
            path="/lesson/:id"
            element={<Lesson />}
          />

          <Route
            path="/achievements"
            element={<Achievements />}
          />

          <Route
            path="/profile"
            element={<Profile />}
          />

          <Route
            path="/settings"
            element={
              <SimplePage title="Settings" />
            }
          />

        </Route>


        {/* =====================================================
            ADMIN
        ===================================================== */}

        <Route element={<AdminLayout />}>

          <Route
            path="/admin"
            element={<AdminOverview />}
          />

          <Route
            path="/admin/users"
            element={<AdminUsers />}
          />

          <Route
            path="/admin/courses"
            element={<AdminCourses />}
          />

          <Route
            path="/admin/builder"
            element={<AdminBuilder />}
          />

          <Route
            path="/admin/seminars"
            element={
              <AdminSimple title="Seminars" />
            }
          />

          <Route
            path="/admin/achievements"
            element={
              <AdminSimple title="Achievements" />
            }
          />

          <Route
            path="/admin/analytics"
            element={<AdminAnalytics />}
          />

          <Route
            path="/admin/settings"
            element={
              <AdminSimple title="Settings" />
            }
          />

        </Route>


        {/* =====================================================
            FALLBACK
        ===================================================== */}

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />

      </Routes>
    </div>
  )
}


// =====================================================
// ROOT APP
// =====================================================

function App() {
  return (
    <>
      <ScrollToTop />
      <PageTransition />
    </>
  )
}


// =====================================================
// REACT ROOT
// =====================================================

ReactDOM.createRoot(
  document.getElementById("root")!
).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)

