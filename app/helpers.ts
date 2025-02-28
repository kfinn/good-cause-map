import { bounds } from "@placemarkio/geo-viewport";
import _ from "lodash";

export const DEFAULT_ZOOM = 11;
export const DEFAULT_LATITUDE = 40.653632;
export const DEFAULT_LONGITUDE = -73.957117;
export const DEFAULT_MAP_WIDTH = 640;
export const DEFAULT_MAP_HEIGHT = 480;

export interface MapState {
  zoom: number;
  latitude: number;
  longitude: number;
  mapWidth: number;
  mapHeight: number;
}

export function searchParamsToMapState(
  searchParams: URLSearchParams
): MapState {
  return {
    zoom: parseFloatWIthDefault(searchParams.get("zoom"), DEFAULT_ZOOM),
    latitude: parseFloatWIthDefault(
      searchParams.get("latitude"),
      DEFAULT_LATITUDE
    ),
    longitude: parseFloatWIthDefault(
      searchParams.get("longitude"),
      DEFAULT_LONGITUDE
    ),
    mapWidth: parseFloatWIthDefault(
      searchParams.get("mapWidth"),
      DEFAULT_MAP_WIDTH
    ),
    mapHeight: parseFloatWIthDefault(
      searchParams.get("mapHeight"),
      DEFAULT_MAP_HEIGHT
    ),
  };
}

export interface BoundingBox {
  zoom: number;
  west: number;
  north: number;
  east: number;
  south: number;
}

export function searchParamsToBoundingBox(searchParams: URLSearchParams) {
  const { zoom, latitude, longitude, mapWidth, mapHeight } =
    searchParamsToMapState(searchParams);

  const [west, south, east, north] = bounds([longitude, latitude], zoom, [
    mapWidth,
    mapHeight,
  ]);
  const northSouthAdjustment = (north - south) * 0.1;
  const eastWestAdjustment = (east - west) * 0.1;

  return {
    zoom,
    west: west - eastWestAdjustment,
    north: north + northSouthAdjustment,
    east: east + eastWestAdjustment,
    south: south - northSouthAdjustment,
  };
}

export function parseFloatWIthDefault(
  floatString: string | undefined | null,
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
