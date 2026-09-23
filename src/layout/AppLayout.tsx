import { Link, Outlet, useLocation } from "react-router-dom"
import {
  BookOpen,
  Compass,
  GraduationCap,
  LayoutDashboard,
  Library,
  Medal,
  Settings,
  UserCircle,
  LogOut,
  HelpCircle,
  Menu,
  X,
} from "lucide-react"
import { useState } from "react"

const items = [
  ["Dashboard", "/dashboard", LayoutDashboard],
  ["My Learning", "/learning", BookOpen],
  ["Courses", "/app-courses", Compass],
  ["Library", "/library", Library],
  ["Seminars", "/app-seminars", GraduationCap],
  ["Achievements", "/achievements", Medal],
  ["Profile", "/profile", UserCircle],
  ["Settings", "/settings", Settings],
] as const

export default function AppLayout() {
  const location = useLocation()

  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const sidebarWidth = collapsed ? "md:w-20" : "md:w-64"
  const contentPadding = collapsed ? "md:pl-20" : "md:pl-64"

  const isActive = (path: string) => {
    if (path === "/app-courses") {
      return location.pathname.startsWith("/app-courses")
    }

    if (path === "/learning") {
      return location.pathname.startsWith("/learning")
    }

    if (path === "/library") {
      return location.pathname.startsWith("/library")
    }

    if (path === "/app-seminars") {
      return location.pathname.startsWith("/app-seminars")
    }

    return location.pathname === path
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">

      {/* =========================================================
          DESKTOP SIDEBAR
      ========================================================= */}

      <aside
        className={`
          fixed inset-y-0 left-0 z-40 hidden
          border-r border-white/8
          bg-[#0d0d0d]
          transition-all duration-300
          md:flex md:flex-col
          ${sidebarWidth}
        `}
      >
        {/* LOGO */}

        <div
          className={`
            flex h-[72px] items-center
            ${collapsed ? "justify-center px-3" : "gap-3 px-5"}
          `}
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e11d2e] font-black">
            G
          </span>

          {!collapsed && (
            <div className="text-sm font-bold tracking-[.16em]">
              GEKI{" "}
              <span className="text-white/35">
                ACADEMY
              </span>
            </div>
          )}
        </div>

        {/* NAVIGATION */}

        <nav className="flex-1 space-y-1 px-3 pt-4">
          {items.map(([label, path, Icon]) => (
            <Link
              key={path}
              to={path}
              title={collapsed ? label : undefined}
              className={`
                flex items-center rounded-xl
                py-3 text-sm
                transition-all duration-200
                ${collapsed ? "justify-center px-0" : "gap-3 px-3"}
                ${
                  isActive(path)
                    ? "bg-white/[.08] text-white"
                    : "text-white/50 hover:bg-white/[.04] hover:text-white"
                }
              `}
            >
              <Icon size={18} />

              {!collapsed && (
                <span>{label}</span>
              )}
            </Link>
          ))}
        </nav>

        {/* BOTTOM NAVIGATION */}

        <div className="space-y-1 border-t border-white/8 p-3">

          {/* HELP */}

          <button
            type="button"
            title={collapsed ? "Help" : undefined}
            className={`
              flex w-full items-center rounded-xl
              py-3 text-sm text-white/45
              transition
              hover:bg-white/[.04]
              hover:text-white
              ${collapsed ? "justify-center px-0" : "gap-3 px-3"}
            `}
          >
            <HelpCircle size={18} />

            {!collapsed && "Help"}
          </button>

          {/* LOGOUT */}

          <Link
            to="/"
            title={collapsed ? "Logout" : undefined}
            className={`
              flex w-full items-center rounded-xl
              py-3 text-sm text-white/45
              transition
              hover:bg-white/[.04]
              hover:text-white
              ${collapsed ? "justify-center px-0" : "gap-3 px-3"}
            `}
          >
            <LogOut size={18} />

            {!collapsed && "Logout"}
          </Link>

          {/* COLLAPSE */}

          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="
              mt-2 w-full rounded-xl
              border border-white/8
              py-2 text-xs text-white/30
              transition
              hover:bg-white/[.04]
              hover:text-white
            "
          >
            {collapsed ? "→" : "Collapse"}
          </button>

        </div>
      </aside>

      {/* =========================================================
          MOBILE SIDEBAR
      ========================================================= */}

      {mobileOpen && (
        <div
          className="
            fixed inset-0 z-50
            bg-black/70
            backdrop-blur-sm
            md:hidden
          "
          onClick={() => setMobileOpen(false)}
        >
          <aside
            onClick={(event) => event.stopPropagation()}
            className="
              h-full w-72
              border-r border-white/8
              bg-[#0d0d0d]
              shadow-2xl
            "
          >
            {/* MOBILE LOGO */}

            <div className="flex h-[72px] items-center justify-between px-5">

              <div className="flex items-center gap-3">

                <span className="grid size-9 place-items-center rounded-xl bg-[#e11d2e] font-black">
                  G
                </span>

                <div className="text-sm font-bold tracking-[.16em]">
                  GEKI{" "}
                  <span className="text-white/35">
                    ACADEMY
                  </span>
                </div>

              </div>

              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="
                  grid size-9 place-items-center
                  rounded-full
                  text-white/50
                  transition
                  hover:bg-white/[.05]
                  hover:text-white
                "
                aria-label="Close menu"
              >
                <X size={18} />
              </button>

            </div>

            {/* MOBILE NAV */}

            <nav className="space-y-1 px-3 pt-4">
              {items.map(([label, path, Icon]) => (
                <Link
                  key={path}
                  to={path}
                  onClick={() => setMobileOpen(false)}
                  className={`
                    flex items-center gap-3
                    rounded-xl
                    px-3 py-3
                    text-sm
                    transition
                    ${
                      isActive(path)
                        ? "bg-white/[.08] text-white"
                        : "text-white/50 hover:bg-white/[.04] hover:text-white"
                    }
                  `}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* =========================================================
          MAIN CONTENT
      ========================================================= */}

      <main
        className={`
          min-h-screen
          transition-all duration-300
          ${contentPadding}
        `}
      >

        {/* HEADER */}

        <header
          className="
            flex h-[72px]
            items-center justify-between
            border-b border-white/8
            px-5 md:px-8
          "
        >

          {/* MOBILE MENU */}

          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="
              grid size-10 place-items-center
              rounded-xl
              border border-white/8
              text-white/60
              transition
              hover:bg-white/[.04]
              hover:text-white
              md:hidden
            "
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>

          {/* RIGHT SIDE */}

          <div className="ml-auto flex items-center gap-4">

            <span className="hidden text-sm text-white/35 lg:block">
              Wednesday · 23 Sep 2026
            </span>

            <Link
              to="/profile"
              className="
                grid size-9 place-items-center
                rounded-full
                bg-white/10
                text-sm font-semibold
                transition
                hover:bg-white/[.15]
              "
            >
              SZ
            </Link>

          </div>
        </header>

        {/* PAGE CONTENT */}

        <Outlet />

      </main>
    </div>
  )
}