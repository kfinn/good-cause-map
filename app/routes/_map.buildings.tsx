import { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import _ from "lodash";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Layer, MapMouseEvent, Popup, Source } from "react-map-gl";
import RegionSummaryPopup, {
  RegionStats,
} from "~/components/region-summary-popup";
import { getBuildingsOrHexes } from "~/db/buildings";
import { searchParamsToBoundingBox } from "~/helpers";
import { useOnMapClick } from "./_map";

interface BuildingsLoaderData {
  type: "buildings";
  data: {
    type: "FeatureCollection";
    features: { properties: Record<string, unknown> }[];
  };
}

interface ClustersLoaderData {
  type: "hexes";
  data: {
    type: "FeatureCollection";
    features: { properties: Record<string, unknown> }[];
  };
}

type HexStats = RegionStats & {
  zoomLevel: number;
  longitude: number;
  latitude: number;
};

interface BuildingStats {
  longitude: number;
  latitude: number;
  address: string;
  eligible: boolean;
  unitsres: number;
  postHstpaRsUnits: number;
  coIssued: string;
  bldgclass: string;
  wowPortfolioUnits: number;
  wowPortfolioBbls: number;
}

export async function loader({
  request,
  context,
}: LoaderFunctionArgs): Promise<BuildingsLoaderData | ClustersLoaderData> {
  const { searchParams } = new URL(request.url);
  const boundingBox = searchParamsToBoundingBox(searchParams);
  const buildingsOrHexes = await getBuildingsOrHexes(
    context.cloudflare.env.DATABASE_URL,
    request.signal,
    boundingBox
  );

  if ("buildings" in buildingsOrHexes) {
    return {
      type: "buildings",
      data: {
        type: "FeatureCollection",
        features: _.map(buildingsOrHexes.buildings, (building) => ({
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
      type: "hexes",
      data: {
        type: "FeatureCollection",
        features: _.map(buildingsOrHexes.hexes, (hex) => ({
          type: "Feature",
          properties: hex,
          geometry: hex.geomJson,
        })),
      },
    };
  }
}

export default function Buildings() {
  const { type, data } = useLoaderData<typeof loader>();
  const { maxUnitsres, maxEligibleProportion } = useMemo(() => {
    if (type !== "hexes") {
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

  useEffect(() => {
    setPopupBuildingStats(undefined);
    setPopupRegionStats(undefined);
  }, [type]);

  const [popupBuildingStats, setPopupBuildingStats] = useState<
    BuildingStats | undefined
  >();
  const [popupRegionStats, setPopupRegionStats] = useState<
    HexStats | undefined
  >();
  const [popupKey, setPopupKey] = useState(1);

  const onMapClick = useCallback(
    (e: MapMouseEvent) => {
      const map = e.target;
      const [feature] = map.queryRenderedFeatures(e.point);
      if (
        feature &&
        !_.isNil(feature.properties?.latitude) &&
        !_.isNil(feature.properties.longitude)
      ) {
        if (type === "buildings") {
          setPopupBuildingStats(feature.properties as unknown as BuildingStats);
          setPopupRegionStats(undefined);
        } else {
          setPopupBuildingStats(undefined);
          setPopupRegionStats(feature.properties as unknown as HexStats);
        }
        setPopupKey((oldPopupKey) => oldPopupKey + 1);
      }
    },
    [type]
  );
  useOnMapClick(onMapClick);

  return (
    <>
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
        <Source id="hexes" type="geojson" data={data} key="hexes">
          <Layer
            id="hexes-heatmap"
            source="hexes"
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
      {popupBuildingStats && (
        <Popup
          longitude={popupBuildingStats.longitude}
          latitude={popupBuildingStats.latitude}
          onClose={() => setPopupBuildingStats(undefined)}
          key={popupKey}
        >
          <div>
            <h1 className="text-xl">{popupBuildingStats.address}</h1>
            <h2 className="text-lg">
              {popupBuildingStats.eligible ? "Eligible" : "Ineligible"} for Good
              Cause Eviction
            </h2>
            <dl>
              <dt className="mt-2">Units</dt>
              <dd>{popupBuildingStats.unitsres}</dd>
              <dt className="mt-2">Rent Stabilized Units</dt>
              <dd>{popupBuildingStats.postHstpaRsUnits}</dd>
              <dt className="mt-2">Year Built</dt>
              <dd>
                {popupBuildingStats.coIssued
                  ? new Date(popupBuildingStats.coIssued).getFullYear()
                  : "unknown"}
              </dd>
              <dt className="mt-2">Building Class</dt>
              <dd>{popupBuildingStats.bldgclass}</dd>
              <dt className="mt-2">
                Estimated Units in Landlord&apos;s Portfolio
              </dt>
              <dd>
                {_.isNumber(popupBuildingStats.wowPortfolioUnits)
                  ? popupBuildingStats.wowPortfolioUnits
                  : "unknown"}
              </dd>
              <dt className="mt-2">
                Estimated Buildings in Landlord&apos;s Portfolio
              </dt>
              <dd>
                {_.isNumber(popupBuildingStats.wowPortfolioBbls)
                  ? popupBuildingStats.wowPortfolioBbls
                  : "unknown"}
              </dd>
            </dl>
          </div>
        </Popup>
      )}
      {popupRegionStats && (
        <RegionSummaryPopup
          regionStats={popupRegionStats}
          onClose={() => setPopupRegionStats(undefined)}
          key={popupKey}
          downloadLinkTo={`/hexes/${popupRegionStats.zoomLevel}/${popupRegionStats.longitude}/${popupRegionStats.latitude}/buildings.csv`}
        />
      )}
    </>
  );
}
