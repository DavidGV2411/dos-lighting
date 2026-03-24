import { Router } from "express";
import { z } from "zod";
import { getAuthenticatedToken, getAuthenticatedUser, requireAdmin } from "../auth/auth-middleware.js";
import { createSession, revokeSession } from "../auth/session-store.js";
import { AppError } from "../common/error/api-error.js";
import { parseOrThrow } from "../common/validation.js";
import { config } from "../config.js";
import { query, queryOne } from "../db/pool.js";

type UsuarioAuthRow = {
  id: number;
  username: string;
  nombreCompleto: string | null;
  activo: boolean;
};

const loginSchema = z.object({
  username: z
    .string({ required_error: "username es obligatorio", invalid_type_error: "username es obligatorio" })
    .trim()
    .min(1, "username es obligatorio")
    .max(50, "username invalido"),
  password: z
    .string({ required_error: "password es obligatorio", invalid_type_error: "password es obligatorio" })
    .min(1, "password es obligatorio")
    .max(200, "password invalido")
});

export const authRoutes = Router();

authRoutes.post("/api/auth/login", async (req, res, next) => {
  try {
    const body = parseOrThrow(loginSchema, req.body);

    if (body.username !== config.auth.adminUsername) {
      throw new AppError(401, "AUTH_INVALID_CREDENTIALS", "Credenciales invalidas.");
    }

    const usuario = await queryOne<UsuarioAuthRow>(
      `
      SELECT
        id,
        username,
        nombre_completo AS "nombreCompleto",
        activo
      FROM usuarios
      WHERE username = $1
        AND password_hash = crypt($2, password_hash)
      `,
      [body.username, body.password]
    );

    if (!usuario || !usuario.activo) {
      await query(
        `
        UPDATE usuarios
        SET intentos_fallidos = intentos_fallidos + 1
        WHERE username = $1
        `,
        [body.username]
      );
      throw new AppError(401, "AUTH_INVALID_CREDENTIALS", "Credenciales invalidas.");
    }

    await query(
      `
      UPDATE usuarios
      SET ultimo_login = NOW(),
          intentos_fallidos = 0,
          bloqueado_hasta = NULL
      WHERE id = $1
      `,
      [usuario.id]
    );

    const session = createSession({
      id: usuario.id,
      username: usuario.username,
      nombreCompleto: usuario.nombreCompleto
    });

    res.json({
      accessToken: session.token,
      tokenType: "Bearer",
      expiresInSeconds: session.expiresInSeconds,
      user: {
        id: usuario.id,
        username: usuario.username,
        nombreCompleto: usuario.nombreCompleto
      }
    });
  } catch (error) {
    next(error);
  }
});

authRoutes.get("/api/auth/me", requireAdmin, (_req, res) => {
  const user = getAuthenticatedUser(res);
  res.json({ user });
});

authRoutes.post("/api/auth/logout", requireAdmin, (_req, res) => {
  const token = getAuthenticatedToken(res);
  if (token) {
    revokeSession(token);
  }
  res.status(204).send();
});
