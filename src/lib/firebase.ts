"use client";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
let auth: Auth | undefined;
export function firebaseAuth() {
  if (auth) return auth;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!apiKey || !projectId)
    throw new Error(
      "Firebase configuration is missing. See .env.example.",
    );
  const app = getApps().length
    ? getApp()
    : initializeApp({
        apiKey,
        projectId,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      });
  auth = getAuth(app);
  const emulator = process.env.NEXT_PUBLIC_AUTH_EMULATOR_URL;
  if (emulator) {
    if (process.env.NODE_ENV === "production")
      throw new Error("Production builds cannot use the Auth Emulator.");
    connectAuthEmulator(auth, emulator, { disableWarnings: true });
  }
  return auth;
}
