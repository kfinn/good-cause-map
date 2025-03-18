import { BoundingBox } from "~/helpers";
import connect, { executeWithAbortSignal, withConnection } from ".";

export interface CityCouncilDistrictStats {
  coundist: number;
  latitude: number;
  longitude: number;
  geomJson: GeoJSON.Geometry;
  bblsCount: number;
  eligibleUnitsCount: number;
  unitsres: number;
  postHstpaRsUnits: number;
  minCoIssued: string;
  maxCoIssued: string;
}

export async function getCityCouncilDistricts(
  databaseUrl: string,
  signal: AbortSignal,
  { west, south, east, north }: BoundingBox
) {
  return withConnection(databaseUrl, async (sql) => {
    return await executeWithAbortSignal<CityCouncilDistrictStats[]>(
      sql`
        SELECT
          coundist,
          geom,
          longitude,
          latitude,
          unitsres,
          post_hstpa_rs_units,
          bbls_count,
          max_co_issued,
          eligible_units_count,
          eligible_bbls_count,
          geom_json
        FROM gce_eligibility_nycc
        WHERE ST_MakeEnvelope(${west}, ${south}, ${east}, ${north}, 4326) && geom
      `,
      signal
    );
  });
}

export async function* getCityCouncilDistrictBuildings(
  databaseUrl: string,
  signal: AbortSignal,
  coundist: number
) {
  const sql = connect(databaseUrl);
  try {
    const cursor = sql`
      SELECT gce_eligibility.* FROM gce_eligibility
      JOIN pluto_latest_districts ON pluto_latest_districts.bbl = gce_eligibility.bbl
      WHERE pluto_latest_districts.coun_dist = ${coundist}::text
  `.cursor();
    for await (const [building] of cursor) {
      if (signal.aborted) {
        break;
      }
      yield building;
    }
  } finally {
    await sql.end();
  }
}
