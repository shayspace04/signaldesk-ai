import { LemmaClient } from "lemma-sdk";

function decodePayload(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

function isTokenExpired(token) {
  const payload = decodePayload(token);
  return !payload || !payload.exp || payload.exp * 1000 < Date.now();
}

function getStorageToken() {
  try {
    return localStorage.getItem("lemma_token");
  } catch {
    return null;
  }
}

function removeStorageToken() {
  try {
    localStorage.removeItem("lemma_token");
  } catch {
    // ignore storage errors
  }
}

const envToken = import.meta.env.DEV ? import.meta.env.VITE_LEMMA_TOKEN : null;
const stored = getStorageToken();

if (stored && envToken && stored === envToken && isTokenExpired(envToken)) {
  removeStorageToken();
} else if (stored && isTokenExpired(stored)) {
  removeStorageToken();
}

if (!getStorageToken() && envToken && !isTokenExpired(envToken)) {
  try {
    localStorage.setItem("lemma_token", envToken);
  } catch {
    // ignore storage errors
  }
}

const client = new LemmaClient({
  apiUrl: import.meta.env.DEV ? "" : undefined,
  podId: "019ef98f-eb70-71d8-a1e1-1aa54497dda0",
  timeoutMs: 120000,
});

client.auth.subscribe((state) => {
  if (state.status === "unauthenticated") {
    const current = getStorageToken();
    if (current && isTokenExpired(current)) {
      removeStorageToken();
    }
  }
});

export const ORG_ID = "019ef98f-e90b-74df-9116-d0df1a4baeff";
export const GMAIL_AUTH_CONFIG = "gmail";
export const ALERT_RECIPIENT = "shay24test@gmail.com";
export const LINEAR_AUTH_CONFIG = "linear";
export const LINEAR_TEAM_ID = "8016a82b-1e4c-40bc-b2c1-40c521897628";

export default client;