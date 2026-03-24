import crypto from "node:crypto";
import { config } from "../config.js";

export type AuthenticatedUser = {
  id: number;
  username: string;
  nombreCompleto: string | null;
};

type SessionRecord = {
  token: string;
  user: AuthenticatedUser;
  expiresAt: number;
};

const sessions = new Map<string, SessionRecord>();

const sessionTtlMs = Math.max(config.auth.sessionTtlMinutes, 1) * 60 * 1000;

const pruneExpiredSessions = (): void => {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(token);
    }
  }
};

export const createSession = (
  user: AuthenticatedUser
): { token: string; expiresInSeconds: number } => {
  pruneExpiredSessions();
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, {
    token,
    user,
    expiresAt: Date.now() + sessionTtlMs
  });
  return {
    token,
    expiresInSeconds: Math.floor(sessionTtlMs / 1000)
  };
};

export const findSessionByToken = (token: string): SessionRecord | null => {
  pruneExpiredSessions();
  const session = sessions.get(token);
  if (!session) {
    return null;
  }
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
};

export const revokeSession = (token: string): void => {
  sessions.delete(token);
};
