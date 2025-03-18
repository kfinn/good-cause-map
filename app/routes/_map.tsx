import { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { Outlet, useLoaderData, useSearchParams } from "@remix-run/react";
import _ from "lodash";
import { MapEvent, MapMouseEvent } from "mapbox-gl";
import {
  createContext,
  Dispatch,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Map, ViewStateChangeEvent } from "react-map-gl";
import Link from "~/components/link";
import {
  DEFAULT_MAP_HEIGHT,
  DEFAULT_MAP_WIDTH,
  searchParamsToMapState,
} from "~/helpers";

export async function loader({ context }: LoaderFunctionArgs) {
  return { mapboxAccessToken: context.cloudflare.env.MAPBOX_ACCESS_TOKEN };
}

type OnMapClickContextType = [
  (e: MapMouseEvent) => void | undefined,
  Dispatch<SetStateAction<(e: MapMouseEvent) => void | undefined>>
];

const OnMapClickContext = createContext<OnMapClickContextType>([
  () => undefined,
  () => undefined,
]);

export function useOnMapClick(
  onMapClick: (e: MapMouseEvent) => void | undefined
) {
  const [, setOnMapClick] = useContext(OnMapClickContext);
  useEffect(() => {
    setOnMapClick(() => onMapClick);
    return () => setOnMapClick(() => undefined);
  }, [onMapClick, setOnMapClick]);
}

export default function MapRoute() {
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    zoom: zoomSearchParam,
    latitude: latitudeSearchParam,
    longitude: longitudeSearchParam,
  } = useMemo(() => searchParamsToMapState(searchParams), [searchParams]);

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

  const throttledUpdateUrlSearchParams = useMemo(
    () =>
      _.throttle((newSearchParams: Record<string, string>) => {
        setSearchParams(newSearchParams);
      }, 200),
    [setSearchParams]
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
    zoom,
    zoomSearchParam,
  ]);

  const { mapboxAccessToken } = useLoaderData<typeof loader>();

  const [onMapClick, setOnMapClick] =
    useState<(e: MapMouseEvent) => void | undefined>();
  const onMapClickContext = useMemo(
    () => [onMapClick, setOnMapClick] as OnMapClickContextType,
    [onMapClick]
  );

  return (
    <OnMapClickContext.Provider value={onMapClickContext}>
      <Map
        mapboxAccessToken={mapboxAccessToken}
        zoom={zoom}
        longitude={longitude}
        latitude={latitude}
        onMove={onMove}
        onResize={onResize}
        onLoad={onResize}
        onClick={onMapClick}
        mapStyle="mapbox://styles/mapbox/streets-v9"
      >
        <Outlet />
        <div className="absolute top-2 right-2 p-2 min-w-40 border bg-white text-black shadow z-[2]">
          <h1>Good Cause Eviction Map</h1>
          <ul>
            <li>
              <Link to={`/buildings?${searchParams.toString()}`}>
                Buildings
              </Link>
            </li>
            <li>
              <Link to={`/assembly-districts?${searchParams.toString()}`}>
                Assembly Districts
              </Link>
            </li>
          </ul>
        </div>
      </Map>
    </OnMapClickContext.Provider>
  );
}
