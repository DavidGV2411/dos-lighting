import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value == null) {
    return fallback;
  }
  return value.toLowerCase() === "true";
};

export const config = {
  server: {
    port: toInt(process.env.BACKEND_PORT, 8080)
  },
  auth: {
    adminUsername: process.env.ADMIN_USERNAME || "admin",
    sessionTtlMinutes: toInt(process.env.AUTH_SESSION_TTL_MINUTES, 480)
  },
  db: {
    host: process.env.DB_HOST || "localhost",
    port: toInt(process.env.DB_PORT, 5432),
    database: process.env.POSTGRES_DB || "luces_led",
    user: process.env.POSTGRES_USER || "admin_luces",
    password: process.env.POSTGRES_PASSWORD || "admin_luces"
  },
  migrationsDir: process.env.MIGRATIONS_DIR || path.resolve(process.cwd(), "../database"),
  retention: {
    enabled: toBool(process.env.RETENCION_ENABLED, false),
    cron: process.env.RETENCION_CRON || "0 0 3 * * *",
    diasAnonimizar: toInt(process.env.RETENCION_DIAS_ANONIMIZAR, 90),
    diasEliminarRecomendaciones: toInt(process.env.RETENCION_DIAS_ELIMINAR_RECOMENDACIONES, 365),
    diasEliminarConsultas: toInt(process.env.RETENCION_DIAS_ELIMINAR_CONSULTAS, 540),
    nombreAnonimo: process.env.RETENCION_NOMBRE_ANONIMO || "ANONIMIZADO",
    telefonoAnonimo: process.env.RETENCION_TELEFONO_ANONIMO || "0000000000"
  }
};
