import _ from "lodash";
import { useMemo } from "react";
import { Layer, Source } from "react-map-gl";
import { RegionStats } from "./region-summary-popup";

interface Props {
  regions: GeoJSON.FeatureCollection<GeoJSON.Geometry, RegionStats>;
}

export default function Regions({ regions }: Props) {
  const { maxUnitsres, maxEligibleProportion } = useMemo(
    () => ({
      maxUnitsres: _.max(
        _.map(regions.features, ({ properties: { unitsres } }) => unitsres)
      ),
      maxEligibleProportion: _.max(
        _.map(
          regions.features,
          ({ properties: { unitsres, eligibleUnitsCount } }) =>
            eligibleUnitsCount! / _.max([1, unitsres])!
        )
      ),
    }),
    [regions.features]
  );

  return (
    <Source
      id="assembly-districts"
      type="geojson"
      data={regions}
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
  );
}
