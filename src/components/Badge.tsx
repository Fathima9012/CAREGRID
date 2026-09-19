import React from "react";

type Props = {
  value: string;
};

export default function Badge({
  value,
}: Props) {
  const v = String(value).toUpperCase();

  let cls = "info";

  if (
    v.includes("CRITICAL") ||
    v === "REJECTED" ||
    v === "UNAVAILABLE"
  ) {
    cls = "bad";
  } else if (
    v === "LOW" ||
    v === "RAISED" ||
    v === "SEARCHING" ||
    v === "IN_TRANSIT"
  ) {
    cls = "warn";
  } else if (
    v === "AVAILABLE" ||
    v === "RESOLVED" ||
    v === "DELIVERED" ||
    v === "ACCEPTED" ||
    v === "ASSIGNED"
  ) {
    cls = "good";
  }

  return (
    <span className={`badge ${cls}`}>
      {String(value).replaceAll(
        "_",
        " "
      )}
    </span>
  );
}