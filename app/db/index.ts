import postgres from "postgres";

export default function connect() {
  console.log(process.env.DATABASE_URL);
  return postgres(
    process.env.DATABASE_URL ??
      "postgresql://nycdb:nycdb@localhost:54321/nycdb",
    { transform: postgres.camel }
  );
}
