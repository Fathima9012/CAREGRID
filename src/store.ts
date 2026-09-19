import {
  Hospital,
  Floor,
  Location,
  Connection,
  Resource,
  Request,
  Alert,
  Activity,
  User,
  ResourceType,
} from "./types";

const KEY = "caregrid_db_v1";

type DB = {
  hospitals: Hospital[];
  floors: Floor[];
  locations: Location[];
  connections: Connection[];
  resources: Resource[];
  requests: Request[];
  alerts: Alert[];
  activities: Activity[];
};

const uid = (prefix: string) =>
  `${prefix}-${crypto.randomUUID()}`;

const now = () =>
  new Date().toISOString();

/* =========================
   DEMO FLOOR PLAN
========================= */

const svg = (
  title: string,
  accent = "#0e7490"
) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1000 620"
    >
      <rect
        width="1000"
        height="620"
        fill="#f8fafc"
      />

      <rect
        x="35"
        y="35"
        width="930"
        height="550"
        rx="12"
        fill="white"
        stroke="#94a3b8"
        stroke-width="4"
      />

      <path
        d="M60 310H940M500 60V560"
        stroke="#cbd5e1"
        stroke-width="70"
      />

      <path
        d="M60 310H940M500 60V560"
        stroke="#64748b"
        stroke-dasharray="8 8"
      />

      <rect
        x="70"
        y="70"
        width="300"
        height="200"
        fill="#ecfdf5"
        stroke="#94a3b8"
      />

      <rect
        x="630"
        y="70"
        width="280"
        height="200"
        fill="#eff6ff"
        stroke="#94a3b8"
      />

      <rect
        x="70"
        y="350"
        width="300"
        height="190"
        fill="#fef2f2"
        stroke="#94a3b8"
      />

      <rect
        x="630"
        y="350"
        width="280"
        height="190"
        fill="#fffbeb"
        stroke="#94a3b8"
      />

      <text
        x="75"
        y="105"
        font-family="Arial"
        font-size="22"
        font-weight="700"
        fill="${accent}"
      >
        ${title}
      </text>

      <text
        x="80"
        y="150"
        font-family="Arial"
        font-size="16"
      >
        WARD / ROOMS
      </text>

      <text
        x="640"
        y="150"
        font-family="Arial"
        font-size="16"
      >
        STORAGE
      </text>

      <text
        x="80"
        y="430"
        font-family="Arial"
        font-size="16"
      >
        EMERGENCY
      </text>

      <text
        x="640"
        y="430"
        font-family="Arial"
        font-size="16"
      >
        ICU
      </text>
    </svg>
  `)}`;

/* =========================
   SEED DATA
========================= */

