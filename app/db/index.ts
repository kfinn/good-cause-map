import postgres from "postgres";

export default function connect(databaseUrl: string) {
  return postgres(databaseUrl, { transform: postgres.camel });
}
