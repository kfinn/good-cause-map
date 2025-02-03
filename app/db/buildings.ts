import { Sql } from "postgres";
import connect from ".";

interface BoundingBox {
  zoom: number;
  west: number;
  north: number;
  east: number;
  south: number;
}

export async function getBuildingsOrClusters(
  databaseUrl: string,
  signal: AbortSignal,
  boundingBox: BoundingBox
) {
  const sql = connect(databaseUrl);

  const clampedRoundedZoom = Math.max(
    Math.min(Math.round(boundingBox.zoom), 16),
    10
  );

  const clampedBoundingBox = {
    ...boundingBox,
    zoom: clampedRoundedZoom,
  };

  const result =
    Math.round(boundingBox.zoom) <= 16
      ? { clusters: await getBuildingClusters(sql, signal, clampedBoundingBox) }
      : { buildings: await getBuildings(sql, clampedBoundingBox) };

  sql.end();
  return result;
}

async function getBuildings(
  sql: Sql,
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
  return await sql`
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
  `;
}

async function getBuildingClusters(
  sql: Sql,
  signal: AbortSignal,
  { zoom, west, north, east, south }: BoundingBox
) {
  const query = sql`
    SELECT *
    FROM gce_eligibility_hexes
    WHERE zoom_level = ${zoom}
    AND ST_MakeEnvelope(${west}, ${south}, ${east}, ${north}, 4326) ~ geom
  `.execute();

  const abortListener = () => query.cancel();
  signal.addEventListener("abort", abortListener);
  const result = await query;
  signal.removeEventListener("abort", abortListener);
  return result;
}
