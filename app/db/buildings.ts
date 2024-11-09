import { Sql } from "postgres";
import connect from ".";

interface BoundingBox {
  west: number;
  north: number;
  east: number;
  south: number;
}

const MAX_BUILDINGS = 128 * 128 * 2;

export async function getBuildingsOrClusters(
  databaseUrl: string,
  boundingBox: BoundingBox
) {
  const sql = connect(databaseUrl);

  const buildingsCount = await getBuildingsCount(sql, boundingBox);
  const result =
    buildingsCount > MAX_BUILDINGS
      ? { clusters: await getBuildingClusters(sql, boundingBox) }
      : { buildings: await getBuildings(sql, boundingBox) };

  sql.end();
  return result;
}

async function getBuildingsCount(
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
          COUNT(*) as buildings_count
      FROM
          pluto_latest
          LEFT JOIN rentstab_v2 ON rentstab_v2.ucbbl = pluto_latest.bbl
          LEFT JOIN fc_shd_building ON fc_shd_building.bbl = pluto_latest.bbl
      WHERE
          pluto_latest.longitude > ${west}::double precision
          AND pluto_latest.latitude < ${north}::double precision
          AND pluto_latest.longitude < ${east}::double precision
          AND pluto_latest.latitude > ${south}::double precision
  `;

  return results[0]!.buildingsCount as number;
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
        pluto_latest.bbl AS bbl,
        pluto_latest.address AS address,
        pluto_latest.unitsres AS unitsres,
        pluto_latest.yearbuilt AS yearbuilt,
        pluto_latest.bldgclass AS bldgclass,
        pluto_latest.latitude AS latitude,
        pluto_latest.longitude AS longitude,
        COALESCE(rentstab_v2.uc2022, 0) AS rentstab_v2_uc2022,
        COALESCE(fc_shd_building.datahcrlihtc, false)
        OR COALESCE(fc_shd_building.datahpd, false)
        OR COALESCE(fc_shd_building.datahudlihtc, false)
        OR COALESCE(fc_shd_building.datahudcon, false)
        OR COALESCE(fc_shd_building.datahudfin, false)
        OR COALESCE(fc_shd_building.dataml, false)
        OR COALESCE(fc_shd_building.datanycha, false) AS fc_is_subsidized,
        pluto_latest.yearbuilt < 2009
        AND pluto_latest.unitsres >= 10
        AND pluto_latest.bldgclass IN (
          'C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C7', 'C9', 'CB', 'CM',
          'D1', 'D2', 'D3', 'D5', 'D6', 'D7', 'D8', 'D9', 'DB',
          'S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S9'
        )
        AND NOT (
          COALESCE(fc_shd_building.datahcrlihtc, false)
          OR COALESCE(fc_shd_building.datahpd, false)
          OR COALESCE(fc_shd_building.datahudlihtc, false)
          OR COALESCE(fc_shd_building.datahudcon, false)
          OR COALESCE(fc_shd_building.datahudfin, false)
          OR COALESCE(fc_shd_building.dataml, false)
          OR COALESCE(fc_shd_building.datanycha, false)
        ) AS is_eligible_for_good_cause_eviction
    FROM
        pluto_latest
        LEFT JOIN rentstab_v2 ON rentstab_v2.ucbbl = pluto_latest.bbl
        LEFT JOIN fc_shd_building ON fc_shd_building.bbl = pluto_latest.bbl
    WHERE
        pluto_latest.longitude > ${west}::double precision
        AND pluto_latest.latitude < ${north}::double precision
        AND pluto_latest.longitude < ${east}::double precision
        AND pluto_latest.latitude > ${south}::double precision
  `;
}

const TARGET_CLUSTERS_COUNT = 20000;

async function getBuildingClusters(
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
  const latitudeSpan = north - south;
  const longitudeSpan = east - west;
  const approximateArea = latitudeSpan * longitudeSpan;
  const hexSize = Math.sqrt(approximateArea / TARGET_CLUSTERS_COUNT);

  return await sql`
    SELECT
        COALESCE(SUM(pluto_latest.unitsres), 0)::integer AS unitsres,
        COUNT(*)::integer as buildings_count,
        ST_X(ST_Centroid(hexes.geom))::double precision as longitude,
        ST_Y(ST_Centroid(hexes.geom))::double precision as latitude,
        COALESCE(SUM(rentstab_v2.uc2022), 0)::integer AS rentstab_v2_uc2022,
        SUM(
            CASE WHEN (
                COALESCE(fc_shd_building.datahcrlihtc, false)
                OR COALESCE(fc_shd_building.datahpd, false)
                OR COALESCE(fc_shd_building.datahudlihtc, false)
                OR COALESCE(fc_shd_building.datahudcon, false)
                OR COALESCE(fc_shd_building.datahudfin, false)
                OR COALESCE(fc_shd_building.dataml, false)
                OR COALESCE(fc_shd_building.datanycha, false)
            ) THEN 1 ELSE 0 END
        )::integer AS fc_is_subsidized_count,
        SUM(
            CASE WHEN (
                pluto_latest.yearbuilt < 2009
                AND pluto_latest.unitsres >= 10
                AND pluto_latest.bldgclass IN (
                    'C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C7', 'C9', 'CB', 'CM',
                    'D1', 'D2', 'D3', 'D5', 'D6', 'D7', 'D8', 'D9', 'DB',
                    'S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S9'
                )
                AND NOT (
                    COALESCE(fc_shd_building.datahcrlihtc, false)
                    OR COALESCE(fc_shd_building.datahpd, false)
                    OR COALESCE(fc_shd_building.datahudlihtc, false)
                    OR COALESCE(fc_shd_building.datahudcon, false)
                    OR COALESCE(fc_shd_building.datahudfin, false)
                    OR COALESCE(fc_shd_building.dataml, false)
                    OR COALESCE(fc_shd_building.datanycha, false)
                )
            ) THEN 1 ELSE 0 END
        )::integer AS is_eligible_for_good_cause_eviction_count
    FROM
        ST_HexagonGrid(${hexSize}, ST_MakeEnvelope(${west}, ${south}, ${east}, ${north})) AS hexes
        JOIN pluto_latest ON hexes.geom ~ ST_POINT(pluto_latest.longitude, pluto_latest.latitude)
        LEFT JOIN rentstab_v2 ON rentstab_v2.ucbbl = pluto_latest.bbl
        LEFT JOIN fc_shd_building ON fc_shd_building.bbl = pluto_latest.bbl
    WHERE
        pluto_latest.longitude > ${west}::double precision
        AND pluto_latest.latitude < ${north}::double precision
        AND pluto_latest.longitude < ${east}::double precision
        AND pluto_latest.latitude > ${south}::double precision
    GROUP BY
        hexes.geom
  `;
}
