import { Sql } from "postgres";
import connect from ".";

interface BoundingBox {
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

  const clampedBoundingBox = {
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
        post_hsta_rs_units::integer,
        co_issued::date,
        bldgclass,
        wow_portfolio_units::integer,
        wow_portfolio_bbls::integer,
        ST_AsGeoJSON(geom)::json AS geom,
        eligible
    FROM
        gce_eligibility
    WHERE
        ST_MakeEnvelope(${west}, ${south}, ${east}, ${north}, 4326) ~ geom
  `;
}

const TARGET_CLUSTERS_COUNT = 20000;

async function getBuildingClusters(
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
  const latitudeSpan = north - south;
  const longitudeSpan = east - west;
  const approximateArea = latitudeSpan * longitudeSpan;
  const hexSize = Math.sqrt(approximateArea / TARGET_CLUSTERS_COUNT);

  const query = sql`
    SELECT
        COALESCE(SUM(unitsres), 0)::integer AS unitsres,
        COALESCE(SUM(post_hsta_rs_units), 0)::integer AS post_hsta_rs_units,
        ST_X(ST_Centroid(hexes.geom))::double precision AS longitude,
        ST_Y(ST_Centroid(hexes.geom))::double precision AS latitude,
        ST_AsGeoJSON(hexes.geom)::json as geom,
        COUNT(gce_eligibility.*)::integer AS bbls_count,
        MAX(co_issued)::date AS max_co_issued,
        MIN(co_issued)::date AS min_co_issued,
        SUM(CASE WHEN eligible THEN unitsres ELSE 0 END)::integer AS eligible_units_count,
        SUM(CASE WHEN eligible THEN 1 ELSE 0 END)::integer AS eligible_bbls_count
    FROM
        ST_HexagonGrid(${hexSize}, ST_MakeEnvelope(${west}, ${south}, ${east}, ${north}, 4326)) AS hexes
        JOIN gce_eligibility ON hexes.geom ~ gce_eligibility.geom
    GROUP BY
        hexes.geom
    HAVING count(gce_eligibility.*) > 0
  `.execute();

  const abortListener = () => query.cancel();
  signal.addEventListener("abort", abortListener);
  const result = await query;
  signal.removeEventListener("abort", abortListener);
  return result;
}
