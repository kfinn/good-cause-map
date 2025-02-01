import { Sql } from "postgres";
import connect from ".";

interface BoundingBox {
  zoom: number;
  west: number;
  north: number;
  east: number;
  south: number;
}

const MAX_BUILDINGS = 10000;

export async function getBuildingsOrClusters(
  databaseUrl: string,
  signal: AbortSignal,
  boundingBox: BoundingBox
) {
  const sql = connect(databaseUrl);

  const {
    buildingsCount,
    minLatitude,
    minLongitude,
    maxLatitude,
    maxLongitude,
  } = await getBuildingsStats(sql, boundingBox);

  const clampedRoundedZoom = Math.max(
    Math.min(Math.round(boundingBox.zoom), 16),
    10
  );

  const clampedBoundingBox = {
    zoom: clampedRoundedZoom,
    west: Math.max(boundingBox.west, minLongitude),
    north: Math.min(boundingBox.north, maxLatitude),
    east: Math.min(boundingBox.east, maxLongitude),
    south: Math.max(boundingBox.south, minLatitude),
  };

  const result =
    buildingsCount > MAX_BUILDINGS
      ? { clusters: await getBuildingClusters(sql, signal, clampedBoundingBox) }
      : { buildings: await getBuildings(sql, clampedBoundingBox) };

  sql.end();
  return result;
}

async function getBuildingsStats(
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
  const results = await sql`
      SELECT
          COUNT(*) as buildings_count,
          MIN(ST_Y(geom)) as min_latitude,
          MAX(ST_Y(geom)) as max_latitude,
          MIN(ST_X(geom)) as min_longitude,
          MAX(ST_X(geom)) as max_longitude
      FROM
          gce_eligibility
      WHERE
          ST_MakeEnvelope(${west}, ${south}, ${east}, ${north}, 4326) ~ geom
  `;

  return results[0]!;
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
