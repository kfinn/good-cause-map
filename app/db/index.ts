import postgres from "postgres";

const sql = postgres(
  process.env.DATABASE_URL ?? "postgresql://nycdb:nycdb@localhost:54321/nycdb",
  { transform: postgres.camel }
);
export default sql;