function seed(): DB {
  const hospitals: Hospital[] = [
    {
      id: "h1",
      name: "City Care Hospital",
      city: "Bengaluru",
      status: "ACTIVE",
    },
    {
      id: "h2",
      name: "Coastal Medical Centre",
      city: "Mangaluru",
      status: "ACTIVE",
    },
    {
      id: "h3",
      name: "Unity General Hospital",
      city: "Mysuru",
      status: "BUSY",
    },
  ];

  const floors: Floor[] = [
    {
      id: "f1",
      hospitalId: "h1",
      name: "Emergency Floor",
      level: "F1",
      image: svg(
        "CITY CARE • F1",
        "#0e7490"
      ),
    },
    {
      id: "f4",
      hospitalId: "h1",
      name: "Critical Storage & ICU",
      level: "F4",
      image: svg(
        "CITY CARE • F4",
        "#2563eb"
      ),
    },
    {
      id: "f2",
      hospitalId: "h2",
      name: "Blood & Emergency",
      level: "F2",
      image: svg(
        "COASTAL MEDICAL • F2",
        "#0f766e"
      ),
    },
    {
      id: "f3",
      hospitalId: "h3",
      name: "Clinical Services",
      level: "F3",
      image: svg(
        "UNITY GENERAL • F3",
        "#7c3aed"
      ),
    },
  ];

  const loc = (
    id: string,
    hospitalId: string,
    floorId: string,
    name: string,
    type: any,
    x: number,
    y: number
  ): Location => ({
    id,
    hospitalId,
    floorId,
    name,
    type,
    x,
    y,
    notes: "",
  });

  const locations: Location[] = [
    loc(
      "l1",
      "h1",
      "f1",
      "Emergency Ward",
      "EMERGENCY",
      18,
      62
    ),
    loc(
      "l2",
      "h1",
      "f1",
      "Corridor A",
      "CORRIDOR",
      50,
      50
    ),
    loc(
      "l3",
      "h1",
      "f1",
      "Elevator A",
      "ELEVATOR",
      50,
      30
    ),
    loc(
      "l4",
      "h1",
      "f4",
      "Elevator A",
      "ELEVATOR",
      50,
      30
    ),
    loc(
      "l5",
      "h1",
      "f4",
      "Corridor B",
      "CORRIDOR",
      58,
      50
    ),
    loc(
      "l6",
      "h1",
      "f4",
      "Blood Storage",
      "STORAGE",
      78,
      35
    ),
    loc(
      "l7",
      "h1",
      "f4",
      "ICU",
      "ICU",
      78,
      72
    ),

    loc(
      "l8",
      "h2",
      "f2",
      "Emergency Entrance",
      "ENTRANCE",
      18,
      62
    ),
    loc(
      "l9",
      "h2",
      "f2",
      "Blood Storage",
      "STORAGE",
      78,
      35
    ),
    loc(
      "l10",
      "h2",
      "f2",
      "Elevator",
      "ELEVATOR",
      50,
      30
    ),

    loc(
      "l11",
      "h3",
      "f3",
      "Emergency Ward",
      "EMERGENCY",
      18,
      62
    ),
    loc(
      "l12",
      "h3",
      "f3",
      "Main Storage",
      "STORAGE",
      78,
      35
    ),
  ];

  const connections: Connection[] = [
    {
      id: "c1",
      hospitalId: "h1",
      from: "l1",
      to: "l2",
      weight: 30,
      label: "Corridor A",
    },
    {
      id: "c2",
      hospitalId: "h1",
      from: "l2",
      to: "l3",
      weight: 18,
      label: "Elevator A",
    },
    {
      id: "c3",
      hospitalId: "h1",
      from: "l3",
      to: "l4",
      weight: 8,
      label: "Elevator A • F1↕F4",
    },
    {
      id: "c4",
      hospitalId: "h1",
      from: "l4",
      to: "l5",
      weight: 18,
      label: "Corridor B",
    },
    {
      id: "c5",
      hospitalId: "h1",
      from: "l5",
      to: "l6",
      weight: 24,
      label: "Blood Storage",
    },
    {
      id: "c6",
      hospitalId: "h1",
      from: "l5",
      to: "l7",
      weight: 28,
      label: "ICU",
    },
    {
      id: "c7",
      hospitalId: "h2",
      from: "l8",
      to: "l10",
      weight: 28,
      label: "Emergency Corridor",
    },
    {
      id: "c8",
      hospitalId: "h2",
      from: "l10",
      to: "l9",
      weight: 25,
      label: "Storage Corridor",
    },
    {
      id: "c9",
      hospitalId: "h3",
      from: "l11",
      to: "l12",
      weight: 45,
      label: "Clinical Corridor",
    },
  ];

  const res = (
    id: string,
    hospitalId: string,
    name: string,
    type: ResourceType,
    total: number,
    available: number,
    minimum: number,
    usagePerDay: number,
    unit: string,
    locationId?: string
  ): Resource => ({
    id,
    hospitalId,
    name,
    type,
    total,
    available,
    reserved: Math.max(
      0,
      total - available
    ),
    minimum,
    usagePerDay,
    unit,
    locationId,
    updatedAt: now(),
  });

  const resources: Resource[] = [
    {
      ...res(
        "r1",
        "h1",
        "O- Blood",
        "BLOOD_UNITS",
        10,
        1,
        3,
        1,
        "units",
        "l6"
      ),
    },

    {
      ...res(
        "r2",
        "h1",
        "ICU Beds",
        "ICU_BED",
        12,
        8,
        4,
        0.7,
        "beds",
        "l7"
      ),
    },

    {
      ...res(
        "r3",
        "h1",
        "Emergency Beds",
        "EMERGENCY_BED",
        20,
        9,
        5,
        1.8,
        "beds",
        "l1"
      ),
    },

    {
      ...res(
        "r4",
        "h1",
        "Oxygen",
        "OXYGEN",
        50,
        32,
        10,
        6,
        "cylinders",
        "l6"
      ),
    },

    {
      ...res(
        "r5",
        "h1",
        "IV Sets",
        "IV_SETS",
        100,
        62,
        25,
        9,
        "sets"
      ),
    },

    {
      ...res(
        "r6",
        "h2",
        "O- Blood",
        "BLOOD_UNITS",
        12,
        5,
        3,
        1,
        "units",
        "l9"
      ),
    },

    {
      ...res(
        "r7",
        "h2",
        "Oxygen",
        "OXYGEN",
        40,
        20,
        10,
        4,
        "cylinders",
        "l9"
      ),
    },

    {
      ...res(
        "r8",
        "h3",
        "O- Blood",
        "BLOOD_UNITS",
        8,
        0,
        2,
        0.8,
        "units",
        "l12"
      ),
    },

    {
      ...res(
        "r9",
        "h3",
        "General Beds",
        "GENERAL_BED",
        60,
        22,
        12,
        3,
        "beds",
        "l12"
      ),
    },
  ];

  return {
    hospitals,
    floors,
    locations,
    connections,
    resources,
    requests: [],
    alerts: [],
    activities: [
      {
        id: "a1",
        hospitalId: "h1",
        action: "SYSTEM_READY",
        detail:
          "CareGrid demo network initialized.",
        at: now(),
      },
    ],
  };
}

