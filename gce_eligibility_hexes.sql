CREATE MATERIALIZED VIEW wow.gce_eligibility_hexes AS (
    WITH map_bounds AS (
        SELECT
            MIN(ST_Y(ST_Transform(geom, 2263))) as south,
            MAX(ST_Y(ST_Transform(geom, 2263))) as north,
            MIN(ST_X(ST_Transform(geom, 2263))) as west,
            MAX(ST_X(ST_Transform(geom, 2263))) as east
        FROM
            wow.gce_eligibility
    ),
    zoom_level_hexes AS (
        SELECT
            10 as zoom_level,
            ST_Transform(geom, 4326) as geom
        FROM
            ST_HexagonGrid(
                4800,
                ST_MakeEnvelope(
                    (
                        SELECT
                            west
                        FROM
                            map_bounds
                    ),
                    (
                        SELECT
                            south
                        FROM
                            map_bounds
                    ),
                    (
                        SELECT
                            east
                        FROM
                            map_bounds
                    ),
                    (
                        SELECT
                            north
                        FROM
                            map_bounds
                    ),
                    2263
                )
            )
        UNION ALL
            (
                SELECT
                    11 as zoom_level,
                    ST_Transform(geom, 4326) as geom
                FROM
                    ST_HexagonGrid(
                        2400,
                        ST_MakeEnvelope(
                            (
                                SELECT
                                    west
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    south
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    east
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    north
                                FROM
                                    map_bounds
                            ),
                            2263
                        )
                    )
            )
        UNION ALL
            (
                SELECT
                    12 as zoom_level,
                    ST_Transform(geom, 4326) as geom
                FROM
                    ST_HexagonGrid(
                        1200,
                        ST_MakeEnvelope(
                            (
                                SELECT
                                    west
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    south
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    east
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    north
                                FROM
                                    map_bounds
                            ),
                            2263
                        )
                    )
            )
        UNION ALL
            (
                SELECT
                    13 as zoom_level,
                    ST_Transform(geom, 4326) as geom
                FROM
                    ST_HexagonGrid(
                        600,
                        ST_MakeEnvelope(
                            (
                                SELECT
                                    west
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    south
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    east
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    north
                                FROM
                                    map_bounds
                            ),
                            2263
                        )
                    )
            )
        UNION ALL
            (
                SELECT
                    14 as zoom_level,
                    ST_Transform(geom, 4326) as geom
                FROM
                    ST_HexagonGrid(
                        300,
                        ST_MakeEnvelope(
                            (
                                SELECT
                                    west
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    south
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    east
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    north
                                FROM
                                    map_bounds
                            ),
                            2263
                        )
                    )
            )
        UNION ALL
            (
                SELECT
                    15 as zoom_level,
                    ST_Transform(geom, 4326) as geom
                FROM
                    ST_HexagonGrid(
                        150,
                        ST_MakeEnvelope(
                            (
                                SELECT
                                    west
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    south
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    east
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    north
                                FROM
                                    map_bounds
                            ),
                            2263
                        )
                    )
            )
        UNION ALL
            (
                SELECT
                    16 as zoom_level,
                    ST_Transform(geom, 4326) as geom
                FROM
                    ST_HexagonGrid(
                        75,
                        ST_MakeEnvelope(
                            (
                                SELECT
                                    west
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    south
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    east
                                FROM
                                    map_bounds
                            ),
                            (
                                SELECT
                                    north
                                FROM
                                    map_bounds
                            ),
                            2263
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
        COUNT(wow.gce_eligibility.*) :: integer AS bbls_count,
        MAX(co_issued) :: date AS max_co_issued,
        MIN(co_issued) :: date AS min_co_issued,
        SUM(CASE WHEN eligible THEN unitsres ELSE 0 END) :: integer AS eligible_units_count,
        SUM(CASE WHEN eligible THEN 1 ELSE 0 END) :: integer AS eligible_bbls_count
    FROM
        zoom_level_hexes
        JOIN wow.gce_eligibility ON zoom_level_hexes.geom ~ wow.gce_eligibility.geom
    GROUP BY
        zoom_level_hexes.zoom_level,
        zoom_level_hexes.geom
    HAVING
        count(wow.gce_eligibility.*) > 0
);

CREATE INDEX index_gce_eligibility_hexes_on_geom ON wow.gce_eligibility_hexes USING GIST(geom);
