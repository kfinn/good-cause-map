import * as RemixRun from "@remix-run/react";
import classNames from "classnames";
import { RefAttributes } from "react";
import { JSX } from "react/jsx-runtime";

export default function Link({
  className,
  ...props
}: JSX.IntrinsicAttributes &
  RemixRun.LinkProps &
  RefAttributes<HTMLAnchorElement>) {
  return (
    <RemixRun.Link
      className={classNames("text-blue-500", "cursor-pointer", className)}
      {...props}
    />
  );
}
