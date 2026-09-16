import { Link, Outlet, useLocation } from 'react-router-dom'
import { Menu, ArrowUpRight } from 'lucide-react'
import { useState } from 'react'
import logo from '../assets/logo.png'

export default function PublicLayout() {
  const [open, setOpen] = useState(false)
  const loc = useLocation()

  const navItems = [
    ['Courses', '/courses'],
    ['Seminars', '/seminars'],
    ['About', '/'],
  ]

  return (
    <div className="min-h-screen bg-[#090909] text-white">
      <header className="fixed z-50 w-full border-b border-white/5 bg-[#090909]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center">
                <svg
                    viewBox="0 0 100 100"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-full w-full"
                >
                    <circle cx="50" cy="50" r="48" fill="#E30613" />

                    <path
                    d="M25 35C35 41 65 41 75 35L73 43C68 46 32 46 27 43Z"
                    fill="white"
                    />

                    <path d="M33 43V78" stroke="white" strokeWidth="7" />
                    <path d="M67 43V78" stroke="white" strokeWidth="7" />

                    <path d="M29 49H71V56H29V49Z" fill="white" />

                    <path d="M39 56V78H61V56" fill="#E30613" />
                </svg>
                </span>

            <span className="text-sm font-bold tracking-[.2em]">
                GEKI{' '}
                <span className="text-white/40">
                ACADEMY
                </span>
            </span>
            </Link>

          {/* Desktop navigation */}
          <nav className="hidden items-center gap-7 md:flex">
            {navItems.map(([label, path]) => (
              <Link
                key={label}
                to={path}
                className={`text-sm transition ${
                  loc.pathname === path
                    ? 'text-white'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Desktop actions */}
          <div className="hidden items-center gap-3 md:flex">
            <Link
              to="/login"
              className="text-sm text-white/60 hover:text-white"
            >
              Sign in
            </Link>

            <Link
              to="/signup"
              className="inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
            >
              Join GEKI
              <ArrowUpRight size={14} />
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            <Menu />
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="border-t border-white/10 bg-[#0c0c0c] p-4 md:hidden">
            <div className="grid gap-2">
              {[
                ['Courses', '/courses'],
                ['Seminars', '/seminars'],
                ['Sign in', '/login'],
                ['Join GEKI', '/signup'],
              ].map(([label, path]) => (
                <Link
                  key={label}
                  to={path}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-4 py-3 text-white/70 hover:bg-white/5 hover:text-white"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>

      <Outlet />
    </div>
  )
}