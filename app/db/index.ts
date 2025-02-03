import postgres from "postgres";

export default function connect(databaseUrl: string) {
  return postgres(databaseUrl, {
    transform: postgres.camel,
    connection: { application_name: "good-cause-map", statement_timeout: 5000, search_path: 'public,wow' },
  });
}
