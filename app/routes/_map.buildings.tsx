import { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import _ from "lodash";
import pluralize from "pluralize";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Layer, MapMouseEvent, Popup, Source } from "react-map-gl";
import { getBuildingsOrClusters } from "~/db/buildings";
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
  const boundingBox = searchParamsToBoundingBox(searchParams);
  const buildingsOrClusters = await getBuildingsOrClusters(
    context.cloudflare.env.DATABASE_URL,
    request.signal,
    boundingBox
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

export default function Buildings() {
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

  const onMapClick = useCallback((e: MapMouseEvent) => {
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
    </>
  );
}
