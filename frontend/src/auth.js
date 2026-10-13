// Firebase Authentication anonymous sign-in (PRD M-3, decision D-10).
//
// A visitor is signed in automatically on first load, so a judge reaches the
// full flow without registering or typing any credential. The public Firebase
// web configuration is injected at build time (VITE_FIREBASE_*), so no key
// material is committed to the repository. The session (uid + refresh token)
// is kept in localStorage and silently refreshed, so the same anonymous
// identity survives a page reload and outlives the one-hour ID token.

const CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

const SESSION_KEY = 'cl_anon_session';
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

function readSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null'); } catch { return null; }
}

function writeSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.__userUid = session.uid;
  window.__idToken = session.idToken;
}

async function signUp() {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${CONFIG.apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  if (!res.ok) throw new Error(`anonymous sign-in failed: HTTP ${res.status}`);
  const d = await res.json();
  return { uid: d.localId, idToken: d.idToken, refreshToken: d.refreshToken, expiresAt: Date.now() + Number(d.expiresIn) * 1000 };
}

async function refresh(session) {
  const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${CONFIG.apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(session.refreshToken)}`,
  });
  if (!res.ok) throw new Error(`token refresh failed: HTTP ${res.status}`);
  const d = await res.json();
  return { uid: d.user_id, idToken: d.id_token, refreshToken: d.refresh_token, expiresAt: Date.now() + Number(d.expires_in) * 1000 };
}

/**
 * Ensures an anonymous Firebase session exists and returns its uid.
 * Returns null when no web configuration was injected at build time, in which
 * case the application still runs, just without an identity.
 */
export async function ensureAnonymousSession() {
  if (!CONFIG.apiKey) return null;
  const session = readSession();
  if (session?.refreshToken && session.expiresAt > Date.now() + REFRESH_MARGIN_MS) {
    writeSession(session);
    return session.uid;
  }
  try {
    const next = session?.refreshToken ? await refresh(session) : await signUp();
    writeSession(next);
    return next.uid;
  } catch {
    const fresh = await signUp();
    writeSession(fresh);
    return fresh.uid;
  }
}

/** Current ID token, refreshing it first when it is close to expiry. */
export async function currentIdToken() {
  await ensureAnonymousSession();
  return window.__idToken ?? null;
}
