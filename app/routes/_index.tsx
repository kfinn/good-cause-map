import { bounds } from "@placemarkio/geo-viewport";
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import _ from "lodash";
import { MapEvent } from "mapbox-gl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Layer, Map, Source, ViewStateChangeEvent } from "react-map-gl";
import { getBuildingsOrClusters } from "~/db/buildings";

export const meta: MetaFunction = () => {
  return [
    { title: "New Remix App" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

const DEFAULT_ZOOM = 11;
const DEFAULT_LATITUDE = 40.653632;
const DEFAULT_LONGITUDE = -73.957117;
const DEFAULT_MAP_WIDTH = 640;
const DEFAULT_MAP_HEIGHT = 480;

function parseFloatWIthDefault(
  floatString: string | null,
  defaultFloat: number
) {
  if (!_.isNil(floatString)) {
    const float = parseFloat(floatString);
    if (_.isFinite(float)) {
      return float;
    }
  }
  return defaultFloat;
}

interface BuildingsLoaderData {
  type: "buildings";
  data: {
    type: "FeatureCollection";
    features: { properties: Record<string, unknown> }[];
  };
}

interface ClustersLoaderData {
  type: "clusters";
  data: {
    type: "FeatureCollection";
    features: { properties: Record<string, unknown> }[];
  };
}

export async function loader({
  request,
  context,
}: LoaderFunctionArgs): Promise<BuildingsLoaderData | ClustersLoaderData> {
  const { searchParams } = new URL(request.url);
  const zoom = parseFloatWIthDefault(searchParams.get("zoom"), DEFAULT_ZOOM);
  const latitude = parseFloatWIthDefault(
    searchParams.get("latitude"),
    DEFAULT_LATITUDE
  );
  const longitude = parseFloatWIthDefault(
    searchParams.get("longitude"),
    DEFAULT_LONGITUDE
  );
  const mapWidth = parseFloatWIthDefault(
    searchParams.get("mapWidth"),
    DEFAULT_MAP_WIDTH
  );
  const mapHeight = parseFloatWIthDefault(
    searchParams.get("mapHeight"),
    DEFAULT_MAP_HEIGHT
  );

  const [west, south, east, north] = bounds([longitude, latitude], zoom, [
    mapWidth,
    mapHeight,
  ]);
  const northSouthAdjustment = (north - south) * 0.1;
  const eastWestAdjustment = (east - west) * 0.1;

  const buildingsFIlter = {
    west: west - eastWestAdjustment,
    north: north + northSouthAdjustment,
    east: east + eastWestAdjustment,
    south: south - northSouthAdjustment,
  };

  const buildingsOrClusters = await getBuildingsOrClusters(
    context.cloudflare.env.DATABASE_URL,
    request.signal,
    buildingsFIlter
  );
  if ("buildings" in buildingsOrClusters) {
    return {
      type: "buildings",
      data: {
        type: "FeatureCollection",
        features: _.map(buildingsOrClusters.buildings, (building) => ({
          type: "Feature",
          properties: {
            ...building,
            eligible: building.eligible ? 1 : 0,
          },
          geometry: building.geom,
        })),
      },
    };
  } else {
    return {
      type: "clusters",
      data: {
        type: "FeatureCollection",
        features: _.map(buildingsOrClusters.clusters, (cluster) => ({
          type: "Feature",
          properties: cluster,
          geometry: cluster.geom,
        })),
      },
    };
  }
}

export default function Index() {
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();
  const zoomString = urlSearchParams.get("zoom");
  const latitudeString = urlSearchParams.get("latitude");
  const longitudeString = urlSearchParams.get("longitude");

  const zoomSearchParam = useMemo(
    () => parseFloatWIthDefault(zoomString, DEFAULT_ZOOM),
    [zoomString]
  );
  const latitudeSearchParam = useMemo(
    () => parseFloatWIthDefault(latitudeString, DEFAULT_LATITUDE),
    [latitudeString]
  );
  const longitudeSearchParam = useMemo(
    () => parseFloatWIthDefault(longitudeString, DEFAULT_LONGITUDE),
    [longitudeString]
  );

  const [zoom, setZoom] = useState(zoomSearchParam);
  const [latitude, setLatitude] = useState(latitudeSearchParam);
  const [longitude, setLongitude] = useState(longitudeSearchParam);
  const [mapWidth, setMapWidth] = useState(DEFAULT_MAP_WIDTH);
  const [mapHeight, setMapHeight] = useState(DEFAULT_MAP_HEIGHT);

  const onMove = useCallback((event: ViewStateChangeEvent) => {
    setZoom(event.viewState.zoom);
    setLatitude(event.viewState.latitude);
    setLongitude(event.viewState.longitude);
  }, []);
  const onResize = useCallback((event: MapEvent) => {
    const { offsetWidth, offsetHeight } = event.target.getContainer();

    setMapWidth(offsetWidth);
    setMapHeight(offsetHeight);
  }, []);

  useEffect(() => {
    setZoom(zoomSearchParam);
  }, [zoomSearchParam]);
  useEffect(() => {
    setLatitude(latitudeSearchParam);
  }, [latitudeSearchParam]);
  useEffect(() => {
    setLongitude(longitudeSearchParam);
  }, [longitudeSearchParam]);

  useEffect(() => {
    if (
      Math.abs(zoom - zoomSearchParam) < 0.25 &&
      Math.abs(latitude - latitudeSearchParam) < 0.0000001 &&
      Math.abs(longitude - longitudeSearchParam) < 0.0000001
    ) {
      return;
    }

    const timeout = setTimeout(() => {
      setUrlSearchParams({
        zoom: zoom.toString(),
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        mapWidth: mapWidth.toString(),
        mapHeight: mapHeight.toString(),
      });
    }, 200);

    return () => clearTimeout(timeout);
  }, [
    latitude,
    latitudeSearchParam,
    longitude,
    longitudeSearchParam,
    mapHeight,
    mapWidth,
    setUrlSearchParams,
    zoom,
    zoomSearchParam,
  ]);

  const { type, data } = useLoaderData<typeof loader>();

  const { maxUnitsres, maxEligibleProportion } = useMemo(() => {
    if (type !== "clusters") {
      return {
        maxUnitsres: 0,
        maxEligibleProportion: 0,
      };
    }

    return {
      maxUnitsres: _.max(
        _.map(data.features, ({ properties: { unitsres } }) => unitsres)
      ),
      maxEligibleProportion: _.max(
        _.map(
          data.features,
          ({ properties: { unitsres, eligibleUnitsCount } }) =>
            eligibleUnitsCount! / _.max([1, unitsres])!
        )
      ),
    };
  }, [data.features, type]);

  return (
    <Map
      mapboxAccessToken="pk.eyJ1Ijoia2V2aW5maW5uIiwiYSI6ImNseXdlbzczdzA2bmUyanBtcnkzYzdsNHQifQ.nPKnplMfumUhL7z1ArhACw"
      zoom={zoom}
      longitude={longitude}
      latitude={latitude}
      onMove={onMove}
      onResize={onResize}
      onLoad={onResize}
      mapStyle="mapbox://styles/mapbox/streets-v9"
    >
      {type === "buildings" ? (
        <Source id="buildings" type="geojson" data={data} key="buildings">
          <Layer
            id="buildings"
            source="buildings"
            type="circle"
            paint={{
              "circle-radius": 7,
              "circle-color": [
                "match",
                ["get", "eligible"],
                1,
                "purple",
                0,
                "white",
                "white",
              ],
            }}
          />
        </Source>
      ) : (
        <Source id="clusters" type="geojson" data={data} key="clusters">
          <Layer
            id="clusters-heatmap"
            source="clusters"
            type="fill"
            paint={{
              "fill-opacity": [
                "interpolate",
                ["linear"],
                ["get", "unitsres"],
                0,
                0,
                1,
                0.25,
                maxUnitsres,
                0.6,
              ],
              "fill-color": [
                "interpolate",
                ["linear"],
                [
                  "/",
                  ["get", "eligibleUnitsCount"],
                  ["max", ["get", "unitsres"], 1],
                ],
                0,
                "white",
                maxEligibleProportion,
                "purple",
              ],
            }}
          />
        </Source>
      )}
    </Map>
  );
}
