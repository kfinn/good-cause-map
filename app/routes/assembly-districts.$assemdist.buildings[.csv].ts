import { LoaderFunctionArgs } from "@remix-run/cloudflare";
import _ from "lodash";
import { buildingsToCsvStream } from "~/buildings-csv";
import { getAssemblyDistrictBuildings } from "~/db/assembly-districts";

export async function loader({
  params,
  request,
  context,
}: LoaderFunctionArgs): Promise<Response> {
  const buildings = getAssemblyDistrictBuildings(
    context.cloudflare.env.DATABASE_URL,
    request.signal,
    _.parseInt(params.assemdist!)
  );
  return new Response(buildingsToCsvStream(buildings), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition":
        'attachment; filename="good-cause-eviction-buildings.csv"',
    },
  });
}
