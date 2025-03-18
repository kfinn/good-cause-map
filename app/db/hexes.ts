import { Sql } from "postgres";
import { BoundingBox } from "~/helpers";
import connect, { executeWithAbortSignal } from ".";

export async function getHexes(
  sql: Sql,
  signal: AbortSignal,
  { zoom, west, north, east, south }: BoundingBox
) {
  return await executeWithAbortSignal(
    sql`
        SELECT *
        FROM gce_eligibility_hexes
        WHERE zoom_level = ${zoom}
        AND ST_MakeEnvelope(${west}, ${south}, ${east}, ${north}, 4326) ~ geom
      `,
    signal
  );
}

export async function* getHexBuildings(
  databaseUrl: string,
  signal: AbortSignal,
  zoomLevel: number,
  longitude: number,
  latitude: number
) {
  const sql = connect(databaseUrl);

  try {
    const cursor = sql`
      SELECT gce_eligibility.* FROM gce_eligibility
      JOIN gce_eligibility_hexes ON ST_Within(gce_eligibility.geom, gce_eligibility_hexes.geom)
      WHERE gce_eligibility_hexes.zoom_level = ${zoomLevel}
      AND ST_Within(ST_Point(${longitude}, ${latitude}, 4326), gce_eligibility_hexes.geom)
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
