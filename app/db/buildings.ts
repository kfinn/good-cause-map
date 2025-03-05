import { Sql } from "postgres";
import { BoundingBox } from "~/helpers";
import { executeWithAbortSignal, withConnection } from ".";

export async function getBuildingsOrClusters(
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
        clusters: await getBuildingClusters(sql, signal, clampedBoundingBox),
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

async function getBuildingClusters(
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
