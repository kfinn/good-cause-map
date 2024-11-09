import geoViewport from "@mapbox/geo-viewport";
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import _ from "lodash";
import { MapEvent } from "mapbox-gl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Layer, Map, Source, ViewStateChangeEvent } from "react-map-gl";
import {
  getBuildingClusters,
  getBuildings,
  getBuildingsCount,
} from "~/db/buildings";

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

const MAX_BUILDINGS = 128 * 128 * 2;

interface BuildingsLoaderData {
  type: "buildings";
  data: unknown;
}

interface ClustersLoaderData {
  type: "clusters";
  data: unknown;
}

export async function loader({
  request,
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

  const [west, south, east, north] = geoViewport.bounds(
    [longitude, latitude],
    zoom,
    [mapWidth, mapHeight]
  );
  const northSouthAdjustment = (north - south) * 0.1;
  const eastWestAdjustment = (east - west) * 0.1;

  const buildingsFIlter = {
    west: west - eastWestAdjustment,
    north: north + northSouthAdjustment,
    east: east + eastWestAdjustment,
    south: south - northSouthAdjustment,
  };
  const buildingsCount = await getBuildingsCount(buildingsFIlter);

  if (buildingsCount <= MAX_BUILDINGS) {
    const buildings = await getBuildings(buildingsFIlter);
    return {
      type: "buildings",
      data: {
        type: "FeatureCollection",
        features: _.map(buildings, (building) => ({
          type: "Feature",
          properties: {
            ...building,
            isEligibleForGoodCauseEviction:
              building.isEligibleForGoodCauseEviction ? 1 : 0,
          },
          geometry: {
            type: "Point",
            coordinates: [building.longitude, building.latitude],
          },
        })),
      },
    };
  }

  const clusters = await getBuildingClusters(buildingsFIlter);
  return {
    type: "clusters",
    data: {
      type: "FeatureCollection",
      features: _.map(clusters, (cluster) => ({
        type: "Feature",
        properties: cluster,
        geometry: {
          type: "Point",
          coordinates: [cluster.longitude, cluster.latitude],
        },
      })),
    },
  };
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
  }, [latitude, longitude, mapHeight, mapWidth, setUrlSearchParams, zoom]);

  const { type, data } = useLoaderData<typeof loader>();

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
            id="buildings-heatmap"
            source="buildings"
            type="heatmap"
            maxzoom={18}
            paint={{
              "heatmap-weight": {
                property: "unitsres",
                type: "exponential",
                stops: [
                  [1, 0],
                  [500, 1],
                ],
              },
              "heatmap-radius": {
                stops: [
                  [15, 50],
                  [18, 100],
                ],
              },
              "heatmap-opacity": {
                type: "interval",
                stops: [
                  [17, 1],
                  [18, 0],
                ],
              },
            }}
          />
          <Layer
            id="buildings"
            source="buildings"
            type="circle"
            minzoom={17}
            paint={{
              "circle-radius": 7,
              "circle-color": [
                "match",
                ["get", "isEligibleForGoodCauseEviction"],
                1,
                "purple",
                0,
                "white",
                "white",
              ],
              "circle-opacity": {
                stops: [
                  [17, 0],
                  [18, 1],
                ],
              },
            }}
          />
        </Source>
      ) : (
        <Source id="clusters" type="geojson" data={data} key="clusters">
          <Layer
            id="clusters-heatmap"
            source="clusters"
            type="heatmap"
            maxzoom={18}
            paint={{
              "heatmap-weight": {
                property: "isEligibleForGoodCauseEvictionCount",
                type: "exponential",
                stops: [
                  [1, 0],
                  [50, 1],
                ],
              },
              "heatmap-radius": 50,
              "heatmap-opacity": {
                type: "interval",
                stops: [
                  [17, 1],
                  [18, 0],
                ],
              },
            }}
          />
        </Source>
      )}
    </Map>
  );
}
