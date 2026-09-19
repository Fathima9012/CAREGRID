import {
  Connection,
  Floor,
  Location,
  RouteResult,
} from "./types";

export function shortestPath(
  startId: string,
  endId: string,
  locations: Location[],
  connections: Connection[],
  floors: Floor[]
): RouteResult | null {
  const locationMap = new Map(
    locations.map((location) => [
      location.id,
      location,
    ])
  );

  if (
    !locationMap.has(startId) ||
    !locationMap.has(endId)
  ) {
    return null;
  }

  const distance = new Map<
    string,
    number
  >();

  const previous = new Map<
    string,
    string | null
  >();

  const unvisited = new Set(
    locations.map(
      (location) => location.id
    )
  );

  locations.forEach((location) => {
    distance.set(
      location.id,
      Infinity
    );

    previous.set(
      location.id,
      null
    );
  });

  distance.set(startId, 0);

  /*
   * Dijkstra's shortest-path algorithm
   */
  while (unvisited.size > 0) {
    let current: string | undefined;

    for (const id of unvisited) {
      if (
        current === undefined ||
        (distance.get(id) ?? Infinity) <
          (distance.get(current) ??
            Infinity)
      ) {
        current = id;
      }
    }

    if (
      current === undefined ||
      !isFinite(
        distance.get(current) ??
          Infinity
      )
    ) {
      break;
    }

    unvisited.delete(current);

    if (current === endId) {
      break;
    }

    const currentConnections =
      connections.filter(
        (connection) =>
          connection.from ===
            current ||
          connection.to === current
      );

    for (const connection of currentConnections) {
      const next =
        connection.from === current
          ? connection.to
          : connection.from;

      if (!unvisited.has(next)) {
        continue;
      }

      const newDistance =
        (distance.get(current) ??
          Infinity) +
        connection.weight;

      if (
        newDistance <
        (distance.get(next) ??
          Infinity)
      ) {
        distance.set(
          next,
          newDistance
        );

        previous.set(
          next,
          current
        );
      }
    }
  }

  if (
    !isFinite(
      distance.get(endId) ??
        Infinity
    )
  ) {
    return null;
  }

  /*
   * Reconstruct path
   */
  const pathIds: string[] = [];

  let current:
    | string
    | null = endId;

  while (current) {
    pathIds.unshift(current);

    current =
      previous.get(current) ??
      null;
  }

  const path = pathIds
    .map((id) =>
      locationMap.get(id)
    )
    .filter(
      (
        location
      ): location is Location =>
        Boolean(location)
    );

  if (path.length === 0) {
    return null;
  }

  /*
   * Group route locations by floor
   */
  const floorMap = new Map(
    floors.map((floor) => [
      floor.id,
      floor,
    ])
  );

  const segments: {
    floor: Floor;
    locations: Location[];
  }[] = [];

  for (const location of path) {
    const lastSegment =
      segments[
        segments.length - 1
      ];

    if (
      !lastSegment ||
      lastSegment.floor.id !==
        location.floorId
    ) {
      const floor =
        floorMap.get(
          location.floorId
        );

      if (!floor) {
        continue;
      }

      segments.push({
        floor,
        locations: [],
      });
    }

    segments[
      segments.length - 1
    ].locations.push(location);
  }

  /*
   * Human-readable directions
   */
  const directions: string[] = [];

  const startFloor =
    floorMap.get(
      path[0].floorId
    );

  directions.push(
    `Start at ${path[0].name} on ${
      startFloor?.name ??
      "floor"
    }.`
  );

  for (
    let i = 1;
    i < path.length;
    i++
  ) {
    const previousLocation =
      path[i - 1];

    const currentLocation =
      path[i];

    const previousFloor =
      floorMap.get(
        previousLocation.floorId
      );

    const currentFloor =
      floorMap.get(
        currentLocation.floorId
      );

    /*
     * Floor change
     */
    if (
      previousLocation.floorId !==
      currentLocation.floorId
    ) {
      const connector =
        previousLocation.type ===
          "ELEVATOR" ||
        currentLocation.type ===
          "ELEVATOR"
          ? "the elevator"
          : previousLocation.type ===
              "STAIRS" ||
            currentLocation.type ===
              "STAIRS"
          ? "the stairs"
          : "the floor connection";

      directions.push(
        `Take ${connector} from ${
          previousFloor?.level ??
          ""
        } to ${
          currentFloor?.level ??
          ""
        }.`
      );

      continue;
    }

    /*
     * Destination
     */
    if (
      i ===
      path.length - 1
    ) {
      directions.push(
        `Arrive at ${currentLocation.name}.`
      );

      continue;
    }

    /*
     * Intermediate location
     */
    directions.push(
      `Proceed through ${currentLocation.name}.`
    );
  }

  return {
    path,
    distance: Math.round(
      distance.get(endId) ?? 0
    ),
    segments,
    directions,
  };
}