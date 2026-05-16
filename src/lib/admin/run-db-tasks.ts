/**
 * Neon serverless HTTP driver acquires a DB "permit" per in-flight query. Running
 * many `Promise.all` DB calls at once can exceed Neon limits and fail with
 * "Too many database connection attempts are currently ongoing".
 */
type FactoryResult<F> = F extends () => Promise<infer R> ? Awaited<R> : never;

type ResultsTuple<T extends readonly unknown[]> = T extends readonly [
  infer Head extends () => Promise<unknown>,
  ...infer Tail,
]
  ? Tail extends readonly (() => Promise<unknown>)[]
    ? [FactoryResult<Head>, ...ResultsTuple<Tail>]
    : [FactoryResult<Head>]
  : [];

export async function runDbTasksWithConcurrencyLimit<
  T extends readonly (() => Promise<unknown>)[],
>(factories: T, limit: number): Promise<ResultsTuple<T>> {
  const results: unknown[] = new Array(factories.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = next++;
      if (i >= factories.length) return;
      results[i] = await factories[i]!();
    }
  }

  const n = Math.min(Math.max(1, limit), factories.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results as ResultsTuple<T>;
}

/** Max concurrent Neon HTTP queries for admin dashboard batches. */
export const ADMIN_DASHBOARD_DB_CONCURRENCY = 4;
