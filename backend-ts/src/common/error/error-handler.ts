import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError, type ApiErrorDetail, toApiError } from "./api-error.js";

const constraintCodes = new Set(["23502", "23503", "23505", "23514", "23P01"]);

const fromZodError = (error: ZodError): ApiErrorDetail[] =>
  error.issues.map((issue) => ({
    field: issue.path.join(".") || "body",
    message: issue.message
  }));

export const errorHandler = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (error instanceof AppError) {
    res.status(error.status).json(toApiError(req.path, error.code, error.message, error.details));
    return;
  }

  if (error instanceof ZodError) {
    res
      .status(400)
      .json(toApiError(req.path, "VALIDATION_ERROR", "Datos de entrada invalidos.", fromZodError(error)));
    return;
  }

  if (
    typeof error === "object" &&
    error != null &&
    "type" in error &&
    (error as { type?: string }).type === "entity.parse.failed"
  ) {
    res.status(400).json(
      toApiError(
        req.path,
        "REQUEST_BODY_INVALID",
        "El cuerpo de la solicitud es invalido o tiene formato incorrecto.",
        []
      )
    );
    return;
  }

  if (
    typeof error === "object" &&
    error != null &&
    "code" in error &&
    constraintCodes.has(String((error as { code?: string }).code))
  ) {
    const code = String((error as { code?: string }).code);
    let message = "Operacion no permitida por integridad de datos o duplicidad.";

    if (code === "23503") {
      message = "No se puede completar la operacion porque el registro esta en uso por otros datos relacionados.";
    } else if (code === "23505") {
      message = "Ya existe un registro con esos valores y no se permiten duplicados.";
    } else if (code === "23502" || code === "23514") {
      message = "Los datos enviados no cumplen con las reglas requeridas por la base de datos.";
    }

    res.status(409).json(
      toApiError(
        req.path,
        "DATA_INTEGRITY_ERROR",
        message,
        []
      )
    );
    return;
  }

  console.error(error);
  res.status(500).json(toApiError(req.path, "INTERNAL_ERROR", "Error interno inesperado.", []));
};
