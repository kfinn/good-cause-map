CREATE INDEX index_pluto_latest_districts_on_assem_dist_integer ON pluto_latest_districts (("assem_dist" :: integer));
CREATE INDEX index_pluto_latest_districts_on_coun_dist_integer ON pluto_latest_districts (("coun_dist" :: integer));
CREATE INDEX index_pluto_latest_districts_on_stsen_dist_integer ON pluto_latest_districts (("stsen_dist" :: integer));
CREATE INDEX index_pluto_latest_districts_on_cong_dist_integer ON pluto_latest_districts (("cong_dist" :: integer));

DROP INDEX index_pluto_latest_districts_on_assem_dist_integer;
DROP INDEX index_pluto_latest_districts_on_coun_dist_integer;
DROP INDEX index_pluto_latest_districts_on_stsen_dist_integer;
DROP INDEX index_pluto_latest_districts_on_cong_dist_integer;

CREATE INDEX index_pluto_latest_districts_on_assem_dist ON pluto_latest_districts ("assem_dist");
CREATE INDEX index_pluto_latest_districts_on_coun_dist ON pluto_latest_districts ("coun_dist");
CREATE INDEX index_pluto_latest_districts_on_stsen_dist ON pluto_latest_districts ("stsen_dist");
CREATE INDEX index_pluto_latest_districts_on_cong_dist ON pluto_latest_districts ("cong_dist");

CREATE INDEX index_nyad_on_assemdist ON nyad (assemdist);
CREATE INDEX index_nycc_on_coundist ON nycc (coundist);
CREATE INDEX index_nyss_on_stsendist ON nyss (stsendist);
CREATE INDEX index_nycg_on_congdist ON nycg (congdist);

CREATE MATERIALIZED VIEW wow.gce_eligibility_nyad AS (
    SELECT
        nyad.assemdist AS assemdist,
        ST_Transform(nyad.geom, 4326) AS geom,
        ST_X(ST_Centroid(ST_Transform(nyad.geom, 4326))) :: double precision AS longitude,
        ST_Y(ST_Centroid(ST_Transform(nyad.geom, 4326))) :: double precision AS latitude,
        ST_AsGeoJSON(ST_Transform(nyad.geom, 4326)) :: json as geom_json,
        COALESCE(SUM(unitsres), 0) :: integer AS unitsres,
        COALESCE(SUM(post_hstpa_rs_units), 0) :: integer AS post_hstpa_rs_units,
        COUNT(wow.gce_eligibility.*) :: integer AS bbls_count,
        MAX(co_issued) :: date AS max_co_issued,
        MIN(co_issued) :: date AS min_co_issued,
        SUM(CASE WHEN eligible THEN unitsres ELSE 0 END) :: integer AS eligible_units_count,
        SUM(CASE WHEN eligible THEN 1 ELSE 0 END) :: integer AS eligible_bbls_count
    FROM
        nyad
        JOIN pluto_latest_districts ON pluto_latest_districts.assem_dist = nyad.assemdist :: text
        JOIN wow.gce_eligibility ON wow.gce_eligibility.bbl = pluto_latest_districts.bbl
    GROUP BY
        nyad.assemdist,
        nyad.geom
    HAVING
        count(wow.gce_eligibility.*) > 0
);

CREATE MATERIALIZED VIEW wow.gce_eligibility_nycc AS (
    SELECT
        nycc.coundist AS coundist,
        ST_Transform(nycc.geom, 4326) AS geom,
        ST_X(ST_Centroid(ST_Transform(nycc.geom, 4326))) :: double precision AS longitude,
        ST_Y(ST_Centroid(ST_Transform(nycc.geom, 4326))) :: double precision AS latitude,
        ST_AsGeoJSON(ST_Transform(nycc.geom, 4326)) :: json as geom_json,
        COALESCE(SUM(unitsres), 0) :: integer AS unitsres,
        COALESCE(SUM(post_hstpa_rs_units), 0) :: integer AS post_hstpa_rs_units,
        COUNT(wow.gce_eligibility.*) :: integer AS bbls_count,
        MAX(co_issued) :: date AS max_co_issued,
        MIN(co_issued) :: date AS min_co_issued,
        SUM(CASE WHEN eligible THEN unitsres ELSE 0 END) :: integer AS eligible_units_count,
        SUM(CASE WHEN eligible THEN 1 ELSE 0 END) :: integer AS eligible_bbls_count
    FROM
        nycc
        JOIN pluto_latest_districts ON pluto_latest_districts.coun_dist = nycc.coundist :: text
        JOIN wow.gce_eligibility ON wow.gce_eligibility.bbl = pluto_latest_districts.bbl
    GROUP BY
        nycc.coundist,
        nycc.geom
    HAVING
        count(wow.gce_eligibility.*) > 0
);

