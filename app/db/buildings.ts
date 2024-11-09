import { QueryTypes } from "sequelize";
import sequelize from ".";

export async function getBuildingsCount({
  west,
  north,
  east,
  south,
}: {
  west: number;
  north: number;
  east: number;
  south: number;
}) {
  const results = await sequelize.query<{ buildingsCount: number }>(
    `
        SELECT
            COUNT(*) as buildings_count
        FROM
            pluto_latest
            LEFT JOIN rentstab_v2 ON rentstab_v2.ucbbl = pluto_latest.bbl
            LEFT JOIN fc_shd_building ON fc_shd_building.bbl = pluto_latest.bbl
        WHERE
            pluto_latest.longitude > $west
            AND pluto_latest.latitude < $north
            AND pluto_latest.longitude < $east
            AND pluto_latest.latitude > $south
    `,
    {
      type: QueryTypes.SELECT,
      fieldMap: { buildings_count: "buildingsCount" },
      bind: { west, north, east, south },
    }
  );

  return results[0]!.buildingsCount as number;
}

export async function getBuildings({
  west,
  north,
  east,
  south,
}: {
  west: number;
  north: number;
  east: number;
  south: number;
}) {
  return await sequelize.query<{
    bbl: string;
    address: string;
    unitsres: number;
    yearbuilt: number;
    bldgclass: number;
    latitude: number;
    longitude: number;
    rentstabV2Uc2022: number;
    fcIsSubsidized: boolean;
    isEligibleForGoodCauseEviction: boolean;
  }>(
    `
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
            pluto_latest.longitude > $west
            AND pluto_latest.latitude < $north
            AND pluto_latest.longitude < $east
            AND pluto_latest.latitude > $south
      `,
    {
      type: QueryTypes.SELECT,
      fieldMap: {
        rentstab_v2_uc2022: "rentstabV2Uc2022",
        fc_is_subsidized: "fcIsSubsidized",
        is_eligible_for_good_cause_eviction: "isEligibleForGoodCauseEviction",
      },
      bind: { west, north, east, south },
    }
  );
}

const CLUSTERS_COUNT = 32 * 32;

export async function getBuildingClusters({
  west,
  north,
  east,
  south,
}: {
  west: number;
  north: number;
  east: number;
  south: number;
}) {
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

  return await sequelize.query<{
    unitsres: number;
    latitude: number;
    longitude: number;
    rentstabV2Uc2022: number;
    fcIsSubsidizedCount: boolean;
    isEligibleForGoodCauseEvictionCount: boolean;
  }>(
    `
      SELECT
          COALESCE(SUM(pluto_latest.unitsres), 0)::bigint AS unitsres,
          $south::double precision + WIDTH_BUCKET(pluto_latest.latitude, $south, $north, $latitudeClustersCount) * $latitudeDivision::double precision - ($latitudeDivision::double precision / 2) AS latitude,
          $west::double precision + WIDTH_BUCKET(pluto_latest.longitude, $west, $east, $longitudeClustersCount) * $longitudeDivision::double precision - ($longitudeDivision::double precision / 2) AS longitude,
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
          LEFT JOIN rentstab_v2 ON rentstab_v2.ucbbl = pluto_latest.bbl
          LEFT JOIN fc_shd_building ON fc_shd_building.bbl = pluto_latest.bbl
      WHERE
          pluto_latest.longitude > $west
          AND pluto_latest.latitude < $north
          AND pluto_latest.longitude < $east
          AND pluto_latest.latitude > $south
      GROUP BY
          WIDTH_BUCKET(pluto_latest.latitude, $south, $north, $latitudeClustersCount),
          WIDTH_BUCKET(pluto_latest.longitude, $west, $east, $longitudeClustersCount)
    `,
    {
      type: QueryTypes.SELECT,
      fieldMap: {
        rentstab_v2_uc2022: "rentstabV2Uc2022",
        fc_is_subsidized_count: "fcIsSubsidizedCount",
        is_eligible_for_good_cause_eviction_count:
          "isEligibleForGoodCauseEvictionCount",
      },
      bind: {
        west,
        north,
        east,
        south,
        latitudeDivision,
        longitudeDivision,
        longitudeClustersCount,
        latitudeClustersCount,
      },
    }
  );
}
