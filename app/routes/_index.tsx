import { MetaFunction } from "@remix-run/cloudflare";
import { Navigate } from "@remix-run/react";

export const meta: MetaFunction = () => {
  return [{ title: "Good Cause Eviction Map" }];
};

export default function RootRoute() {
  return <Navigate to="/buildings" replace />;
}
