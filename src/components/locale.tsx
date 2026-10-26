"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { CurrentUser, Language } from "@geki/contracts";
import { api, json } from "@/lib/api";
import { translate } from "@/lib/translations";
type Locale = {
  language: Language;
  t: (key: string) => string;
  changeLanguage: (language: Language) => Promise<void>;
};
const Context = createContext<Locale | null>(null);
export function LocaleProvider({
  account,
  refresh,
  children,
}: {
  account: CurrentUser | null;
  refresh: () => Promise<void>;
  children: ReactNode;
}) {
  const [guest, setGuest] = useState<Language>("en");
  useEffect(() => {
    try {
      if (localStorage.getItem("geki-language-v1") === "mm") setGuest("mm");
    } catch {
      /* Public browsing also works when browser storage is unavailable. */
    }
  }, []);
  const language = account?.language || guest;
  useEffect(() => {
    document.documentElement.lang = language === "mm" ? "my" : "en";
  }, [language]);
  async function changeLanguage(next: Language) {
    if (account) {
      await api("/me/preferences", {
        method: "PATCH",
        body: json({ language: next }),
      });
      await refresh();
    }
    try {
      localStorage.setItem("geki-language-v1", next);
    } catch {
      /* The account preference is still saved by the API. */
    }
    setGuest(next);
  }
  return (
    <Context.Provider
      value={{ language, t: (key) => translate(language, key), changeLanguage }}
    >
      {children}
    </Context.Provider>
  );
}
export function useLocale() {
  const value = useContext(Context);
  if (!value) throw new Error("Locale provider missing");
  return value;
}
export function SkipLink() {
  const { t } = useLocale();
  return (
    <a className="skip" href="#main">
      {t("Skip to content")}
    </a>
  );
}
export function LanguageSelector() {
  const { language, changeLanguage, t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="language-control">
      <select
        aria-label={t("Interface language")}
        value={language}
        disabled={busy}
        onChange={(event) => {
          const next = event.target.value as Language;
          setBusy(true);
          setError("");
          void changeLanguage(next)
            .catch(() =>
              setError("Language could not be saved. Please try again."),
            )
            .finally(() => setBusy(false));
        }}
      >
        <option value="en">EN</option>
        <option value="mm">မြန်မာ</option>
      </select>
      {error ? <span role="alert">{t(error)}</span> : null}
    </div>
  );
}
