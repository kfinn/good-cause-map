import connect from ".";

export async function getBuildingsCount(
  databaseUrl: string,
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
  const sql = connect(databaseUrl);

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

export async function getBuildings(
  databaseUrl: string,
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
  const sql = connect(databaseUrl);

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

const CLUSTERS_COUNT = 24 * 24;

export async function getBuildingClusters(
  databaseUrl: string,
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
  const totalSpan = latitudeSpan + longitudeSpan;
  const latitudeClustersCount = Math.max(
    1,
    Math.round((CLUSTERS_COUNT * latitudeSpan) / totalSpan)
  );
  const latitudeDivision = latitudeSpan / latitudeClustersCount;
  const longitudeClustersCount = Math.max(
    1,
    Math.round((CLUSTERS_COUNT * longitudeSpan) / totalSpan)
  );
  const longitudeDivision = longitudeSpan / longitudeClustersCount;

  const sql = connect(databaseUrl);

  return await sql`
    WITH variables AS (
      SELECT * FROM (
        VALUES
          (
            ${west}::double precision,
            ${north}::double precision,
            ${east}::double precision,
            ${south}::double precision,
            ${latitudeClustersCount}::integer,
            ${longitudeClustersCount}::integer,
            ${latitudeDivision}::double precision,
            ${longitudeDivision}::double precision
          )
      ) AS variables(west, north, east, south, latitude_clusters_count, longitude_clusters_count, latitude_division, longitude_division)
    )
    SELECT
        COALESCE(SUM(pluto_latest.unitsres), 0)::bigint AS unitsres,
        WIDTH_BUCKET(pluto_latest.latitude, variables.south, variables.north, variables.latitude_clusters_count) * variables.latitude_division::double precision - (variables.latitude_division::double precision / 2) + variables.south::double precision AS latitude,
        WIDTH_BUCKET(pluto_latest.longitude, variables.west, variables.east, variables.longitude_clusters_count) * variables.longitude_division::double precision - (variables.longitude_division::double precision / 2) + variables.west::double precision AS longitude,
        COALESCE(SUM(rentstab_v2.uc2022), 0) AS rentstab_v2_uc2022,
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
        pluto_latest
        CROSS JOIN variables
        LEFT JOIN rentstab_v2 ON rentstab_v2.ucbbl = pluto_latest.bbl
        LEFT JOIN fc_shd_building ON fc_shd_building.bbl = pluto_latest.bbl
    WHERE
        pluto_latest.longitude > variables.west
        AND pluto_latest.latitude < variables.north
        AND pluto_latest.longitude < variables.east
        AND pluto_latest.latitude > variables.south
    GROUP BY
        WIDTH_BUCKET(pluto_latest.latitude, variables.south, variables.north, variables.latitude_clusters_count) * variables.latitude_division::double precision - (variables.latitude_division::double precision / 2) + variables.south::double precision,
        WIDTH_BUCKET(pluto_latest.longitude, variables.west, variables.east, variables.longitude_clusters_count) * variables.longitude_division::double precision - (variables.longitude_division::double precision / 2) + variables.west::double precision
  `;
}
