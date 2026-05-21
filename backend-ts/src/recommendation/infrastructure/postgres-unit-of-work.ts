import { withTransaction } from "../../db/pool.js";
import type { TransactionManager } from "../application/ports.js";

export class PostgresUnitOfWork implements TransactionManager {
  async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    return withTransaction(async () => work());
  }
}
