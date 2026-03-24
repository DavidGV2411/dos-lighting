import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { pool } from "./pool.js";

type MigrationFile = {
  version: string;
  absolutePath: string;
};

const versionFromFileName = (fileName: string): string | null => {
  const match = /^V(\d+)__.*\.sql$/i.exec(fileName);
  return match?.[1] ?? null;
};

const sortByVersion = (left: MigrationFile, right: MigrationFile): number =>
  Number.parseInt(left.version, 10) - Number.parseInt(right.version, 10);

export const runMigrations = async (): Promise<void> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ts_schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const dirEntries = await fs.readdir(config.migrationsDir, { withFileTypes: true });
  const files: MigrationFile[] = dirEntries
    .filter((entry) => entry.isFile())
    .map((entry) => ({
      name: entry.name,
      version: versionFromFileName(entry.name),
      absolutePath: path.resolve(config.migrationsDir, entry.name)
    }))
    .filter((entry): entry is { name: string; version: string; absolutePath: string } => entry.version != null)
    .map(({ version, absolutePath }) => ({ version, absolutePath }))
    .sort(sortByVersion);

  const appliedRows = await pool.query<{ version: string }>(
    "SELECT version FROM ts_schema_migrations"
  );
  const appliedVersions = new Set(appliedRows.rows.map((row: { version: string }) => row.version));

  if (appliedVersions.size === 0) {
    const flywayTable = await pool.query<{ ok: number }>(
      `
      SELECT 1 AS ok
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'flyway_schema_history'
      LIMIT 1
      `
    );

    if (flywayTable.rows.length > 0) {
      const flywayVersions = await pool.query<{ version: string }>(
        `
        SELECT version
        FROM flyway_schema_history
        WHERE success = true
          AND version IS NOT NULL
        `
      );

      for (const row of flywayVersions.rows) {
        await pool.query(
          "INSERT INTO ts_schema_migrations(version) VALUES ($1) ON CONFLICT (version) DO NOTHING",
          [row.version]
        );
        appliedVersions.add(row.version);
      }
    }
  }

  for (const migration of files) {
    if (appliedVersions.has(migration.version)) {
      continue;
    }

    const sql = await fs.readFile(migration.absolutePath, "utf8");
    await pool.query(sql);
    await pool.query("INSERT INTO ts_schema_migrations(version) VALUES ($1)", [migration.version]);
    console.log(`Migration applied V${migration.version}`);
  }
};
