import { LoaderFunctionArgs } from "@remix-run/cloudflare";
import _ from "lodash";
import { buildingsToCsvStream } from "~/buildings-csv";
import { getCityCouncilDistrictBuildings } from "~/db/city-council-districts";

export async function loader({
  params,
  request,
  context,
}: LoaderFunctionArgs): Promise<Response> {
  const buildings = getCityCouncilDistrictBuildings(
    context.cloudflare.env.DATABASE_URL,
    request.signal,
    _.parseInt(params.coundist!)
  );
  return new Response(buildingsToCsvStream(buildings), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition":
        'attachment; filename="good-cause-eviction-buildings.csv"',
    },
  });
}
