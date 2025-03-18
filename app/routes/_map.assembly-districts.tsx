import { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import _ from "lodash";
import { useCallback, useMemo, useState } from "react";
import { Layer, MapMouseEvent, Source } from "react-map-gl";
import RegionSummaryPopup from "~/components/region-summary-popup";
import {
  AssemblyDistrictStats,
  getAssemblyDistricts,
} from "~/db/assembly-districts";
import { searchParamsToBoundingBox } from "~/helpers";
import { useOnMapClick } from "./_map";

interface LoaderData {
  data: {
    type: "FeatureCollection";
    features: { properties: Record<string, unknown> }[];
  };
}

export async function loader({
  request,
  context,
}: LoaderFunctionArgs): Promise<LoaderData> {
  const { searchParams } = new URL(request.url);
  const boundingBox = searchParamsToBoundingBox(searchParams);

  const assemblyDistricts = await getAssemblyDistricts(
    context.cloudflare.env.DATABASE_URL,
    request.signal,
    boundingBox
  );

  return {
    data: {
      type: "FeatureCollection",
      features: _.map(assemblyDistricts, (assemblyDistrict) => ({
        type: "Feature",
        properties: { ...assemblyDistrict },
        geometry: assemblyDistrict.geomJson,
      })),
    },
  };
}

export default function AssemblyDistricts() {
  const { data } = useLoaderData<typeof loader>();

  const { maxUnitsres, maxEligibleProportion } = useMemo(
    () => ({
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
    }),
    [data.features]
  );

  const [popupRegionStats, setPopupRegionStats] = useState<
    AssemblyDistrictStats | undefined
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
      setPopupRegionStats(feature.properties as AssemblyDistrictStats);
      setPopupKey((oldPopupKey) => oldPopupKey + 1);
    }
  }, []);
  useOnMapClick(onMapClick);

  return (
    <>
      <Source
        id="assembly-districts"
        type="geojson"
        data={data}
        key="assembly-districts"
      >
        <Layer
          id="assembly-districts"
          source="assembly-districts"
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
            "fill-outline-color": "gray",
          }}
        />
      </Source>
      {popupRegionStats && (
        <RegionSummaryPopup
          regionStats={popupRegionStats}
          onClose={() => setPopupRegionStats(undefined)}
          key={popupKey}
          downloadLinkTo={`/assembly-districts/${popupRegionStats.assemdist}/buildings.csv`}
        />
      )}
    </>
  );
}
