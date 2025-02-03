CREATE MATERIALIZED VIEW wow.gce_eligibility_hexes AS (
    WITH map_bounds AS (
        SELECT
            MIN(ST_Y(geom)) as min_latitude,
            MAX(ST_Y(geom)) as max_latitude,
            MIN(ST_X(geom)) as min_longitude,
            MAX(ST_X(geom)) as max_longitude
        FROM
            gce_eligibility
    ),
    zoom_level_hexes AS (
        SELECT
            10 as zoom_level,
            geom
        FROM
            ST_HexagonGrid(
                0.005,
                ST_MakeEnvelope(
                    (
                        SELECT
                            min_longitude
                        FROM
                            map_bounds
                    ),
                    (
                        SELECT
                            min_latitude
                        FROM
                            map_bounds
                    ),
                    (
                        SELECT
                            max_longitude
                        FROM
                            map_bounds
                    ),
                    (
                        SELECT
                            max_latitude
                        FROM
                            map_bounds
                    ),
                    4326
                )
            )
        UNION ALL
            (
                SELECT
                    11 as zoom_level,
                    geom
                FROM
                    ST_HexagonGrid(
                        0.0034108295143625753,
                        ST_MakeEnvelope(
                            (
                                SELECT
                                    min_longitude
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    min_latitude
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    max_longitude
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    max_latitude
                                FROM
                                    map_bounds
                            ),
                            4326
                        )
                    )
            )
        UNION ALL
            (
                SELECT
                    12 as zoom_level,
                    geom
                FROM
                    ST_HexagonGrid(
                        0.0028853149033655286,
                        ST_MakeEnvelope(
                            (
                                SELECT
                                    min_longitude
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    min_latitude
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    max_longitude
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    max_latitude
                                FROM
                                    map_bounds
                            ),
                            4326
                        )
                    )
            )
        UNION ALL
            (
                SELECT
                    13 as zoom_level,
                    geom
                FROM
                    ST_HexagonGrid(
                        0.0017104115200995667,
                        ST_MakeEnvelope(
                            (
                                SELECT
                                    min_longitude
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    min_latitude
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    max_longitude
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    max_latitude
                                FROM
                                    map_bounds
                            ),
                            4326
                        )
                    )
            )
        UNION ALL
            (
                SELECT
                    14 as zoom_level,
                    geom
                FROM
                    ST_HexagonGrid(
                        0.000855202701804316,
                        ST_MakeEnvelope(
                            (
                                SELECT
                                    min_longitude
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    min_latitude
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    max_longitude
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    max_latitude
                                FROM
                                    map_bounds
                            ),
                            4326
                        )
                    )
            )
        UNION ALL
            (
                SELECT
                    15 as zoom_level,
                    geom
                FROM
                    ST_HexagonGrid(
                        0.0004276049068332312,
                        ST_MakeEnvelope(
                            (
                                SELECT
                                    min_longitude
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    min_latitude
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    max_longitude
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    max_latitude
                                FROM
                                    map_bounds
                            ),
                            4326
                        )
                    )
            )
        UNION ALL
            (
                SELECT
                    16 as zoom_level,
                    geom
                FROM
                    ST_HexagonGrid(
                        0.00021379520356067786,
                        ST_MakeEnvelope(
                            (
                                SELECT
                                    min_longitude
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    min_latitude
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    max_longitude
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    max_latitude
                                FROM
                                    map_bounds
                            ),
                            4326
                        )
                    )
            )
    )
    SELECT
        zoom_level,
        zoom_level_hexes.geom AS geom,
        ST_X(ST_Centroid(zoom_level_hexes.geom)) :: double precision AS longitude,
        ST_Y(ST_Centroid(zoom_level_hexes.geom)) :: double precision AS latitude,
        ST_AsGeoJSON(zoom_level_hexes.geom) :: json as geom_json,
        COALESCE(SUM(unitsres), 0) :: integer AS unitsres,
        COALESCE(SUM(post_hstpa_rs_units), 0) :: integer AS post_hstpa_rs_units,
        COUNT(gce_eligibility.*) :: integer AS bbls_count,
        MAX(co_issued) :: date AS max_co_issued,
        MIN(co_issued) :: date AS min_co_issued,
        SUM(CASE WHEN eligible THEN unitsres ELSE 0 END) :: integer AS eligible_units_count,
        SUM(CASE WHEN eligible THEN 1 ELSE 0 END) :: integer AS eligible_bbls_count
    FROM
        zoom_level_hexes
        JOIN gce_eligibility ON zoom_level_hexes.geom ~ gce_eligibility.geom
    GROUP BY
        zoom_level_hexes.zoom_level,
        zoom_level_hexes.geom
    HAVING
        count(gce_eligibility.*) > 0
);

CREATE INDEX index_gce_eligibility_hexes_on_geom ON gce_eligibility_hexes USING GIST(geom);
