import postgres from "postgres";

export default function connect() {
  return postgres(
    process.env.DATABASE_URL ??
      "postgresql://nycdb:nycdb@localhost:54321/nycdb",
    { transform: postgres.camel }
  );
}
