import { bounds } from "@placemarkio/geo-viewport";
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import _ from "lodash";
import { MapEvent, MapMouseEvent } from "mapbox-gl";
import pluralize from "pluralize";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Layer, Map, Popup, Source, ViewStateChangeEvent } from "react-map-gl";
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
    zoom,
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
          geometry: building.geomJson,
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
          geometry: cluster.geomJson,
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

  const throttledUpdateUrlSearchParams = useMemo(
    () =>
      _.throttle(
        (
          urlSearchParams: Record<
            "zoom" | "latitude" | "longitude" | "mapWidth" | "mapHeight",
            string
          >
        ) => {
          setUrlSearchParams(urlSearchParams);
        },
        200
      ),
    [setUrlSearchParams]
  );

  useEffect(() => {
    if (
      Math.abs(zoom - zoomSearchParam) < 0.25 &&
      Math.abs(latitude - latitudeSearchParam) < 0.0000001 &&
      Math.abs(longitude - longitudeSearchParam) < 0.0000001
    ) {
      return;
    }

    throttledUpdateUrlSearchParams({
      zoom: zoom.toString(),
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      mapWidth: mapWidth.toString(),
      mapHeight: mapHeight.toString(),
    });
  }, [
    throttledUpdateUrlSearchParams,
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

  useEffect(() => setTooltipProperties(undefined), [type]);

  const [tooltipProperties, setTooltipProperties] = useState<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Record<string, any> | undefined
  >();
  const [popupKey, setPopupKey] = useState(1);

  const onClick = useCallback((e: MapMouseEvent) => {
    const map = e.target;
    const [feature] = map.queryRenderedFeatures(e.point);
    if (
      feature &&
      !_.isNil(feature.properties?.latitude) &&
      !_.isNil(feature.properties.longitude)
    ) {
      setTooltipProperties(feature.properties!);
      setPopupKey((oldPopupKey) => oldPopupKey + 1);
    }
  }, []);

  return (
    <Map
      mapboxAccessToken="pk.eyJ1Ijoia2V2aW5maW5uIiwiYSI6ImNseXdlbzczdzA2bmUyanBtcnkzYzdsNHQifQ.nPKnplMfumUhL7z1ArhACw"
      zoom={zoom}
      longitude={longitude}
      latitude={latitude}
      onMove={onMove}
      onResize={onResize}
      onLoad={onResize}
      onClick={onClick}
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
      {tooltipProperties && (
        <Popup
          longitude={tooltipProperties.longitude}
          latitude={tooltipProperties.latitude}
          onClose={() => setTooltipProperties(undefined)}
          key={popupKey}
        >
          {type === "buildings" ? (
            <div>
              <h1 className="text-xl">{tooltipProperties.address}</h1>
              <h2 className="text-lg">
                {tooltipProperties.eligible ? "Eligible" : "Ineligible"} for
                Good Cause Eviction
              </h2>
              <dl>
                <dt className="mt-2">Units</dt>
                <dd>{tooltipProperties.unitsres}</dd>
                <dt className="mt-2">Rent Stabilized Units</dt>
                <dd>{tooltipProperties.postHstpaRsUnits}</dd>
                <dt className="mt-2">Year Built</dt>
                <dd>
                  {tooltipProperties.coIssued
                    ? new Date(tooltipProperties.coIssued).getFullYear()
                    : "unknown"}
                </dd>
                <dt className="mt-2">Building Class</dt>
                <dd>{tooltipProperties.bldgclass}</dd>
                <dt className="mt-2">
                  Estimated Units in Landlord&apos;s Portfolio
                </dt>
                <dd>
                  {_.isNumber(tooltipProperties.wowPortfolioUnits)
                    ? tooltipProperties.wowPortfolioUnits
                    : "unknown"}
                </dd>
                <dt className="mt-2">
                  Estimated Buildings in Landlord&apos;s Portfolio
                </dt>
                <dd>
                  {_.isNumber(tooltipProperties.wowPortfolioBbls)
                    ? tooltipProperties.wowPortfolioBbls
                    : "unknown"}
                </dd>
              </dl>
            </div>
          ) : (
            <div>
              <h1 className="text-2xl">
                {pluralize("Building", tooltipProperties.bblsCount, true)}
              </h1>
              <h2 className="text-lg">
                {pluralize("unit", tooltipProperties.eligibleUnitsCount, true)}{" "}
                eligible for Good Cause Eviction
              </h2>
              <dl>
                <dt className="mt-2">Buildings</dt>
                <dd>{tooltipProperties.bblsCount}</dd>
                <dt className="mt-2">Units</dt>
                <dd>{tooltipProperties.unitsres}</dd>
                <dt className="mt-2">Rent Stabilized Units</dt>
                <dd>{tooltipProperties.postHstpaRsUnits}</dd>
                {new Date(tooltipProperties.minCoIssued).getFullYear() ===
                new Date(tooltipProperties.minCoIssued).getFullYear() ? (
                  <>
                    <dt className="mt-2">Year Built</dt>
                    <dd>
                      {tooltipProperties.minCoIssued
                        ? new Date(tooltipProperties.minCoIssued)
                            .getFullYear()
                            .toString()
                        : "unknown"}
                    </dd>
                  </>
                ) : (
                  <>
                    <dt className="mt-2">Year Built Range</dt>
                    <dd>
                      {tooltipProperties.minCoIssued
                        ? new Date(tooltipProperties.minCoIssued)
                            .getFullYear()
                            .toString()
                        : "unknown"}{" "}
                      -{" "}
                      {tooltipProperties.maxCoIssued
                        ? new Date(tooltipProperties.maxCoIssued)
                            .getFullYear()
                            .toString()
                        : "unknown"}
                    </dd>
                  </>
                )}
              </dl>
            </div>
          )}
        </Popup>
      )}
    </Map>
  );
}
