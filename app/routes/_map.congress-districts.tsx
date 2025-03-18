import { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import _ from "lodash";
import { useCallback, useState } from "react";
import { MapMouseEvent } from "react-map-gl";
import RegionSummaryPopup from "~/components/region-summary-popup";
import Regions from "~/components/regions";
import {
  CongressDistrictStats,
  getCongressDistricts,
} from "~/db/congress-districts";
import { searchParamsToBoundingBox } from "~/helpers";
import { useOnMapClick } from "./_map";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { searchParams } = new URL(request.url);
  const boundingBox = searchParamsToBoundingBox(searchParams);

  const congressDistricts = await getCongressDistricts(
    context.cloudflare.env.DATABASE_URL,
    request.signal,
    boundingBox
  );

  return {
    data: {
      type: "FeatureCollection",
      features: _.map(congressDistricts, (congressDistrict) => ({
        type: "Feature",
        properties: congressDistrict,
        geometry: congressDistrict.geomJson,
      })),
    } as GeoJSON.FeatureCollection<GeoJSON.Geometry, CongressDistrictStats>,
  };
}

export default function CongressDistricts() {
  const { data } = useLoaderData<typeof loader>();

  const [popupRegionStats, setPopupRegionStats] = useState<
    CongressDistrictStats | undefined
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
      setPopupRegionStats(feature.properties as CongressDistrictStats);
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
          downloadLinkTo={`/congress-districts/${popupRegionStats.congdist}/buildings.csv`}
        />
      )}
    </>
  );
}
