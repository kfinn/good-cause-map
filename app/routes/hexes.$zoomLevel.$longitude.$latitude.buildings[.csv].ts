import { LoaderFunctionArgs } from "@remix-run/cloudflare";
import _ from "lodash";
import { buildingsToCsvStream } from "~/buildings-csv";
import { getHexBuildings } from "~/db/hexes";

export async function loader({
  params,
  request,
  context,
}: LoaderFunctionArgs): Promise<Response> {
  const buildings = getHexBuildings(
    context.cloudflare.env.DATABASE_URL,
    request.signal,
    _.parseInt(params.zoomLevel!),
    _.toNumber(params.longitude!),
    _.toNumber(params.latitude!)
  );
  return new Response(buildingsToCsvStream(buildings), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition":
        'attachment; filename="good-cause-eviction-buildings.csv"',
    },
  });
}
