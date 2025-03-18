import { Sql } from "postgres";
import { BoundingBox } from "~/helpers";
import { executeWithAbortSignal, withConnection } from ".";
import { getHexes } from "./hexes";

export async function getBuildingsOrHexes(
  databaseUrl: string,
  signal: AbortSignal,
  boundingBox: BoundingBox
) {
  const clampedRoundedZoom = Math.max(
    Math.min(Math.round(boundingBox.zoom), 16),
    10
  );

  const clampedBoundingBox = {
    ...boundingBox,
    zoom: clampedRoundedZoom,
  };

  return await withConnection(databaseUrl, async (sql) => {
    if (Math.round(boundingBox.zoom) <= 16) {
      return {
        hexes: await getHexes(sql, signal, clampedBoundingBox),
      };
    } else {
      return { buildings: await getBuildings(sql, signal, clampedBoundingBox) };
    }
  });
}

async function getBuildings(
  sql: Sql,
  signal: AbortSignal,
  {
    west,
    north,
    east,
    south,
  }: {
    west: number;
    north: number;
    east: number;
    south: number;
  }
) {
  return await executeWithAbortSignal(
    sql`
      SELECT
          bbl,
          ST_X(geom)::double precision AS longitude,
          ST_Y(geom)::double precision AS latitude,
          address,
          unitsres::integer,
          post_hstpa_rs_units::integer,
          co_issued::date,
          bldgclass,
          wow_portfolio_units::integer,
          wow_portfolio_bbls::integer,
          ST_AsGeoJSON(geom)::json AS geom_json,
          eligible
      FROM
          gce_eligibility
      WHERE
          ST_MakeEnvelope(${west}, ${south}, ${east}, ${north}, 4326) ~ geom
    `,
    signal
  );
}
