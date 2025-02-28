import { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import _ from "lodash";
import { Layer, Source } from "react-map-gl";
import { getAssemblyDistricts } from "~/db/assembly-districts";
import { searchParamsToBoundingBox } from "~/helpers";

interface LoaderData {
  data: {
    type: "FeatureCollection";
    features: { properties: Record<string, unknown> }[];
  };
}

export async function loader({
  request,
  context,
}: LoaderFunctionArgs): Promise<LoaderData> {
  const { searchParams } = new URL(request.url);
  const boundingBox = searchParamsToBoundingBox(searchParams);

  const assemblyDistricts = await getAssemblyDistricts(
    context.cloudflare.env.DATABASE_URL,
    request.signal,
    boundingBox
  );

  console.log(assemblyDistricts, boundingBox);

  return {
    data: {
      type: "FeatureCollection",
      features: _.map(assemblyDistricts, (assemblyDistrict) => ({
        type: "Feature",
        properties: { ...assemblyDistrict },
        geometry: assemblyDistrict.geomJson,
      })),
    },
  };
}

export default function AssemblyDistricts() {
  const { data } = useLoaderData<typeof loader>();

  return (
    <Source
      id="assembly-districts"
      type="geojson"
      data={data}
      key="assembly-districts"
    >
      <Layer
        id="assembly-districts"
        source="assembly-districts"
        type="fill"
        paint={{ "fill-color": "green", "fill-outline-color": "black" }}
      />
    </Source>
  );
}
