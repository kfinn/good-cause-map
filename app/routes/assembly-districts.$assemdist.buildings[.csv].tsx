import { LoaderFunctionArgs } from "@remix-run/cloudflare";
import _ from "lodash";
import postgres from "postgres";
import { getAssemblyDistrictBuildings } from "~/db/assembly-districts";

const TEXT_ENCODER = new TextEncoder();

function arrayToCsvRow(row: string[]) {
  return TEXT_ENCODER.encode(
    `${_.join(
      _.map(row, (cell) => `"${_.replace(cell, '"', '""')}"`),
      ","
    )}\n`
  );
}

async function* buildingsToCsv(
  buildings: AsyncGenerator<postgres.Row, void, unknown>
) {
  yield arrayToCsvRow([
    "bbl",
    "address",
    "borough",
    "zipcode",
    "unitsres",
    "yearbuilt",
    "ownername",
    "bldgclass",
    "coBin",
    "coIssued",
    "subsidyName",
    "active_421a",
    "activeJ51",
    "postHstpaRsUnits",
    "wowPortfolioUnits",
    "wowPortfolioBbls",
    "eligibleBldgclass",
    "eligibleCo",
    "eligibleRentStab",
    "eligibleSubsidy",
    "eligiblePortfolioSize",
    "eligible",
  ]);
  for await (const building of buildings) {
    yield arrayToCsvRow([
      building.bbl,
      building.address,
      building.borough,
      building.zipcode,
      building.unitsres?.toString() ?? '',
      building.yearbuilt?.toString() ?? '',
      building.ownername,
      building.bldgclass,
      building.coBin,
      building.coIssued,
      building.subsidyName,
      building.active421a?.toString() ?? '',
      building.activeJ51?.toString() ?? '',
      building.postHstpaRsUnits?.toString() ?? '',
      building.wowPortfolioUnits?.toString() ?? '',
      building.wowPortfolioBbls?.toString() ?? '',
      building.eligibleBldgclass?.toString() ?? '',
      building.eligibleCo?.toString() ?? '',
      building.eligibleRentStab?.toString() ?? '',
      building.eligibleSubsidy?.toString() ?? '',
      building.eligiblePortfolioSize?.toString() ?? '',
      building.eligible?.toString() ?? '',
    ]);
  }
}

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
  const buildingsCsvRows = buildingsToCsv(buildings);
  const buildingsCsvStream = new ReadableStream({
    async pull(controller) {
      const next = await buildingsCsvRows.next();
      if (next.done) {
        controller.close();
      } else {
        controller.enqueue(next.value);
      }
    },
    cancel(reason) {
      buildingsCsvRows.throw(reason);
    },
  });
  return new Response(buildingsCsvStream, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition":
        'attachment; filename="good-cause-eviction-buildings.csv"',
    },
  });
}
