"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  sendEmailVerification,
  applyActionCode,
  confirmPasswordReset,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { api, json } from "@/lib/api";
import { useAuth } from "./providers";
import { Logo, Button, Icon, Message } from "./ui";
export function AuthPage({ route }: { route: string }) {
  const kind = route.slice(1);
  const router = useRouter();
  const { identity, refresh } = useAuth();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [consent, setConsent] = useState(false);
  function destination() {
    const next = new URLSearchParams(location.search).get("next");
    return next?.startsWith("/") &&
      !next.startsWith("//") &&
      !next.includes("\\")
      ? next
      : "/dashboard";
  }
  const title =
    kind === "signin"
      ? "Return to your practice."
      : kind === "signup"
        ? "Make room for growth."
        : kind === "verify"
          ? "Check your inbox."
          : kind === "reset"
            ? "A fresh start."
            : "Find your way back.";
  useEffect(() => {
    if (kind !== "verify") return;
    const code = new URLSearchParams(location.search).get("oobCode");
    if (code)
      void applyActionCode(firebaseAuth(), code)
        .then(async () => {
          await firebaseAuth().currentUser?.reload();
          await firebaseAuth().currentUser?.getIdToken(true);
          await refresh();
          setMessage(
            "Your email is verified. You can continue to your academy.",
          );
        })
        .catch(() =>
          setError(
            "This link is invalid or expired. Request a new verification email.",
          ),
        );
  }, [kind, refresh]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") || "");
    const password = String(f.get("password") || "");
    try {
      const auth = firebaseAuth();
      if (kind === "signin") {
        await signInWithEmailAndPassword(auth, email, password);
        await refresh();
        router.push(destination());
      } else if (kind === "signup") {
        if (!consent)
          throw new Error(
            "Confirm your age/guardian responsibility and account consent.",
          );
        const credential = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        await api("/me/profile", {
          method: "PATCH",
          body: json({
            displayName: f.get("displayName"),
            language: f.get("language"),
            accountType: f.get("accountType"),
            consent: true,
          }),
        });
        await sendEmailVerification(credential.user, {
          url: location.origin + "/verify",
        });
        await refresh();
        router.push("/verify");
      } else if (kind === "reset") {
        const code = new URLSearchParams(location.search).get("oobCode");
        if (!code)
          throw new Error("Open the reset link from your email first.");
        if (password !== String(f.get("confirm")))
          throw new Error("The passwords do not match.");
        await confirmPasswordReset(auth, code, password);
        setMessage("Password updated. You can now sign in.");
      } else {
        await sendPasswordResetEmail(auth, email, {
          url: location.origin + "/signin",
        });
        setMessage(
          "If an account matches that email, a reset link will be sent.",
        );
      }
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  }
  async function google() {
    setBusy(true);
    setError("");
    try {
      await signInWithPopup(firebaseAuth(), new GoogleAuthProvider());
      await refresh();
      router.push(destination());
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    setBusy(true);
    try {
      if (!identity) throw new Error("Sign in before requesting verification.");
      await sendEmailVerification(identity, {
        url: location.origin + "/verify",
      });
      setMessage("Verification email sent. Check your inbox.");
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="auth">
      <section className="auth-art">
        <img src="/images/hero.jpg" alt="Karate training concept photography" />
        <Logo />
        <div className="stack">
          <div className="eyebrow light">
            TRADITIONAL SPIRIT. MODERN SCIENCE.
          </div>
          <h2>
            Discipline.
            <br />
            In every detail.
          </h2>
        </div>
      </section>
      <section className="auth-form-area">
        <div className="auth-form reveal">
          <div className="eyebrow">GEKI ACADEMY</div>
          <h1>{title}</h1>
          {process.env.NEXT_PUBLIC_AUTH_EMULATOR_URL ? (
            <div className="notice auth-environment">
              <strong>Local test sign-in</strong>
              <p>
                This workspace uses the Firebase Auth Emulator. Real Google and
                email accounts use the connected app.
              </p>
              <a
                className="text-link"
                href={
                  (process.env.NEXT_PUBLIC_CONNECTED_APP_URL ||
                    "http://localhost:3000") + route
                }
              >
                Use real Firebase sign-in <Icon name="up" />
              </a>
            </div>
          ) : (
            <div className="eyebrow">
              FIREBASE · GEKI-ACADEMY · REAL ACCOUNTS
            </div>
          )}
          <p>
            {kind === "signin"
              ? "Sign in to continue your learning journey."
              : kind === "signup"
                ? "One account. A clearer understanding."
                : "Secure access to your learning account."}
          </p>
          {error ? <Message error>{error}</Message> : null}
          {message ? <Message>{message}</Message> : null}
          {kind === "verify" ? (
            <>
              <p>
                Use the verification link in your email. In the local emulator,
                the link is printed in its terminal.
              </p>
              <Button disabled={busy} onClick={() => void verify()}>
                Resend verification email
              </Button>
              <Button
                secondary
                onClick={() =>
                  void identity
                    ?.reload()
                    .then(() => identity.getIdToken(true))
                    .then(refresh)
                    .then(() => router.push("/dashboard"))
                }
              >
                I’ve verified my email
              </Button>
              <Link href="/signin">Back to sign in</Link>
            </>
          ) : (
            <>
              {["signin", "signup"].includes(kind) ? (
                <>
                  <Button
                    secondary
                    disabled={busy}
                    onClick={() => void google()}
                  >
                    {process.env.NEXT_PUBLIC_AUTH_EMULATOR_URL
                      ? "Test Google sign-in"
                      : "Continue with Google"}
                  </Button>
                  <div className="divider">OR USE EMAIL</div>
                </>
              ) : null}
              <form className="stack" onSubmit={submit}>
                {kind === "signup" ? (
                  <>
                    <label>
                      Learner display name
                      <input
                        name="displayName"
                        required
                        minLength={2}
                        maxLength={80}
                      />
                    </label>
                    <label>
                      Account type
                      <select name="accountType">
                        <option value="ADULT">Myself · Age 18+</option>
                        <option value="GUARDIAN">My child · Age 12–17</option>
                      </select>
                    </label>
                    <label>
                      Language
                      <select name="language">
                        <option value="en">English</option>
                        <option value="mm">မြန်မာ</option>
                      </select>
                    </label>
                  </>
                ) : null}
                {kind !== "reset" ? (
                  <label>
                    Account / guardian email
                    <input
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                    />
                  </label>
                ) : null}
                {["signin", "signup", "reset"].includes(kind) ? (
                  <label>
                    Password
                    <div className="password-wrap">
                      <input
                        name="password"
                        required
                        type={visible ? "text" : "password"}
                        minLength={kind === "signin" ? 1 : 10}
                        autoComplete={
                          kind === "signin"
                            ? "current-password"
                            : "new-password"
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setVisible((v) => !v)}
                        aria-label={visible ? "Hide password" : "Show password"}
                      >
                        <Icon name="settings" />
                      </button>
                    </div>
                  </label>
                ) : null}
                {kind === "reset" ? (
                  <label>
                    Confirm password
                    <input
                      name="confirm"
                      type="password"
                      required
                      minLength={10}
                    />
                  </label>
                ) : null}
                {kind === "signup" ? (
                  <label className="consent">
                    <input
                      type="checkbox"
                      required
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    <span>
                      I am 18+ or the parent/guardian of a learner aged 12–17. I
                      consent to managing this learner’s account.
                    </span>
                  </label>
                ) : null}
                {kind === "signin" ? (
                  <Link className="text-link" href="/forgot">
                    Forgot password?
                  </Link>
                ) : null}
                <Button type="submit" disabled={busy}>
                  {busy
                    ? "Please wait…"
                    : kind === "signin"
                      ? "Sign in"
                      : kind === "signup"
                        ? "Create account"
                        : kind === "reset"
                          ? "Save password"
                          : "Send reset link"}
                  <Icon name="arrow" />
                </Button>
              </form>
              <p style={{ textAlign: "center", fontSize: 12 }}>
                {kind === "signin" ? (
                  <>
                    New to GEKI?{" "}
                    <Link className="light" href="/signup">
                      Create an account
                    </Link>
                  </>
                ) : (
                  <Link className="light" href="/signin">
                    Return to sign in
                  </Link>
                )}
              </p>
            </>
          )}
          <Link href="/preview" className="text-link">
            Watch the free lesson <Icon name="play" />
          </Link>
        </div>
      </section>
    </main>
  );
}
function friendlyAuthError(e: unknown) {
  const code = typeof e === "object" && e && "code" in e ? String(e.code) : "";
  if (
    [
      "auth/invalid-credential",
      "auth/user-not-found",
      "auth/wrong-password",
      "auth/email-already-in-use",
    ].includes(code)
  )
    return "Unable to complete sign-in. Check your email/password or use account recovery.";
  if (
    code === "auth/popup-blocked" ||
    code === "auth/operation-not-supported-in-this-environment"
  )
    return "Open this page in Chrome or Safari to continue with Google.";
  if (code === "auth/unauthorized-domain")
    return "This domain is not enabled in Firebase Authentication. Ask the administrator to authorize it.";
  return e instanceof Error
    ? e.message
    : "Authentication could not be completed.";
}
