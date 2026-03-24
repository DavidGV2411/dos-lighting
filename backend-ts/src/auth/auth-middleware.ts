import type { NextFunction, Request, Response } from "express";
import { AppError } from "../common/error/api-error.js";
import { config } from "../config.js";
import { findSessionByToken, revokeSession, type AuthenticatedUser } from "./session-store.js";

const PUBLIC_CRUD_GET_PREFIXES = [
  "/api/v1/marcas-vehiculo",
  "/api/v1/modelos-vehiculo",
  "/api/v1/perfiles-uso",
  "/api/v1/tipos-polarizado",
  "/api/v1/gamas-luz",
  "/api/v1/productos-led"
];

const extractBearerToken = (authorizationHeader: string | undefined): string | null => {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token, ...extra] = authorizationHeader.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer" || !token || extra.length > 0) {
    return null;
  }

  return token;
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const token = extractBearerToken(req.header("authorization"));
  if (!token) {
    next(new AppError(401, "AUTH_UNAUTHORIZED", "No autorizado."));
    return;
  }

  const session = findSessionByToken(token);
  if (!session) {
    next(new AppError(401, "AUTH_UNAUTHORIZED", "Sesion invalida o expirada."));
    return;
  }

  if (session.user.username !== config.auth.adminUsername) {
    revokeSession(token);
    next(new AppError(403, "AUTH_FORBIDDEN", "No autorizado."));
    return;
  }

  res.locals.authUser = session.user;
  res.locals.authToken = token;
  next();
};

export const requireAdminExceptPublicCrudGet = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const isPublicRead =
    req.method === "GET" &&
    PUBLIC_CRUD_GET_PREFIXES.some(
      (prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`)
    );
  if (isPublicRead) {
    next();
    return;
  }
  requireAdmin(req, res, next);
};

export const getAuthenticatedUser = (res: Response): AuthenticatedUser =>
  res.locals.authUser as AuthenticatedUser;

export const getAuthenticatedToken = (res: Response): string =>
  String(res.locals.authToken ?? "");
