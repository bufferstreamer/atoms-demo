interface D1Meta { changes: number; }
interface D1Result<T = unknown> { results?: T[]; meta: D1Meta; }
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}
interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}
interface Fetcher { fetch(request: Request): Promise<Response>; }

declare module "cloudflare:workers" {
  export const env: { DB: D1Database; [key: string]: unknown };
}
