import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
export class LocalD1 {
  constructor(path = ":memory:") {
    this.raw = new DatabaseSync(path);
    this.raw.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;");
  }
  prepare(sql) {
    const self = this;
    const create = (params = []) => ({
      sql,
      params,
      bind(...args) {
        return create(args);
      },
      async first(column) {
        const row = self.raw.prepare(sql).get(...params) || null;
        return column ? row?.[column] : row;
      },
      async all() {
        return {
          success: true,
          results: self.raw.prepare(sql).all(...params),
          meta: {},
        };
      },
      async run() {
        const result = self.raw.prepare(sql).run(...params);
        return {
          success: true,
          meta: { changes: Number(result.changes) },
          results: [],
        };
      },
    });
    return create();
  }
  async batch(statements) {
    this.raw.exec("BEGIN IMMEDIATE");
    try {
      const results = [];
      for (const s of statements) {
        const result = this.raw.prepare(s.sql).run(...s.params);
        results.push({
          success: true,
          meta: { changes: Number(result.changes) },
          results: [],
        });
      }
      this.raw.exec("COMMIT");
      return results;
    } catch (e) {
      this.raw.exec("ROLLBACK");
      throw e;
    }
  }
  async exec(sql) {
    this.raw.exec(sql);
    return { count: 1, duration: 0 };
  }
  migrate() {
    this.raw.exec(
      "CREATE TABLE IF NOT EXISTS runtime_migrations(name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
    );
    for (const name of readdirSync("db/migrations")
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      if (
        this.raw
          .prepare("SELECT name FROM runtime_migrations WHERE name=?")
          .get(name)
      )
        continue;
      this.raw.exec("BEGIN");
      try {
        this.raw.exec(
          readFileSync("db/migrations/" + name, "utf8").replace(
            "CREATE TABLE runtime_migrations",
            "CREATE TABLE IF NOT EXISTS runtime_migrations",
          ),
        );
        this.raw
          .prepare(
            "INSERT INTO runtime_migrations(name,applied_at) VALUES(?,?)",
          )
          .run(name, new Date().toISOString());
        this.raw.exec("COMMIT");
      } catch (e) {
        this.raw.exec("ROLLBACK");
        throw e;
      }
    }
  }
  close() {
    this.raw.close();
  }
}