/* =========================
   LOAD / SAVE
========================= */

export function load(): DB {
  try {
    const raw =
      localStorage.getItem(KEY);

    if (raw) {
      return JSON.parse(raw);
    }

    const data = seed();

    localStorage.setItem(
      KEY,
      JSON.stringify(data)
    );

    return data;
  } catch {
    return seed();
  }
}

export function save(data: DB) {
  localStorage.setItem(
    KEY,
    JSON.stringify(data)
  );

  window.dispatchEvent(
    new Event("caregrid-change")
  );
}

/* =========================
   DATABASE API
========================= */

export const db = {
  get: load,

  reset() {
    save(seed());
  },

  createAmbulanceAlert(hospitalId: string) {
    const data = load();

    const alert: Alert = {
      id: uid("alert"),
      hospitalId,
      status: "ACTIVE",
      message: "An ambulance is bringing a patient to this hospital.",
      requiredResources: [],
      createdAt: now(),
      type: "AMBULANCE_INCOMING",
    };

    data.alerts.unshift(alert);

    data.activities.unshift({
      id: uid("act"),
      hospitalId,
      action: "AMBULANCE_INCOMING",
      detail: "Ambulance staff notified the hospital that a patient is incoming.",
      at: now(),
    });

    save(data);
  },

  export() {
    return JSON.stringify(
      load(),
      null,
      2
    );
  },

  upsert<K extends keyof DB>(
    table: K,
    item: DB[K][number]
  ) {
    const data = load();

    const array =
      data[table] as any[];

    const index =
      array.findIndex(
        (x) =>
          x.id ===
          (item as any).id
      );

    if (index >= 0) {
      array[index] = item;
    } else {
      array.push(item);
    }

    save(data);
  },

  remove<K extends keyof DB>(
    table: K,
    id: string
  ) {
    const data = load();

    data[table] = (
      data[table] as any[]
    ).filter(
      (x) => x.id !== id
    ) as any;

    save(data);
  },

  activity(
    hospitalId: string | undefined,
    action: string,
    detail: string
  ) {
    const data = load();

    data.activities.unshift({
      id: uid("act"),
      hospitalId,
      action,
      detail,
      at: now(),
    });

    data.activities =
      data.activities.slice(
        0,
        200
      );

    save(data);
  },

  uid,
};

/* =========================
   RESOURCE STATUS
========================= */

export const statusOf = (
  resource: {
    available: number;
    minimum: number;
    reserved: number;
  }
):
  | "AVAILABLE"
  | "LOW"
  | "CRITICAL"
  | "RESERVED"
  | "UNAVAILABLE" => {
  if (
    resource.available <= 0
  ) {
    return "UNAVAILABLE";
  }

  if (
    resource.available <=
    resource.minimum
  ) {
    return "CRITICAL";
  }

  if (
    resource.available <=
    Math.max(
      resource.minimum * 1.5,
      1
    )
  ) {
    return "LOW";
  }

  if (
    resource.reserved > 0
  ) {
    return "RESERVED";
  }

  return "AVAILABLE";
};

/* =========================
   SHORTAGE FORECAST
========================= */

export const daysToSafe = (
  available: number,
  minimum: number,
  usage: number
) =>
  usage > 0
    ? Math.max(
        0,
        (available -
          minimum) /
          usage
      )
    : Infinity;