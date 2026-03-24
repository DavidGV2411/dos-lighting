import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { config } from "../config.js";

export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password
});

export const query = async <T extends QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> => {
  const result = await pool.query<T>(text, params);
  return result.rows;
};

export const queryOne = async <T extends QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T | null> => {
  const result = await pool.query<T>(text, params);
  return result.rows[0] ?? null;
};

export const withTransaction = async <T>(work: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

