"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { onIdTokenChanged, signOut, type User } from "firebase/auth";
import type { CurrentUser } from "@geki/contracts";
import { firebaseAuth } from "@/lib/firebase";
import { api, registerCurrentDevice } from "@/lib/api";
import { LocaleProvider, SkipLink } from "./locale";
type Context = {
  identity: User | null;
  account: CurrentUser | null;
  loading: boolean;
  error: string;
  deviceNotice: string;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};
const AuthContext = createContext<Context | null>(null);
export function Providers({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<User | null>(null);
  const [account, setAccount] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deviceNotice, setDeviceNotice] = useState("");
  const authVersion = useRef(0);
  const refresh = useCallback(async () => {
    const user = firebaseAuth().currentUser;
    if (!user) {
      setAccount(null);
      return;
    }
    const data = await api<CurrentUser>("/me");
    if (firebaseAuth().currentUser?.uid !== user.uid) return;
    setAccount(data);
    setError("");
    try {
      await registerCurrentDevice();
      setDeviceNotice("");
    } catch (e) {
      setDeviceNotice(
        e instanceof Error ? e.message : "Unable to register this browser.",
      );
    }
  }, []);
  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    try {
      unsubscribe = onIdTokenChanged(firebaseAuth(), async (user) => {
        if (!active) return;
        const version = ++authVersion.current;
        setIdentity(user);
        setAccount(null);
        setDeviceNotice("");
        setError("");
        setLoading(true);
        try {
          if (user) {
            const me = await api<CurrentUser>("/me");
            let notice = "";
            try {
              await registerCurrentDevice();
            } catch (e) {
              notice =
                e instanceof Error
                  ? e.message
                  : "This browser could not be registered. Open My Devices to retry.";
            }
            if (active && version === authVersion.current) {
              setAccount(me);
              setDeviceNotice(notice);
            }
          }
        } catch (e) {
          if (active && version === authVersion.current)
            setError(
              e instanceof Error ? e.message : "Unable to load your account.",
            );
        } finally {
          if (active && version === authVersion.current) setLoading(false);
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication unavailable.");
      setLoading(false);
    }
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  const logout = async () => {
    await signOut(firebaseAuth());
    setAccount(null);
  };
  return (
    <AuthContext.Provider
      value={{
        identity,
        account,
        loading,
        error,
        deviceNotice,
        refresh,
        logout,
      }}
    >
      <LocaleProvider account={account} refresh={refresh}>
        <SkipLink />
        {children}
      </LocaleProvider>
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("Auth provider missing.");
  return value;
}
export function useData<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!!path);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((n) => n + 1), []);
  useEffect(() => {
    let active = true;
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    api<T>(path)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : "Request failed.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, version]);
  return { data, error, loading, reload };
}