CREATE MATERIALIZED VIEW wow.gce_eligibility_nyss AS (
    SELECT
        nyss.stsendist AS stsendist,
        ST_Transform(nyss.geom, 4326) AS geom,
        ST_X(ST_Centroid(ST_Transform(nyss.geom, 4326))) :: double precision AS longitude,
        ST_Y(ST_Centroid(ST_Transform(nyss.geom, 4326))) :: double precision AS latitude,
        ST_AsGeoJSON(ST_Transform(nyss.geom, 4326)) :: json as geom_json,
        COALESCE(SUM(unitsres), 0) :: integer AS unitsres,
        COALESCE(SUM(post_hstpa_rs_units), 0) :: integer AS post_hstpa_rs_units,
        COUNT(wow.gce_eligibility.*) :: integer AS bbls_count,
        MAX(co_issued) :: date AS max_co_issued,
        MIN(co_issued) :: date AS min_co_issued,
        SUM(CASE WHEN eligible THEN unitsres ELSE 0 END) :: integer AS eligible_units_count,
        SUM(CASE WHEN eligible THEN 1 ELSE 0 END) :: integer AS eligible_bbls_count
    FROM
        nyss
        JOIN pluto_latest_districts ON pluto_latest_districts.stsen_dist = nyss.stsendist :: text
        JOIN wow.gce_eligibility ON wow.gce_eligibility.bbl = pluto_latest_districts.bbl
    GROUP BY
        nyss.stsendist,
        nyss.geom
    HAVING
        count(wow.gce_eligibility.*) > 0
);

CREATE MATERIALIZED VIEW wow.gce_eligibility_nycg AS (
    SELECT
        nycg.congdist AS congdist,
        ST_Transform(nycg.geom, 4326) AS geom,
        ST_X(ST_Centroid(ST_Transform(nycg.geom, 4326))) :: double precision AS longitude,
        ST_Y(ST_Centroid(ST_Transform(nycg.geom, 4326))) :: double precision AS latitude,
        ST_AsGeoJSON(ST_Transform(nycg.geom, 4326)) :: json as geom_json,
        COALESCE(SUM(unitsres), 0) :: integer AS unitsres,
        COALESCE(SUM(post_hstpa_rs_units), 0) :: integer AS post_hstpa_rs_units,
        COUNT(wow.gce_eligibility.*) :: integer AS bbls_count,
        MAX(co_issued) :: date AS max_co_issued,
        MIN(co_issued) :: date AS min_co_issued,
        SUM(CASE WHEN eligible THEN unitsres ELSE 0 END) :: integer AS eligible_units_count,
        SUM(CASE WHEN eligible THEN 1 ELSE 0 END) :: integer AS eligible_bbls_count
    FROM
        nycg
        JOIN pluto_latest_districts ON pluto_latest_districts.cong_dist = nycg.congdist :: text
        JOIN wow.gce_eligibility ON wow.gce_eligibility.bbl = pluto_latest_districts.bbl
    GROUP BY
        nycg.congdist,
        nycg.geom
    HAVING
        count(wow.gce_eligibility.*) > 0
);

CREATE INDEX index_wow_gce_eligibility_nyad_on_geom ON wow.gce_eligibility_nyad USING GIST (geom);
CREATE INDEX index_wow_gce_eligibility_nycc_on_geom ON wow.gce_eligibility_nycc USING GIST (geom);
CREATE INDEX index_wow_gce_eligibility_nyss_on_geom ON wow.gce_eligibility_nyss USING GIST (geom);
CREATE INDEX index_wow_gce_eligibility_nycg_on_geom ON wow.gce_eligibility_nycg USING GIST (geom);

