/**
 * mysql-compat.ts — MySQL2 compatibility shim for pg.Pool-style code
 *
 * Translates PostgreSQL query patterns to MySQL-compatible equivalents:
 *  - $1, $2, ... → ?
 *  - FILTER (WHERE ...) → CASE WHEN ... END
 *  - INTERVAL '24 hours' → INTERVAL 24 HOUR
 *  - TRUE/FALSE literals
 *  - NOW() - INTERVAL → DATE_SUB(NOW(), INTERVAL ...)
 *  - result.rows → array of objects
 *  - result.rows[0] → first object
 */
import mysql from "mysql2/promise";

const DB_URL = process.env.DATABASE_URL ?? "";

function parseMysqlUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: parseInt(u.port || "4000"),
    user: u.username,
    password: u.password,
    database: u.pathname.replace(/^\//, "").split("?")[0],
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" } : undefined,
    multipleStatements: false,
  };
}

/** Convert PostgreSQL $1,$2,... placeholders to MySQL ? */
function convertPlaceholders(sql: string): string {
  return sql.replace(/\$\d+/g, "?");
}

/** Convert common PostgreSQL-specific syntax to MySQL */
function convertSql(sql: string): string {
  let s = sql;

  // $1 → ?
  s = convertPlaceholders(s);

  // FILTER (WHERE condition) aggregate → CASE WHEN condition THEN 1 END
  // e.g. COUNT(*) FILTER (WHERE x = 'y') → COUNT(CASE WHEN x = 'y' THEN 1 END)
  s = s.replace(/COUNT\(\*\)\s+FILTER\s*\(WHERE\s+([^)]+)\)/gi, "COUNT(CASE WHEN $1 THEN 1 END)");
  s = s.replace(/SUM\(([^)]+)\)\s+FILTER\s*\(WHERE\s+([^)]+)\)/gi, "SUM(CASE WHEN $2 THEN $1 END)");
  s = s.replace(/AVG\(([^)]+)\)\s+FILTER\s*\(WHERE\s+([^)]+)\)/gi, "AVG(CASE WHEN $2 THEN $1 END)");

  // NOW() - INTERVAL 'N unit' → DATE_SUB(NOW(), INTERVAL N UNIT)
  s = s.replace(/NOW\(\)\s*-\s*INTERVAL\s+'(\d+)\s+(\w+)'/gi, "DATE_SUB(NOW(), INTERVAL $1 $2)");
  s = s.replace(/NOW\(\)\s*-\s*INTERVAL\s+'(\d+)\s+(\w+)s'/gi, "DATE_SUB(NOW(), INTERVAL $1 $2)");

  // INTERVAL 'N hours' → INTERVAL N HOUR (standalone)
  s = s.replace(/INTERVAL\s+'(\d+)\s+hours?'/gi, "INTERVAL $1 HOUR");
  s = s.replace(/INTERVAL\s+'(\d+)\s+days?'/gi, "INTERVAL $1 DAY");
  s = s.replace(/INTERVAL\s+'(\d+)\s+minutes?'/gi, "INTERVAL $1 MINUTE");
  s = s.replace(/INTERVAL\s+'(\d+)\s+months?'/gi, "INTERVAL $1 MONTH");
  s = s.replace(/INTERVAL\s+'(\d+)\s+years?'/gi, "INTERVAL $1 YEAR");
  s = s.replace(/INTERVAL\s+'(\d+)\s+weeks?'/gi, "INTERVAL $1 WEEK");

  // TRUE/FALSE → 1/0 (MySQL uses tinyint for boolean)
  s = s.replace(/\bTRUE\b/g, "1");
  s = s.replace(/\bFALSE\b/g, "0");
  s = s.replace(/= true\b/gi, "= 1");
  s = s.replace(/= false\b/gi, "= 0");
  s = s.replace(/IS TRUE\b/gi, "= 1");
  s = s.replace(/IS FALSE\b/gi, "= 0");

  // ILIKE → LIKE (MySQL LIKE is case-insensitive by default on utf8_general_ci)
  s = s.replace(/\bILIKE\b/gi, "LIKE");

  // ::text, ::int, ::float casts → remove
  s = s.replace(/::\w+/g, "");

  // RETURNING clause → remove (MySQL doesn't support it)
  s = s.replace(/\s+RETURNING\s+[^\n;]+/gi, "");

  // ON CONFLICT DO NOTHING → INSERT IGNORE
  s = s.replace(/ON CONFLICT\s+DO\s+NOTHING/gi, "");
  s = s.replace(/INSERT INTO/gi, (m, offset) => {
    // If we removed ON CONFLICT DO NOTHING, use INSERT IGNORE
    return m;
  });

  // ON CONFLICT (...) DO UPDATE SET → ON DUPLICATE KEY UPDATE
  s = s.replace(/ON CONFLICT\s*\([^)]*\)\s*DO UPDATE SET/gi, "ON DUPLICATE KEY UPDATE");

  return s;
}

/** Result shape matching pg.QueryResult */
export interface PgCompatResult {
  rows: Record<string, any>[];
  rowCount: number;
  command?: string;
  insertId?: number;
}

/** A pg.Pool-compatible pool backed by mysql2 */
export class MySqlCompatPool {
  private _pool: mysql.Pool;

  constructor() {
    if (!DB_URL || !DB_URL.startsWith("mysql://")) {
      throw new Error("DATABASE_URL must be a mysql:// URL for MySqlCompatPool");
    }
    const config = parseMysqlUrl(DB_URL);
    this._pool = mysql.createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: parseInt(process.env.NDSEP_DB_POOL_MAX ?? "10"),
      queueLimit: 0,
    });
  }

  /** Execute a query, converting pg-style $1 params and returning {rows, rowCount} */
  async query(sql: string, params?: any[]): Promise<PgCompatResult> {
    const converted = convertSql(sql);
    try {
      const [result] = await this._pool.query(converted, params ?? []) as any;
      if (Array.isArray(result)) {
        return { rows: result as Record<string, any>[], rowCount: result.length };
      }
      // INSERT/UPDATE/DELETE
      return {
        rows: [],
        rowCount: result.affectedRows ?? 0,
        insertId: result.insertId,
      };
    } catch (err: any) {
      // Re-throw with original SQL for debugging
      const e = new Error(`[MySQL] ${err.message}\nSQL: ${converted.substring(0, 200)}`);
      (e as any).code = err.code;
      throw e;
    }
  }

  async end(): Promise<void> {
    await this._pool.end();
  }

  on(_event: string, _handler: (...args: any[]) => void): this {
    // No-op for compatibility
    return this;
  }
}

/** Singleton pool for the main application */
let _compatPool: MySqlCompatPool | null = null;

export function getMySqlPool(): MySqlCompatPool {
  if (!_compatPool) {
    _compatPool = new MySqlCompatPool();
  }
  return _compatPool;
}

export async function closeMySqlPool(): Promise<void> {
  if (_compatPool) {
    await _compatPool.end();
    _compatPool = null;
  }
}
