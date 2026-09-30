import { DatabaseSync } from "node:sqlite";
import { MatchDurableObject } from "../../../worker/matches/match-do";

/**
 * Creates an in-memory DO storage adapter backed by node:sqlite DatabaseSync.
 */
export function createMockDOStorage(sqlite: DatabaseSync) {
  return {
    sql: {
      exec(query: string, ...bindings: any[]) {
        const trimmed = query.trim().toUpperCase();
        if (trimmed.startsWith("SELECT") || trimmed.startsWith("PRAGMA")) {
          const stmt = sqlite.prepare(query);
          const rows = stmt.all(...bindings);
          return {
            toArray: () => rows,
            one: () => rows[0],
            raw: () => rows.map((r) => Object.values(r as any)),
            columnNames: [],
            rowsRead: rows.length,
            rowsWritten: 0,
          };
        } else {
          // For CREATE TABLE statements or multi-statement exec
          if (query.includes(";")) {
            sqlite.exec(query);
            return {
              toArray: () => [],
              one: () => null,
              raw: () => [],
              columnNames: [],
              rowsRead: 0,
              rowsWritten: 0,
            };
          }
          const stmt = sqlite.prepare(query);
          const info = stmt.run(...bindings);
          return {
            toArray: () => [],
            one: () => null,
            raw: () => [],
            columnNames: [],
            rowsRead: 0,
            rowsWritten: Number(info.changes),
          };
        }
      },
    },
    transactionSync<T>(fn: () => T): T {
      sqlite.exec("BEGIN");
      try {
        const result = fn();
        sqlite.exec("COMMIT");
        return result;
      } catch (err) {
        sqlite.exec("ROLLBACK");
        throw err;
      }
    },
    sync: async () => {},
  };
}

/**
 * Creates a mock DurableObjectNamespace for MATCH_DO in tests.
 */
export function createMockDONamespace(envProvider: () => any) {
  const instances = new Map<string, { do: MatchDurableObject; sqlite: DatabaseSync; state: any }>();

  return {
    idFromName(name: string) {
      return { toString: () => name, name };
    },
    get(id: { toString: () => string; name?: string }) {
      const name = id.toString();
      if (!instances.has(name)) {
        const sqlite = new DatabaseSync(":memory:");
        const storage = createMockDOStorage(sqlite);
        const state = {
          storage,
          id,
          waitUntil: (p: Promise<any>) => p.catch(() => {}),
        };
        const env = envProvider();
        const doInstance = new MatchDurableObject(state as any, env);
        instances.set(name, { do: doInstance, sqlite, state });
      }
      const item = instances.get(name)!;
      return {
        fetch: (req: Request) => item.do.fetch(req),
      };
    },
    _instances: instances,
  };
}
