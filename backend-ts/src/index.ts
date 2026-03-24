import express from "express";
import { requireAdmin, requireAdminExceptPublicCrudGet } from "./auth/auth-middleware.js";
import { config } from "./config.js";
import { errorHandler } from "./common/error/error-handler.js";
import { runMigrations } from "./db/migrations.js";
import { queryOne } from "./db/pool.js";
import { catalogRoutes } from "./routes/catalog-routes.js";
import { crudRoutes } from "./routes/crud-routes.js";
import { consultaRoutes } from "./routes/consulta-routes.js";
import { authRoutes } from "./routes/auth-routes.js";
import { recomendacionRoutes } from "./routes/recomendacion-routes.js";
import { startRetentionScheduler } from "./retention/retention-scheduler.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/actuator/health", async (_req, res) => {
  try {
    await queryOne<{ ok: number }>("SELECT 1 AS ok");
    res.json({ status: "UP" });
  } catch {
    res.status(500).json({ status: "DOWN" });
  }
});

app.use(authRoutes);
app.use(catalogRoutes);
app.use(recomendacionRoutes);
app.use(requireAdminExceptPublicCrudGet, crudRoutes);
app.use(requireAdmin, consultaRoutes);
app.use(errorHandler);

const bootstrap = async (): Promise<void> => {
  await runMigrations();
  startRetentionScheduler();
  app.listen(config.server.port, () => {
    console.log(`Backend TypeScript corriendo en http://localhost:${config.server.port}`);
  });
};

bootstrap().catch((error) => {
  console.error("No se pudo iniciar backend-ts:", error);
  process.exit(1);
});
