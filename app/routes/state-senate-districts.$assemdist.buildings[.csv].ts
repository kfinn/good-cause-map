import { LoaderFunctionArgs } from "@remix-run/cloudflare";
import _ from "lodash";
import { buildingsToCsvStream } from "~/buildings-csv";
import { getStateSenateDistrictBuildings } from "~/db/state-senate-districts";

export async function loader({
  params,
  request,
  context,
}: LoaderFunctionArgs): Promise<Response> {
  const buildings = getStateSenateDistrictBuildings(
    context.cloudflare.env.DATABASE_URL,
    request.signal,
    _.parseInt(params.assemdist!)
  );
  return new Response(buildingsToCsvStream(buildings), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition":
        'attachment; filename="state-senate-district-good-cause-eviction-buildings.csv"',
    },
  });
}
