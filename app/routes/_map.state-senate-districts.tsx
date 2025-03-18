import { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import _ from "lodash";
import { useCallback, useState } from "react";
import { MapMouseEvent } from "react-map-gl";
import RegionSummaryPopup from "~/components/region-summary-popup";
import Regions from "~/components/regions";
import {
  StateSenateDistrictStats,
  getStateSenateDistricts,
} from "~/db/state-senate-districts";
import { searchParamsToBoundingBox } from "~/helpers";
import { useOnMapClick } from "./_map";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { searchParams } = new URL(request.url);
  const boundingBox = searchParamsToBoundingBox(searchParams);

  const stateSenateDistricts = await getStateSenateDistricts(
    context.cloudflare.env.DATABASE_URL,
    request.signal,
    boundingBox
  );

  return {
    data: {
      type: "FeatureCollection",
      features: _.map(stateSenateDistricts, (stateSenateDistrict) => ({
        type: "Feature",
        properties: stateSenateDistrict,
        geometry: stateSenateDistrict.geomJson,
      })),
    } as GeoJSON.FeatureCollection<GeoJSON.Geometry, StateSenateDistrictStats>,
  };
}

export default function StateSenateDistricts() {
  const { data } = useLoaderData<typeof loader>();

  const [popupRegionStats, setPopupRegionStats] = useState<
    StateSenateDistrictStats | undefined
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
      setPopupRegionStats(feature.properties as StateSenateDistrictStats);
      setPopupKey((oldPopupKey) => oldPopupKey + 1);
    }
  }, []);
  useOnMapClick(onMapClick);

  return (
    <>
      <Regions regions={data} />
      {popupRegionStats && (
        <RegionSummaryPopup
          regionStats={popupRegionStats}
          onClose={() => setPopupRegionStats(undefined)}
          key={popupKey}
          downloadLinkTo={`/state-senate-districts/${popupRegionStats.stsendist}/buildings.csv`}
        />
      )}
    </>
  );
}
