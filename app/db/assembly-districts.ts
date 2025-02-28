import { BoundingBox } from "~/helpers";
import connect from ".";

export async function getAssemblyDistricts(
  databaseUrl: string,
  signal: AbortSignal,
  { west, south, east, north }: BoundingBox
) {
  const sql = connect(databaseUrl);
  const query = sql`
    SELECT
      assemdist,
      geom,
      unitsres,
      post_hstpa_rs_units,
      bbls_count,
      max_co_issued,
      eligible_units_count,
      eligible_bbls_count,
      geom_json
    FROM gce_eligibility_nyad
    WHERE ST_MakeEnvelope(${west}, ${south}, ${east}, ${north}, 4326) && geom
  `.execute();

  const abortListener = () => query.cancel();
  signal.addEventListener("abort", abortListener);
  const result = await query;
  signal.removeEventListener("abort", abortListener);
  return result;
}
