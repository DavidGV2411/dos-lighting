import { z } from "zod";
import { AppError } from "./error/api-error.js";

export const positiveInt = z.coerce.number().int().min(1);

export const parseOrThrow = <T>(schema: z.ZodType<T>, input: unknown): T => {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => ({
      field: issue.path.join(".") || "body",
      message: issue.message
    }));
    throw new AppError(400, "VALIDATION_ERROR", "Datos de entrada invalidos.", details);
  }
  return parsed.data;
};

