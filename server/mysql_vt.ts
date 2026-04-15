import mysql from 'mysql2/promise';

let _pool: mysql.Pool | null = null;

export function getMysqlPool(): mysql.Pool {
  if (_pool) return _pool;
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set');
  // Parse mysql://user:pass@host:port/db?ssl=...
  const url = new URL(dbUrl);
  _pool = mysql.createPool({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: true },
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
  });
  return _pool;
}

export async function mysqlQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const pool = getMysqlPool();
  const [rows] = await pool.execute(sql, params);
  return rows as T[];
}

export async function mysqlExecute(sql: string, params: any[] = []): Promise<mysql.ResultSetHeader> {
  const pool = getMysqlPool();
  const [result] = await pool.execute(sql, params);
  return result as mysql.ResultSetHeader;
}
