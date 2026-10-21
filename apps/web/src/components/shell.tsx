"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "./providers";
import { useLocale, LanguageSelector } from "./locale";
import { Logo, Icon, Button, Loading, Message, Modal, type icons } from "./ui";
const studentNav = [
  ["/dashboard", "home", "Overview"],
  ["/my-learning", "book", "My Learning"],
  ["/library", "grid", "Course Library"],
  ["/membership", "card", "Membership"],
  ["/devices", "devices", "My Devices"],
  ["/notifications", "bell", "Notifications"],
  ["/settings", "settings", "Settings"],
] as const;
const adminNav = [
  ["/admin", "grid", "Overview"],
  ["/admin/courses", "book", "Courses"],
  ["/admin/videos", "film", "Videos & Subtitles"],
  ["/admin/students", "users", "Students & Memberships"],
  ["/admin/audit", "shield", "Roles & Audit"],
] as const;
export function PublicNav() {
  const { t } = useLocale();
  const { account, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  return (
    <>
      <nav className="public-nav shell">
        <Logo />
        <div className="nav-links">
          <Link href="/">{t("Home")}</Link>
          <Link href="/library">{t("Courses")}</Link>
          <Link href="/#about">{t("About GEKI")}</Link>
          <Link href="/pricing">{t("Membership")}</Link>
        </div>
        <div className="nav-actions">
          <LanguageSelector />
          {account ? (
            <Link className="btn small" href="/dashboard">
              {t("My Academy")} <Icon name="up" />
            </Link>
          ) : (
            <>
              <Link className="sign-in" href="/signin">
                {t("Sign in")}
              </Link>
              <Link className="btn small" href="/signup">
                {t("Get started")} <Icon name="up" />
              </Link>
            </>
          )}
          <button
            className="icon-btn menu-button"
            onClick={() => setMenu(true)}
            aria-label="Open navigation"
          >
            <Icon name="menu" />
          </button>
        </div>
      </nav>
      {menu ? (
        <Modal title="Explore GEKI" onClose={() => setMenu(false)}>
          <div className="stack">
            {[
              ["/", "Home"],
              ["/library", "Courses"],
              ["/pricing", "Membership"],
              [
                account ? "/dashboard" : "/signin",
                account ? "My Academy" : "Sign in",
              ],
            ].map(([h, label]) => (
              <Link
                className="text-link"
                key={h}
                href={h!}
                onClick={() => setMenu(false)}
              >
                {t(label!)}
                <Icon name="arrow" />
              </Link>
            ))}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
export function Footer() {
  const { t } = useLocale();
  return (
    <footer className="footer shell">
      <div className="footer-top">
        <Logo />
        <div className="footer-links">
          <Link href="/library">{t("Courses")}</Link>
          <Link href="/pricing">{t("Membership")}</Link>
          <Link href="/preview">{t("Free lesson")}</Link>
          <Link href="/recovery">{t("Account help")}</Link>
        </div>
      </div>
      <div className="footer-word">GEKI ACADEMY</div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} GEKI Academy.</span>
        <span>Traditional spirit. Modern science. Limitless growth.</span>
      </div>
    </footer>
  );
}
export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicNav />
      <main id="main" className="shell public-main">
        {children}
      </main>
      <Footer />
    </>
  );
}
export function AppShell({
  children,
  route,
  admin = false,
}: {
  children: ReactNode;
  route: string;
  admin?: boolean;
}) {
  const { identity, account, loading, error, logout, refresh } = useAuth();
  const { t: translate } = useLocale();
  const router = useRouter();
  const nav = admin ? adminNav : studentNav;
  const [menu, setMenu] = useState(false);
  if (loading)
    return (
      <PublicLayout>
        <Loading />
      </PublicLayout>
    );
  if (!identity)
    return (
      <PublicLayout>
        <div className="state-card panel">
          <h1>Your academy awaits.</h1>
          <p>Sign in to continue your learning.</p>
          <Button href={"/signin?next=" + encodeURIComponent(route)}>
            Sign in <Icon name="arrow" />
          </Button>
        </div>
      </PublicLayout>
    );
  if (error)
    return (
      <PublicLayout>
        <Message error>{error}</Message>
        <Button onClick={() => void refresh()}>Try again</Button>
        <Button
          secondary
          onClick={() => void logout().then(() => router.push("/signin"))}
        >
          {translate("Sign out")}
        </Button>
      </PublicLayout>
    );
  if (!account)
    return (
      <PublicLayout>
        <Loading />
      </PublicLayout>
    );
  if (admin && account.role === "STUDENT")
    return (
      <PublicLayout>
        <Message error>Administrator access is required.</Message>
      </PublicLayout>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo />
        <div>
          <div className="sidebar-label">
            {admin ? "WORKSPACE" : "YOUR ACADEMY"}
          </div>
          <nav className="sidebar-nav">
            {nav.map(([h, i, t]) => (
              <Link key={h} href={h} className={route === h ? "active" : ""}>
                <Icon name={i} />
                <span>{translate(t)}</span>
              </Link>
            ))}
            {!admin && account.role !== "STUDENT" ? (
              <Link href="/admin">
                <Icon name="shield" />
                <span>Administration</span>
              </Link>
            ) : null}
          </nav>
        </div>
        <div className="sidebar-bottom">
          <div className="panel">
            <BadgeLabel active={!!account.membership} />
            <p>
              {account.membership
                ? "Your next lesson is waiting."
                : "Your progress is kept safe."}
            </p>
            <Link
              className="text-link"
              href={admin ? "/dashboard" : "/membership"}
            >
              {admin ? "Student view" : "Membership"}
              <Icon name="arrow" />
            </Link>
          </div>
          <button
            className="profile-link"
            onClick={() => void logout().then(() => router.push("/signin"))}
          >
            <span className="avatar">
              {account.displayName.slice(0, 2).toUpperCase()}
            </span>
            <span>
              {translate("Sign out")} <small>{account.displayName}</small>
            </span>
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <span className="mobile-logo">
            <Logo />
          </span>
          <div className="breadcrumbs">
            {admin ? "Administration" : "My Academy"} /{" "}
            <span className="light">
              {nav.find(([h]) => route === h)?.[2] || "Learning"}
            </span>
          </div>
          <div className="row">
            <LanguageSelector />
            <Link
              className="icon-btn"
              href="/notifications"
              aria-label="Notifications"
            >
              <Icon name="bell" />
            </Link>
            <button
              className="icon-btn"
              onClick={() => setMenu(true)}
              aria-label="Account navigation"
            >
              <Icon name="menu" />
            </button>
          </div>
        </header>
        <main
          id="main"
          className={`app-content ${admin ? "admin-content" : ""}`}
        >
          {!account.emailVerified ? (
            <div className="utility-bar">
              <span>Verify your email to access paid learning.</span>
              <Link className="text-link" href="/verify">
                Verify email
              </Link>
            </div>
          ) : null}
          <div key={route} className="page-enter">
            {children}
          </div>
        </main>
      </div>
      <nav className="mobile-bottom" aria-label="Main navigation">
        {nav.slice(0, 4).map(([h, i, t]) => (
          <Link key={h} href={h} className={route === h ? "active" : ""}>
            <Icon name={i} />
            <span>
              {translate(
                t
                  .replace("Course Library", "Library")
                  .replace("Students & Memberships", "Students")
                  .replace("Videos & Subtitles", "Videos"),
              )}
            </span>
          </Link>
        ))}
      </nav>
      {menu ? (
        <Modal title="My Academy" onClose={() => setMenu(false)}>
          <div className="stack">
            {nav.map(([h, i, t]) => (
              <Link
                key={h}
                href={h}
                className="text-link"
                onClick={() => setMenu(false)}
              >
                <Icon name={i} />
                {translate(t)}
              </Link>
            ))}
            <Button
              secondary
              onClick={() => void logout().then(() => router.push("/signin"))}
            >
              {translate("Sign out")}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
function BadgeLabel({ active }: { active: boolean }) {
  return (
    <span className={`badge ${active ? "green" : "amber"}`}>
      {active ? "Active member" : "No active membership"}
    </span>
  );
}
