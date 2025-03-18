import { LoaderFunctionArgs } from "@remix-run/cloudflare";
import _ from "lodash";
import { buildingsToCsvStream } from "~/buildings-csv";
import { getCongressDistrictBuildings } from "~/db/congress-districts";

export async function loader({
  params,
  request,
  context,
}: LoaderFunctionArgs): Promise<Response> {
  const buildings = getCongressDistrictBuildings(
    context.cloudflare.env.DATABASE_URL,
    request.signal,
    _.parseInt(params.congdist!)
  );
  return new Response(buildingsToCsvStream(buildings), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition":
        'attachment; filename="congress-district-good-cause-eviction-buildings.csv"',
    },
  });
}
