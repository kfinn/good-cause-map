import postgres, { MaybeRow, PendingQuery, Sql } from "postgres";

export default function connect(databaseUrl: string) {
  return postgres(databaseUrl, {
    transform: postgres.camel,
    connection: {
      application_name: "good-cause-map",
      statement_timeout: 5000,
      search_path: "public,wow",
    },
  });
}

export async function withConnection<Result>(
  databaseUrl: string,
  callback: (sql: Sql) => Promise<Result>
) {
  const sql = connect(databaseUrl);
  try {
    return await callback(sql);
  } finally {
    await sql.end();
  }
}

export async function executeWithAbortSignal<
  Result extends readonly MaybeRow[]
>(
  pendingQuery: PendingQuery<Result>,
  abortSignal: AbortSignal
): Promise<Result> {
  const query = pendingQuery.execute();
  const abortListener = () => query.cancel();
  abortSignal.addEventListener("abort", abortListener);
  const result = await query;
  abortSignal.removeEventListener("abort", abortListener);
  return result;
}
