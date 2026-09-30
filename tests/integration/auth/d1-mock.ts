import { DatabaseSync } from "node:sqlite";

/**
 * Creates an in-memory Cloudflare D1Database compliant instance using Node.js built-in DatabaseSync.
 */
export function createMockD1Database(db?: DatabaseSync): D1Database {
  const sqlite = db ?? new DatabaseSync(":memory:");

  return {
    prepare(sql: string) {
      let boundArgs: any[] = [];
      return {
        bind(...args: any[]) {
          boundArgs = args;
          return this;
        },
        async first<T = unknown>(colName?: string): Promise<T | null> {
          const stmt = sqlite.prepare(sql);
          const row = stmt.get(...boundArgs) as Record<string, unknown> | undefined;
          if (!row) return null;
          if (colName) return (row[colName] as T) ?? null;
          return row as T;
        },
        async all<T = unknown>(): Promise<D1Result<T>> {
          const stmt = sqlite.prepare(sql);
          const results = stmt.all(...boundArgs) as T[];
          return {
            results,
            success: true,
            meta: {
              duration: 0,
              changes: 0,
              last_row_id: 0,
              rows_read: results.length,
              rows_written: 0,
            } as any,
          };
        },
        async run(): Promise<D1Response> {
          const stmt = sqlite.prepare(sql);
          const info = stmt.run(...boundArgs);
          return {
            success: true,
            meta: {
              duration: 0,
              changes: info.changes,
              last_row_id: Number(info.lastInsertRowid),
              rows_read: 0,
              rows_written: info.changes,
            } as any,
          };
        },
        async raw<T = unknown>(): Promise<T[]> {
          const stmt = sqlite.prepare(sql);
          return stmt.all(...boundArgs) as unknown as T[];
        },
      } as unknown as D1PreparedStatement;
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      const results: D1Result<T>[] = [];
      sqlite.exec("BEGIN TRANSACTION");
      try {
        for (const stmt of statements) {
          const res = await stmt.all<T>();
          results.push(res);
        }
        sqlite.exec("COMMIT");
      } catch (err) {
        sqlite.exec("ROLLBACK");
        throw err;
      }
      return results;
    },
    async exec(sql: string): Promise<D1ExecResult> {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
    dump: async () => new ArrayBuffer(0),
  } as unknown as D1Database;
}
