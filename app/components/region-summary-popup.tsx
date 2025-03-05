import pluralize from "pluralize";
import { PropsWithChildren } from "react";
import { Popup } from "react-map-gl";

export interface RegionStats {
  latitude: number;
  longitude: number;
  bblsCount: number;
  eligibleUnitsCount: number;
  unitsres: number;
  postHstpaRsUnits: number;
  minCoIssued: string;
  maxCoIssued: string;
}

type Props = PropsWithChildren<{
  regionStats: RegionStats;
  onClose: () => void;
}>;

export default function RegionSummaryPopup({
  regionStats,
  onClose,
  children,
}: Props) {
  return (
    <Popup
      latitude={regionStats.latitude}
      longitude={regionStats.longitude}
      onClose={onClose}
    >
      <div>
        <h1 className="text-2xl">
          {pluralize("Building", regionStats.bblsCount, true)}
        </h1>
        <h2 className="text-lg">
          {pluralize("unit", regionStats.eligibleUnitsCount, true)} eligible for
          Good Cause Eviction
        </h2>
        <dl>
          <dt className="mt-2">Buildings</dt>
          <dd>{regionStats.bblsCount}</dd>
          <dt className="mt-2">Units</dt>
          <dd>{regionStats.unitsres}</dd>
          <dt className="mt-2">Rent Stabilized Units</dt>
          <dd>{regionStats.postHstpaRsUnits}</dd>
          {new Date(regionStats.minCoIssued).getFullYear() ===
          new Date(regionStats.minCoIssued).getFullYear() ? (
            <>
              <dt className="mt-2">Year Built</dt>
              <dd>
                {regionStats.minCoIssued
                  ? new Date(regionStats.minCoIssued).getFullYear().toString()
                  : "unknown"}
              </dd>
            </>
          ) : (
            <>
              <dt className="mt-2">Year Built Range</dt>
              <dd>
                {regionStats.minCoIssued
                  ? new Date(regionStats.minCoIssued).getFullYear().toString()
                  : "unknown"}{" "}
                -{" "}
                {regionStats.maxCoIssued
                  ? new Date(regionStats.maxCoIssued).getFullYear().toString()
                  : "unknown"}
              </dd>
            </>
          )}
        </dl>
        {children}
      </div>
    </Popup>
  );
}
