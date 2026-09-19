import React, { useState } from "react";
import {
  Hospital as HospIcon,
  LayoutDashboard,
  Boxes,
  Map,
  ShieldAlert,
  Siren,
  Plus,
  Trash2,
  Save,
  Route as RouteIcon,
  MapPin,
  CheckCircle,
  Send,
  UserPlus,
  ClipboardList,
  Bed,
  Bell,
  X,
} from "lucide-react";

import {
  Hospital,
  Floor,
  Location,
  Connection,
  Resource,
  Request,
  Alert,
  Activity,
  ResourceType,
  RESOURCE_TYPES,
  LOCATION_TYPES,
  User,
  typeLabel,
} from "../types";

import Badge from "./Badge";
import { db, statusOf, daysToSafe } from "../store";
import { shortestPath } from "../navigation";

type Props = {
  user: User;
  data: any;
  setTick: () => void;
};

type Patient = {
  id: string;
  hospitalId: string;
  name: string;
  bedResourceId: string;
  bedNumber: string;
  type: "ICU" | "EMERGENCY";
  admissionDate: string;
};

const patientKey = (hospitalId: string) =>
  `caregrid_patients_${hospitalId}`;

const waitingKey = (hospitalId: string) =>
  `caregrid_waiting_${hospitalId}`;

const readPatients = (hospitalId: string): Patient[] => {
  try {
    return JSON.parse(
      localStorage.getItem(patientKey(hospitalId)) || "[]"
    );
  } catch {
    return [];
  }
};

const savePatients = (hospitalId: string, patients: Patient[]) => {
  localStorage.setItem(patientKey(hospitalId), JSON.stringify(patients));
};

const readWaiting = (hospitalId: string): any[] => {
  try {
    return JSON.parse(
      localStorage.getItem(waitingKey(hospitalId)) || "[]"
    );
  } catch {
    return [];
  }
};

const saveWaiting = (hospitalId: string, waiting: any[]) => {
  localStorage.setItem(waitingKey(hospitalId), JSON.stringify(waiting));
};

const isICUBed = (r: Resource) =>
  r.name.toLowerCase().includes("icu") &&
  r.name.toLowerCase().includes("bed");

const isEmergencyBed = (r: Resource) =>
  r.name.toLowerCase().includes("emergency") &&
  r.name.toLowerCase().includes("bed");

const isBed = (r: Resource) =>
  r.name.toLowerCase().includes("bed") ||
  isICUBed(r) ||
  isEmergencyBed(r);

const bedOccupied = (r: Resource) =>
  Math.max(0, r.total - r.available - (r.reserved || 0));

const nextBedNumber = (type: "ICU" | "EMERGENCY", patients: Patient[]) => {
  const prefix = type === "ICU" ? "ICU" : "ER";
  const used = new Set(
    patients
      .filter((p) => p.type === type)
      .map((p) => {
        const match = p.bedNumber.match(/(?:ICU|ER)[- ]?(\d+)/i);
        return match ? Number(match[1]) : 0;
      })
      .filter((n) => n > 0)
  );

  let n = 1;
  while (used.has(n)) n += 1;
  return `${prefix}-${String(n).padStart(2, "0")}`;
};

export default function HospitalApp({
  user,
  data,
  setTick,
}: Props) {
  const hospitalId = user.hospitalId!;

  const [hosp] = useState<Hospital>(
    data.hospitals.find((h: Hospital) => h.id === hospitalId)!
  );

  const [tab, setTab] = useState("dashboard");
  const [placing, setPlacing] = useState(false);
  const [resourceEdit, setResourceEdit] = useState<Resource | null>(null);

  const [layoutFloor, setLayoutFloor] = useState(
    data.floors.find(
      (f: Floor) => f.hospitalId === hospitalId
    )?.id || ""
  );

  const [routeFrom, setRouteFrom] = useState("");
  const [routeTo, setRouteTo] = useState("");
  const [route, setRoute] = useState<any>(null);

  const [admissionOpen, setAdmissionOpen] = useState(false);
  const [admissionType, setAdmissionType] =
    useState<"ICU" | "EMERGENCY">("ICU");
  const [admissionPatient, setAdmissionPatient] = useState("");
  const [selectedBed, setSelectedBed] = useState("");

  const [patients, setPatients] = useState<Patient[]>(
    readPatients(hospitalId)
  );

  const [waiting, setWaiting] = useState<any[]>(
    readWaiting(hospitalId)
  );

  const floors = data.floors.filter(
    (f: Floor) => f.hospitalId === hosp.id
  );

  const locs = data.locations.filter(
    (l: Location) => l.hospitalId === hosp.id
  );

  const conns = data.connections.filter(
    (c: Connection) => c.hospitalId === hosp.id
  );

  const resources = data.resources.filter(
    (r: Resource) => r.hospitalId === hosp.id
  );

  const requests = data.requests.filter(
    (r: Request) =>
      r.requestingHospitalId === hosp.id ||
      r.sourceHospitalId === hosp.id
  );

  const alerts = data.alerts.filter(
    (a: Alert) => a.hospitalId === hosp.id
  );

  const incoming = alerts.filter(
    (a: Alert) => a.status !== "RESOLVED"
  );

  const critical = resources.filter(
    (r: Resource) =>
      statusOf(r) === "CRITICAL" ||
      statusOf(r) === "UNAVAILABLE"
  );

  const bedResources = resources.filter(isBed);
  const icuBeds = resources.filter(isICUBed);
  const emergencyBeds = resources.filter(isEmergencyBed);

  const mutate = (fn: () => void, msg?: string) => {
    fn();

    if (msg) {
      db.activity(hosp.id, "UPDATE", msg);
    }

    setTick();
  };

  const navItems: any[] = [
    ["dashboard", LayoutDashboard, "Dashboard"],
    ["resources", Boxes, "Resources"],
    ["patients", ClipboardList, "Patients"],
    ["layout", Map, "Layout & Navigation"],
    ["emergency", ShieldAlert, "Emergency Center"],
  ];

  /*
   * RESOURCE UPDATE
   */

  const saveResource = (resource: Resource) => {
    const r = {
      ...resource,
      total: Math.max(0, Number(resource.total)),
      available: Math.max(
        0,
        Math.min(
          Number(resource.total),
          Number(resource.available)
        )
      ),
      reserved: Math.max(0, Number(resource.reserved || 0)),
      updatedAt: new Date().toISOString(),
    };

    if (r.available + r.reserved > r.total) {
      alert(
        "Available + Reserved cannot be greater than Total."
      );
      return;
    }

    db.upsert("resources", r);

    db.activity(
      hosp.id,
      "RESOURCE_UPDATE",
      `${r.name}: ${r.available} ${r.unit} available`
    );

    setResourceEdit(null);
    setTick();
  };

  /*
   * DISCHARGE A PATIENT
   *
   * Patient discharge is handled from the Patients page. The bed is
   * released first, then the first matching waiting patient is assigned
   * immediately when one exists.
   */

  const dischargePatient = (patientId: string) => {
    const currentPatients = readPatients(hosp.id);
    const patient = currentPatients.find((p) => p.id === patientId);

    if (!patient) {
      alert("Patient record was not found.");
      return;
    }

    if (!confirm(`Discharge ${patient.name} from ${patient.bedNumber}?`)) return;

    const bed = resources.find((r: Resource) => r.id === patient.bedResourceId);
    const remainingPatients = currentPatients.filter((p) => p.id !== patientId);

    if (!bed) {
      savePatients(hosp.id, remainingPatients);
      setPatients(remainingPatients);
      db.activity(hosp.id, "PATIENT_DISCHARGED", `${patient.name} discharged; bed record was not found`);
      setTick();
      alert(`${patient.name} discharged.`);
      return;
    }

    // Release the bed.
    const releasedAvailable = Math.min(bed.total, bed.available + 1);
    const waitingList = readWaiting(hosp.id);
    const matchingIndex = waitingList.findIndex((p: any) => p.type === patient.type);

    if (matchingIndex !== -1) {
      const waitingPatient = waitingList[matchingIndex];
      const updatedWaiting = waitingList.filter((_: any, index: number) => index !== matchingIndex);
      const newPatient: Patient = {
        id: db.uid("patient"),
        hospitalId: hosp.id,
        name: waitingPatient.name,
        bedResourceId: bed.id,
        bedNumber: nextBedNumber(patient.type, remainingPatients),
        type: patient.type,
        admissionDate: new Date().toISOString(),
      };

      savePatients(hosp.id, [...remainingPatients, newPatient]);
      saveWaiting(hosp.id, updatedWaiting);
      setPatients([...remainingPatients, newPatient]);
      setWaiting(updatedWaiting);

      // The released bed is immediately consumed by the waiting patient,
      // so its available count returns to the pre-discharge value.
      db.upsert("resources", {
        ...bed,
        available: bed.available,
        updatedAt: new Date().toISOString(),
      });

      db.activity(
        hosp.id,
        "AUTO_BED_ASSIGNMENT",
        `${patient.name} discharged → ${waitingPatient.name} automatically assigned to ${newPatient.bedNumber}`
      );

      setTick();
      alert(`${patient.name} discharged. ${waitingPatient.name} was automatically assigned to ${newPatient.bedNumber}.`);
      return;
    }

    savePatients(hosp.id, remainingPatients);
    setPatients(remainingPatients);
    db.upsert("resources", {
      ...bed,
      available: releasedAvailable,
      updatedAt: new Date().toISOString(),
    });

    db.activity(
      hosp.id,
      "PATIENT_DISCHARGED",
      `${patient.name} discharged from ${patient.bedNumber}`
    );

    setTick();
    alert(`${patient.name} discharged. ${patient.bedNumber} is now available.`);
  };

  /*
   * PATIENT ADMISSION
   */

  const availableBeds = resources.filter((r: Resource) => {
    if (!isBed(r) || r.available <= 0) return false;

    if (admissionType === "ICU") {
      return isICUBed(r);
    }

    return isEmergencyBed(r);
  });

  const admitPatient = () => {
    const name = admissionPatient.trim();

    if (!name) {
      alert("Enter patient name.");
      return;
    }

    /*
     * If there is no available bed of the selected type,
     * place the patient in the waiting queue instead.
     * When a matching bed is discharged, dischargePatient() below
     * automatically assigns the first matching waiting patient.
     */
    if (!selectedBed) {
      if (availableBeds.length > 0) {
        alert("Select an available bed.");
        return;
      }

      const waitingList = readWaiting(hosp.id);
      const waitingPatient = {
        id: db.uid("waiting"),
        name,
        type: admissionType,
        createdAt: new Date().toISOString(),
      };

      const updatedWaiting = [
        ...waitingList,
        waitingPatient,
      ];

      saveWaiting(hosp.id, updatedWaiting);
      setWaiting(updatedWaiting);

      db.activity(
        hosp.id,
        "PATIENT_WAITING",
        `${name} added to ${admissionType} waiting queue because no bed was available`
      );

      setAdmissionOpen(false);
      setAdmissionPatient("");
      setSelectedBed("");
      setTick();

      alert(
        `No ${admissionType} bed is available. ${name} has been added to the waiting queue.`
      );
      return;
    }

    const bed = resources.find(
      (r: Resource) => r.id === selectedBed
    );

    if (!bed || bed.available <= 0) {
      alert("This bed is no longer available.");
      return;
    }

    const patient: Patient = {
      id: db.uid("patient"),
      hospitalId: hosp.id,
      name,
      bedResourceId: bed.id,
      bedNumber: nextBedNumber(admissionType, readPatients(hosp.id)),
      type: admissionType,
      admissionDate: new Date().toISOString(),
    };

    const updatedPatients = [
      ...readPatients(hosp.id),
      patient,
    ];

    savePatients(hosp.id, updatedPatients);
    setPatients(updatedPatients);

    db.upsert("resources", {
      ...bed,
      available: Math.max(0, bed.available - 1),
      updatedAt: new Date().toISOString(),
    });

    db.activity(
      hosp.id,
      "PATIENT_ADMITTED",
      `${patient.name} admitted to ${bed.name}`
    );

    setAdmissionOpen(false);
    setAdmissionPatient("");
    setSelectedBed("");

    setTick();
  };

  /*
   * PREDICTIVE SHORTAGE
   */

  const forecastText = (r: Resource) => {
    if (r.usagePerDay <= 0) {
      return "No burn-rate";
    }

    const days = daysToSafe(
      r.available,
      r.minimum,
      r.usagePerDay
    );

    if (r.available <= r.minimum) {
      return "Critical now";
    }

    if (days <= 1) {
      return `${days.toFixed(1)} day`;
    }

    return `${days.toFixed(1)} days`;
  };

  const forecastCritical = resources.filter(
    (r: Resource) =>
      r.usagePerDay > 0 &&
      daysToSafe(
        r.available,
        r.minimum,
        r.usagePerDay
      ) <= 1
  );

  /*
   * NORMAL / EMERGENCY REQUEST
   */

  const raise = (emergency: boolean) => {
    const name = prompt(
      "Resource name",
      "O- Blood"
    );

    if (!name) return;

    const qty = Number(
      prompt("Quantity", "3")
    );

    if (!qty || qty < 1) return;

    const type: ResourceType =
      name.toLowerCase().includes("blood")
        ? "BLOOD_UNITS"
        : name.toLowerCase().includes("oxygen")
        ? "OXYGEN"
        : "OTHER";

    const local = resources.find(
      (r: Resource) =>
        r.name.toLowerCase() ===
        name.toLowerCase()
    );

    if (
      local &&
      local.available >= qty
    ) {
      if (
        confirm(
          `This hospital has ${local.available} available. Use local stock instead of raising a network request?`
        )
      ) {
        saveResource({
          ...local,
          available:
            local.available - qty,
        });

        return;
      }
    }

    const req: Request = {
      id: db.uid("req"),
      requestingHospitalId: hosp.id,
      resourceName: name,
      resourceType: type,
      quantity: qty,
      priority: emergency
        ? "EMERGENCY"
        : "NORMAL",
      status: "RAISED",
      notes: emergency
        ? "Immediate emergency requirement"
        : "Stock replenishment",
      createdAt:
        new Date().toISOString(),
      updatedAt:
        new Date().toISOString(),
    };

    db.upsert("requests", req);

    db.activity(
      hosp.id,
      "REQUEST_RAISED",
      `${emergency ? "Emergency" : "Normal"} request: ${qty} ${name}`
    );

    setTick();
    setTab("emergency");
  };

  /*
   * REQUEST LIFECYCLE
   */

  const advanceRequest = (
    req: Request,
    status: Request["status"]
  ) => {
    if (status === "REJECTED") {
      const source =
        req.sourceHospitalId &&
        data.resources.find(
          (x: Resource) =>
            x.hospitalId ===
              req.sourceHospitalId &&
            x.name.toLowerCase() ===
              req.resourceName.toLowerCase()
        );

      if (source) {
        db.upsert("resources", {
          ...source,
          available:
            source.available +
            req.quantity,
          reserved: Math.max(
            0,
            (source.reserved || 0) -
              req.quantity
          ),
          updatedAt:
            new Date().toISOString(),
        });
      }
    }

    if (status === "DELIVERED") {
      const source =
        req.sourceHospitalId &&
        data.resources.find(
          (x: Resource) =>
            x.hospitalId ===
              req.sourceHospitalId &&
            x.name.toLowerCase() ===
              req.resourceName.toLowerCase()
        );

      if (source) {
        db.upsert("resources", {
          ...source,
          total: Math.max(
            0,
            source.total -
              req.quantity
          ),
          reserved: Math.max(
            0,
            (source.reserved || 0) -
              req.quantity
          ),
          updatedAt:
            new Date().toISOString(),
        });
      }

      const target =
        data.resources.find(
          (x: Resource) =>
            x.hospitalId ===
              req.requestingHospitalId &&
            x.name.toLowerCase() ===
              req.resourceName.toLowerCase()
        );

      if (target) {
        db.upsert("resources", {
          ...target,
          total:
            target.total +
            req.quantity,
          available:
            target.available +
            req.quantity,
          updatedAt:
            new Date().toISOString(),
        });
      }
    }

    db.upsert("requests", {
      ...req,
      status,
      updatedAt:
        new Date().toISOString(),
    });

    db.activity(
      hosp.id,
      "REQUEST_STATUS",
      `${req.resourceName} request → ${status}`
    );

    setTick();
  };

  /*
   * AMBULANCE / INCOMING PATIENT
   *
   * Ambulance drivers use the normal Hospital Staff account.
   * Their hospitalId determines where the notification goes.
   * No patient details are entered here.
   */

  const notifyIncomingPatient = () => {
    db.createAmbulanceAlert(hosp.id);

    setTick();

    alert(
      `Patient incoming notification sent to ${hosp.name}.`
    );
  };

  const acknowledgeIncomingAlert = (alertData: Alert) => {
    db.upsert("alerts", {
      ...alertData,
      status: "PREPARING",
    });

    db.activity(
      hosp.id,
      "AMBULANCE_ALERT_ACKNOWLEDGED",
      "Hospital staff acknowledged the incoming patient notification."
    );

    setTick();
  };

  /*
   * FLOOR PLAN
   */

  const saveFloor = (f: Floor) => {
    db.upsert("floors", f);
    setTick();
  };

  const uploadFloor = (file: File) => {
    if (
      ![
        "image/png",
        "image/jpeg",
        "image/webp",
      ].includes(file.type)
    ) {
      alert(
        "Invalid file. Use PNG, JPG/JPEG or WEBP."
      );
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      alert(
        "Image is larger than 8 MB."
      );
      return;
    }

    const rd = new FileReader();

    rd.onload = () => {
      const current =
        floors.find(
          (x: Floor) =>
            x.id === layoutFloor
        );

      if (
        current &&
        confirm(
          `Replace the image for ${current.name}?`
        )
      ) {
        saveFloor({
          ...current,
          image: String(rd.result),
        });

        return;
      }

      const f: Floor = {
        id: db.uid("floor"),
        hospitalId: hosp.id,
        name:
          prompt(
            "Floor name",
            "New Floor"
          ) || "New Floor",
        level:
          prompt(
            "Floor level",
            "F2"
          ) || "F2",
        image: String(rd.result),
      };

      saveFloor(f);
      setLayoutFloor(f.id);
    };

    rd.readAsDataURL(file);
  };

  const deleteFloor = () => {
    const f = floors.find(
      (x: Floor) =>
        x.id === layoutFloor
    );

    if (
      !f ||
      !confirm(
        `Delete ${f.name}? Its locations and graph connections will also be deleted.`
      )
    )
      return;

    locs
      .filter(
        (l: Location) =>
          l.floorId === f.id
      )
      .forEach((l: Location) =>
        db.remove(
          "locations",
          l.id
        )
      );

    conns
      .filter(
        (c: Connection) =>
          locs.some(
            (l: Location) =>
              l.id === c.from &&
              l.floorId === f.id
          ) ||
          locs.some(
            (l: Location) =>
              l.id === c.to &&
              l.floorId === f.id
          )
      )
      .forEach((c: Connection) =>
        db.remove(
          "connections",
          c.id
        )
      );

    db.remove("floors", f.id);

    setLayoutFloor(
      floors.find(
        (x: Floor) =>
          x.id !== f.id
      )?.id || ""
    );

    setTick();
  };

  const addLoc = (
    x: number,
    y: number
  ) => {
    const f = floors.find(
      (x: Floor) => x.id === layoutFloor
    );

    if (!f) return;

    const name =
      prompt("Location name");

    if (!name) return;

    const type = (
      prompt(
        `Type: ${LOCATION_TYPES.join(
          ", "
        )}`,
        "ROOM"
      ) || "ROOM"
    ) as any;

    if (
      locs.some(
        (l: Location) =>
          l.floorId === f.id &&
          l.name.toLowerCase() ===
            name.toLowerCase()
      )
    ) {
      alert(
        "Duplicate location on this floor."
      );
      return;
    }

    db.upsert("locations", {
      id: db.uid("loc"),
      hospitalId: hosp.id,
      floorId: f.id,
      name,
      type,
      x,
      y,
      notes: "",
    });

    setTick();
  };

  const connect = () => {
    const a =
      prompt(
        "Start location name"
      );

    const b =
      prompt(
        "End location name"
      );

    if (!a || !b) return;

    const la = locs.find(
      (l: Location) =>
        l.name.toLowerCase() ===
        a.toLowerCase()
    );

    const lb = locs.find(
      (l: Location) =>
        l.name.toLowerCase() ===
        b.toLowerCase()
    );

    if (!la || !lb) {
      alert(
        "Both locations must exist."
      );
      return;
    }

    const w = Number(
      prompt(
        "Distance / weight",
        "10"
      )
    );

    if (!w || w <= 0) return;

    db.upsert("connections", {
      id: db.uid("conn"),
      hospitalId: hosp.id,
      from: la.id,
      to: lb.id,
      weight: w,
      label:
        prompt(
          "Connection label",
          "Corridor"
        ) || "Connection",
    });

    setTick();
  };

  const calcRoute = () => {
    const r = shortestPath(
      routeFrom,
      routeTo,
      locs,
      conns,
      floors
    );

    setRoute(r);

    if (!r) {
      alert(
        "No route found. Please connect the relevant locations, elevator or stairs."
      );
    }
  };

  const navToResource = (
    r: Resource
  ) => {
    if (!r.locationId) {
      alert(
        "This resource has no layout location assigned."
      );

      setTab("layout");
      return;
    }

    const start =
      locs.find(
        (l: Location) =>
          l.type === "EMERGENCY" ||
          l.type === "ENTRANCE"
      ) || locs[0];

    if (
      start &&
      r.locationId
    ) {
      setRouteFrom(start.id);
      setRouteTo(r.locationId);
      setTab("layout");

      setTimeout(
        () =>
          setRoute(
            shortestPath(
              start.id,
              r.locationId!,
              locs,
              conns,
              floors
            )
          ),
        0
      );
    }
  };

  return (
    <div className="workspace">
      <aside className="sidebar">
        <div className="side-title">
          <HospIcon /> {hosp.name}
        </div>

        {navItems.map(
          ([id, Icon, label]) => (
            <button
              key={id}
              className={
                tab === id
                  ? "nav active"
                  : "nav"
              }
              onClick={() =>
                setTab(id)
              }
            >
              <Icon size={18} />
              {label}
            </button>
          )
        )}

        <div className="side-spacer" />

        <button
          className="nav emergency"
          onClick={() => raise(true)}
        >
          <Siren size={18} />
          Raise Emergency Request
        </button>

        <button
          className="nav alert"
          onClick={notifyIncomingPatient}
        >
          <Siren size={18} />
          Patient Incoming
        </button>
      </aside>

      <section className="content">
        {tab === "dashboard" && (
          <Dashboard
            hosp={hosp}
            resources={resources}
            requests={requests}
            alerts={incoming}
            activities={data.activities}
            critical={critical}
            forecastCritical={forecastCritical}
            icuBeds={icuBeds}
            emergencyBeds={emergencyBeds}
            patients={patients}
            waiting={waiting}
            onAcknowledgeAlert={acknowledgeIncomingAlert}
            onPatients={() => setTab("patients")}
            onNav={() =>
              setTab("layout")
            }
            onEdit={setResourceEdit}
            onRaise={() =>
              raise(false)
            }
            onAdmit={(type: "ICU" | "EMERGENCY") => {
              setAdmissionType(type);
              setAdmissionOpen(true);
            }}
          />
        )}

        {tab === "resources" && (
          <Resources
            resources={resources}
            locs={locs}
            floors={floors}
            onEdit={setResourceEdit}
            onDelete={(id: string) => {
              const linkedPatients = patients.filter((p) => p.bedResourceId === id);
              if (linkedPatients.length > 0) {
                alert("This bed resource has active patients. Discharge or move those patients before deleting it.");
                return;
              }
              if (!confirm("Delete this resource? This cannot be undone.")) return;
              db.remove("resources", id);
              setTick();
            }}
            onNav={navToResource}
            onPatients={() => setTab("patients")}
            onAdd={() =>
              setResourceEdit({
                id: db.uid("r"),
                hospitalId:
                  hosp.id,
                name: "",
                type: "OTHER",
                total: 0,
                available: 0,
                reserved: 0,
                minimum: 0,
                usagePerDay: 0,
                unit: "units",
                updatedAt:
                  new Date().toISOString(),
              })
            }
          />
        )}

        {tab === "patients" && (
          <Patients
            patients={patients}
            waiting={waiting}
            resources={resources}
            locs={locs}
            onAdmit={(type: "ICU" | "EMERGENCY") => {
              setAdmissionType(type);
              setAdmissionOpen(true);
            }}
            onDischarge={dischargePatient}
          />
        )}

        {tab === "layout" && (
          <Layout
            floors={floors}
            locs={locs}
            conns={conns}
            resources={resources}
            floorId={layoutFloor}
            setFloorId={
              setLayoutFloor
            }
            onUpload={uploadFloor}
            onAddLoc={addLoc}
            onConnect={connect}
            onDeleteFloor={
              deleteFloor
            }
            placing={placing}
            setPlacing={setPlacing}
            onDeleteLoc={(id: string) => {
              db.remove(
                "locations",
                id
              );
              setTick();
            }}
            onDeleteConn={(id: string) => {
              db.remove(
                "connections",
                id
              );
              setTick();
            }}
            routeFrom={routeFrom}
            routeTo={routeTo}
            setRouteFrom={
              setRouteFrom
            }
            setRouteTo={setRouteTo}
            calcRoute={calcRoute}
            route={route}
          />
        )}

        {tab === "emergency" && (
          <Emergency
            hosp={hosp}
            requests={requests}
            resources={resources}
            onRaise={() =>
              raise(true)
            }
            onAccept={(req: Request) => {
              db.upsert(
                "requests",
                {
                  ...req,
                  status: "ACCEPTED",
                  updatedAt:
                    new Date().toISOString(),
                }
              );

              setTick();
            }}
            onReject={(req: Request) =>
              advanceRequest(
                req,
                "REJECTED"
              )
            }
            onAdvance={
              advanceRequest
            }
          />
        )}

        {resourceEdit && (
          <ResourceModal
            resource={resourceEdit}
            locs={locs}
            onClose={() =>
              setResourceEdit(null)
            }
            onSave={saveResource}
          />
        )}

        {admissionOpen && (
          <AdmissionModal
            type={admissionType}
            patientName={
              admissionPatient
            }
            setPatientName={
              setAdmissionPatient
            }
            selectedBed={selectedBed}
            setSelectedBed={
              setSelectedBed
            }
            beds={availableBeds}
            onClose={() => {
              setAdmissionOpen(false);
              setAdmissionPatient("");
              setSelectedBed("");
            }}
            onSave={admitPatient}
          />
        )}

      </section>
    </div>
  );
}

/* ========================= DASHBOARD ========================= */

function Dashboard({
  hosp,
  resources,
  requests,
  alerts,
  activities,
  critical,
  forecastCritical,
  icuBeds,
  emergencyBeds,
  patients,
  waiting,
  onAcknowledgeAlert,
  onNav,
  onPatients,
  onEdit,
  onRaise,
  onAdmit,
}: any) {
  const icuTotal = icuBeds.reduce(
    (s: number, r: Resource) =>
      s + r.total,
    0
  );

  const icuAvailable =
    icuBeds.reduce(
      (s: number, r: Resource) =>
        s + r.available,
      0
    );

  const icuReserved =
    icuBeds.reduce(
      (s: number, r: Resource) =>
        s + (r.reserved || 0),
      0
    );

  const icuOccupied = Math.max(
    0,
    icuTotal -
      icuAvailable -
      icuReserved
  );

  const emergencyTotal =
    emergencyBeds.reduce(
      (s: number, r: Resource) =>
        s + r.total,
      0
    );

  const emergencyAvailable =
    emergencyBeds.reduce(
      (s: number, r: Resource) =>
        s + r.available,
      0
    );

  const emergencyReserved =
    emergencyBeds.reduce(
      (s: number, r: Resource) =>
        s + (r.reserved || 0),
      0
    );

  const emergencyOccupied =
    Math.max(
      0,
      emergencyTotal -
        emergencyAvailable -
        emergencyReserved
    );

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">
            HOSPITAL OPERATIONS
          </div>

          <h1>{hosp.name}</h1>

          <p>
            {hosp.city} · Resource readiness
            and emergency coordination
          </p>
        </div>

        <div className="head-actions">
          <button
            className="secondary"
            onClick={onNav}
          >
            <Map size={16} />
            Open Layout
          </button>

          <button
            className="primary"
            onClick={() =>
              onAdmit("ICU")
            }
          >
            <UserPlus size={16} />
            Admit Patient
          </button>

          <button
            className="danger"
            onClick={onRaise}
          >
            <Siren size={16} />
            Emergency Request
          </button>
        </div>
      </div>

      <div className="metrics">
        {[
          [
            resources.length,
            "Tracked resources",
            "",
          ],
          [
            resources.reduce(
              (
                s: number,
                r: Resource
              ) =>
                s + r.available,
              0
            ),
            "Available units",
            "",
          ],
          [
            critical.length,
            "Critical shortages",
            critical.length
              ? "danger"
              : "",
          ],
          [
            requests.filter(
              (r: Request) =>
                ![
                  "RESOLVED",
                  "REJECTED",
                ].includes(
                  r.status
                )
            ).length,
            "Active requests",
            "",
          ],
        ].map(
          (m: any) => (
            <div
              className="metric"
              key={m[1]}
            >
              <strong
                className={m[2]}
              >
                {m[0]}
              </strong>
              <span>{m[1]}</span>
            </div>
          )
        )}
      </div>

      {alerts.length > 0 && (
        <div className="alert-banner">
          <Siren />

          <div>
            <b>
              Incoming patient
            </b>

            <span>
              {alerts[0].message}
            </span>
          </div>

          {alerts[0].status === "ACTIVE" && (
            <button
              className="primary"
              onClick={() =>
                onAcknowledgeAlert(alerts[0])
              }
            >
              Acknowledge
            </button>
          )}
        </div>
      )}

      <div className="grid two">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>
                ICU Bed Capacity
              </h2>

              <p>
                Occupied, available and
                reserved beds
              </p>
            </div>

            <button
              className="primary"
              onClick={() =>
                onAdmit("ICU")
              }
            >
              <Bed size={16} />
              Admit ICU
            </button>
          </div>

          <div className="metrics">
            <div className="metric">
              <strong>
                {icuOccupied}
              </strong>
              <span>Occupied</span>
            </div>

            <div className="metric">
              <strong>
                {icuAvailable}
              </strong>
              <span>Available</span>
            </div>

            <div className="metric">
              <strong>
                {icuReserved}
              </strong>
              <span>Reserved</span>
            </div>

            <div className="metric">
              <strong>
                {icuTotal}
              </strong>
              <span>Total</span>
            </div>
          </div>

          {icuBeds.map(
            (r: Resource) => (
              <div
                className="hospital-row"
                key={r.id}
              >
                <div>
                  <b>{r.name}</b>
                  <small>
                    Occupied:{" "}
                    {Math.max(
                      0,
                      r.total -
                        r.available -
                        (r.reserved ||
                          0)
                    )}{" "}
                    · Available:{" "}
                    {r.available} ·
                    Reserved:{" "}
                    {r.reserved || 0}
                  </small>
                </div>

                <button
                  className="secondary compact"
                  onClick={onPatients}
                  title="Open patient management"
                >
                  Manage Patients
                </button>
              </div>
            )
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>
                Emergency Bed Capacity
              </h2>

              <p>
                Current emergency
                department capacity
              </p>
            </div>

            <button
              className="secondary"
              onClick={() =>
                onAdmit("EMERGENCY")
              }
            >
              <UserPlus
                size={16}
              />
              Admit
            </button>
          </div>

          <div className="metrics">
            <div className="metric">
              <strong>
                {emergencyOccupied}
              </strong>
              <span>Occupied</span>
            </div>

            <div className="metric">
              <strong>
                {emergencyAvailable}
              </strong>
              <span>Available</span>
            </div>

            <div className="metric">
              <strong>
                {emergencyReserved}
              </strong>
              <span>Reserved</span>
            </div>

            <div className="metric">
              <strong>
                {emergencyTotal}
              </strong>
              <span>Total</span>
            </div>
          </div>

          {emergencyBeds.map(
            (r: Resource) => (
              <div
                className="hospital-row"
                key={r.id}
              >
                <div>
                  <b>{r.name}</b>
                  <small>
                    Occupied:{" "}
                    {Math.max(
                      0,
                      r.total -
                        r.available -
                        (r.reserved ||
                          0)
                    )}{" "}
                    · Available:{" "}
                    {r.available} ·
                    Reserved:{" "}
                    {r.reserved || 0}
                  </small>
                </div>

                <button
                  className="secondary compact"
                  onClick={onPatients}
                  title="Open patient management"
                >
                  Manage Patients
                </button>
              </div>
            )
          )}
        </section>
      </div>

      <div className="grid two">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>
                Predictive Shortage
              </h2>

              <p>
                Resources expected to
                reach the safe threshold
                soon
              </p>
            </div>
          </div>

          {forecastCritical.length ===
          0 ? (
            <div className="empty">
              No predicted shortages
              within the next 24 hours.
            </div>
          ) : (
            forecastCritical.map(
              (r: Resource) => {
                const days =
                  daysToSafe(
                    r.available,
                    r.minimum,
                    r.usagePerDay
                  );

                return (
                  <div
                    className="queue-row"
                    key={r.id}
                  >
                    <div>
                      <b>
                        {r.name}
                      </b>

                      <small>
                        {r.available}{" "}
                        {r.unit} available
                        · Safe level{" "}
                        {r.minimum}
                      </small>
                    </div>

                    <Badge value="CRITICAL" />

                    <button
                      className="primary"
                      onClick={() =>
                        onRaise()
                      }
                    >
                      Request
                    </button>

                    <span>
                      {days <= 0
                        ? "Critical now"
                        : `${days.toFixed(
                            1
                          )} days`}
                    </span>
                  </div>
                );
              }
            )
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>
                Current Patients
              </h2>

              <p>
                Active ICU and emergency
                admissions
              </p>
            </div>

            <button className="secondary compact" onClick={onPatients}>
              Open Patient Management
            </button>
          </div>

          {patients.length === 0 ? (
            <div className="empty">
              No active patients.
            </div>
          ) : (
            patients
              .slice()
              .reverse()
              .slice(0, 8)
              .map(
                (p: Patient) => (
                  <div
                    className="hospital-row"
                    key={p.id}
                  >
                    <div>
                      <b>
                        {p.name}
                      </b>

                      <small>
                        {p.type} ·{" "}
                        {p.bedNumber} ·
                        Admitted{" "}
                        {new Date(
                          p.admissionDate
                        ).toLocaleDateString()}
                      </small>
                    </div>
                  </div>
                )
              )
          )}

          {waiting.length > 0 && (
            <div className="alert-banner">
              <Bell size={18} />

              <div>
                <b>
                  {waiting.length} patient
                  {waiting.length > 1
                    ? "s"
                    : ""} waiting
                </b>

                <span>
                  Discharged beds will
                  automatically be assigned
                  to waiting patients.
                </span>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="grid two">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>
                Resource Readiness
              </h2>

              <p>
                Current quantity, safe
                threshold and shortage
                forecast
              </p>
            </div>

            <button
              className="link"
              onClick={() =>
                onEdit(resources[0])
              }
            >
              Manage
            </button>
          </div>

          <table>
            <thead>
              <tr>
                <th>Resource</th>
                <th>
                  Available
                </th>
                <th>
                  Safe level
                </th>
                <th>
                  Forecast
                </th>
                <th>Status</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {resources
                .slice(0, 8)
                .map(
                  (r: Resource) => (
                    <tr key={r.id}>
                      <td>
                        <b>
                          {r.name}
                        </b>

                        <small>
                          {typeLabel(
                            r.type
                          )}{" "}
                          · {r.unit}
                        </small>
                      </td>

                      <td>
                        {r.available} /{" "}
                        {r.total}
                      </td>

                      <td>
                        {r.minimum}
                      </td>

                      <td>
                        {r.usagePerDay >
                        0
                          ? `${daysToSafe(
                              r.available,
                              r.minimum,
                              r.usagePerDay
                            ).toFixed(
                              1
                            )} days`
                          : "No burn-rate"}
                      </td>

                      <td>
                        <Badge
                          value={statusOf(
                            r
                          )}
                        />
                      </td>

                      <td className="row-actions">
                        <button className="link" onClick={() => onEdit(r)}>Edit</button>
                        <button className="link" onClick={() => onNav(r)}>Locate</button>
                      </td>
                    </tr>
                  )
                )}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>
                Recent Activity
              </h2>

              <p>
                Live persisted audit
                trail
              </p>
            </div>
          </div>

          <div className="activity">
            {activities
              .filter(
                (a: Activity) =>
                  !a.hospitalId ||
                  a.hospitalId ===
                    hosp.id
              )
              .slice(0, 8)
              .map(
                (a: Activity) => (
                  <div key={a.id}>
                    <span>
                      {new Date(
                        a.at
                      ).toLocaleTimeString()}
                    </span>

                    <div>
                      <b>
                        {a.action.replaceAll(
                          "_",
                          " "
                        )}
                      </b>

                      <p>
                        {a.detail}
                      </p>
                    </div>
                  </div>
                )
              )}
          </div>
        </section>
      </div>
    </>
  );
}

/* ========================= RESOURCES ========================= */

function Resources({
  resources,
  locs,
  floors,
  onEdit,
  onDelete,
  onNav,
  onPatients,
  onAdd,
}: any) {
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">
            INVENTORY
          </div>

          <h1>Resources</h1>

          <p>
            Create, edit, locate and
            update tracked resources.
          </p>
        </div>

        <button
          className="primary"
          onClick={onAdd}
        >
          <Plus size={16} />
          Add Resource
        </button>
      </div>

      <div className="panel">
        <div className="table-note">
          <b>Capacity:</b> beds show occupied, available and reserved.
          <span>Use <b>Patients</b> for admission/discharge. Resources only manage inventory.</span>
        </div>
        <table className="resource-table">
          <thead>
            <tr>
              <th>Resource</th>
              <th>Capacity</th>
              <th>Safe level</th>
              <th>Usage / day</th>
              <th>Location</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {resources.map(
              (r: Resource) => {
                const occupied =
                  Math.max(
                    0,
                    r.total -
                      r.available -
                      (r.reserved ||
                        0)
                  );

                return (
                  <tr key={r.id}>
                    <td>
                      <b>
                        {r.name}
                      </b>

                      <small>
                        {typeLabel(
                          r.type
                        )}
                      </small>
                    </td>

                    <td className="capacity-cell">
                      {isBed(r) ? (
                        <span className="capacity-inline">
                          <span>{occupied} occupied</span>
                          <span>{r.available} available</span>
                          <span>{r.reserved || 0} reserved</span>
                        </span>
                      ) : (
                        <span className="capacity-inline">
                          <span>{r.available} / {r.total} available</span>
                        </span>
                      )}
                    </td>

                    <td>
                      {r.minimum}{" "}
                      {r.unit}
                    </td>

                    <td>
                      {
                        r.usagePerDay
                      }{" "}
                      {r.unit}/day
                    </td>

                    <td>
                      {(() => {
                        const location = locs.find((l: Location) => l.id === r.locationId);
                        const floor = location ? floors.find((f: Floor) => f.id === location.floorId) : undefined;
                        return location ? `${location.name}${floor ? ` · ${floor.level}` : ""}` : "Not assigned";
                      })()}
                    </td>

                    <td>
                      <Badge
                        value={statusOf(
                          r
                        )}
                      />
                    </td>

                    <td className="resource-actions-cell">
                      <div className="row-actions">
                        <button
                        className="link"
                        onClick={() =>
                          onEdit(r)
                        }
                      >
                        Edit
                      </button>

                      <button
                        className="link"
                        onClick={() =>
                          onNav(r)
                        }
                      >
                        Locate
                      </button>

                      <button
                        className="danger-text"
                        onClick={() =>
                          onDelete(
                            r.id
                          )
                        }
                      >
                        <Trash2
                          size={14}
                        />
                      </button>

                      </div>
                    </td>
                  </tr>
                );
              }
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ========================= PATIENTS ========================= */

function Patients({
  patients,
  waiting,
  resources,
  locs,
  onAdmit,
  onDischarge,
}: {
  patients: Patient[];
  waiting: any[];
  resources: Resource[];
  locs: Location[];
  onAdmit: (type: "ICU" | "EMERGENCY") => void;
  onDischarge: (patientId: string) => void;
}) {
  const getBedLocation = (patient: Patient) => {
    const resource = resources.find((r) => r.id === patient.bedResourceId);
    const location = resource?.locationId ? locs.find((l) => l.id === resource.locationId) : undefined;
    return location?.name || "Location not assigned";
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">PATIENT MANAGEMENT</div>
          <h1>Patients</h1>
          <p>Admit patients, track active beds and manage the waiting queue.</p>
        </div>

        <div className="head-actions">
          <button className="secondary" onClick={() => onAdmit("EMERGENCY")}>
            <UserPlus size={16} />
            Admit Emergency
          </button>
          <button className="primary" onClick={() => onAdmit("ICU")}>
            <UserPlus size={16} />
            Admit ICU
          </button>
        </div>
      </div>

      <div className="metrics">
        <div className="metric">
          <strong>{patients.length}</strong>
          <span>Active patients</span>
        </div>
        <div className="metric">
          <strong>{patients.filter((p) => p.type === "ICU").length}</strong>
          <span>ICU patients</span>
        </div>
        <div className="metric">
          <strong>{patients.filter((p) => p.type === "EMERGENCY").length}</strong>
          <span>Emergency patients</span>
        </div>
        <div className="metric">
          <strong>{waiting.length}</strong>
          <span>Waiting queue</span>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Current Patients</h2>
            <p>Every active admission has a bed, type and admission timestamp.</p>
          </div>
          <span className="badge good">LIVE</span>
        </div>

        {patients.length === 0 ? (
          <div className="empty">No active patients. Use Admit Patient to create an admission.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Type</th>
                <th>Bed</th>
                <th>Admission date</th>
                <th>Location</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {patients
                .slice()
                .reverse()
                .map((p) => (
                  <tr key={p.id}>
                    <td><b>{p.name}</b><small>Patient ID: {p.id.slice(-8)}</small></td>
                    <td><Badge value={p.type} /></td>
                    <td><b>{p.bedNumber}</b><small>{resources.find((r) => r.id === p.bedResourceId)?.name || "Bed resource"}</small></td>
                    <td>{new Date(p.admissionDate).toLocaleString()}</td>
                    <td>{getBedLocation(p)}</td>
                    <td><Badge value="ADMITTED" /></td>
                    <td className="row-actions">
                      <button className="danger-text" onClick={() => onDischarge(p.id)}>
                        Discharge
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Waiting Queue</h2>
            <p>Patients waiting for a matching ICU or Emergency bed.</p>
          </div>
          {waiting.length > 0 && <span className="badge warn">{waiting.length} WAITING</span>}
        </div>

        {waiting.length === 0 ? (
          <div className="empty">No patients are waiting. When all matching beds are full, new admissions will appear here automatically.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Required bed</th>
                <th>Waiting since</th>
                <th>Status</th>
                <th>What happens next</th>
              </tr>
            </thead>
            <tbody>
              {waiting.map((p: any) => (
                <tr key={p.id}>
                  <td><b>{p.name}</b></td>
                  <td><Badge value={p.type} /></td>
                  <td>{new Date(p.createdAt).toLocaleString()}</td>
                  <td><Badge value="WAITING" /></td>
                  <td>Automatically assigned when a matching patient bed is discharged.</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

/* ========================= RESOURCE MODAL ========================= */

function ResourceModal({
  resource,
  locs,
  onClose,
  onSave,
}: any) {
  const [r, setR] =
    useState<Resource>({
      ...resource,
    });

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-head">
          <h2>
            {resource.name
              ? "Edit resource"
              : "Add resource"}
          </h2>

          <button
            className="icon-btn"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="form-grid">
          {[
            ["name", "Resource name"],
            ["total", "Total quantity"],
            [
              "available",
              "Available quantity",
            ],
            [
              "reserved",
              "Reserved quantity",
            ],
            [
              "minimum",
              "Minimum safe level",
            ],
            [
              "usagePerDay",
              "Usage per day",
            ],
            ["unit", "Unit"],
          ].map(
            ([k, l]) => (
              <label key={k}>
                {l}

                <input
                  value={(r as any)[k]}
                  type={
                    k === "name" ||
                    k === "unit"
                      ? "text"
                      : "number"
                  }
                  onChange={(e) =>
                    setR({
                      ...r,
                      [k]:
                        k === "name" ||
                        k === "unit"
                          ? e.target
                              .value
                          : Number(
                              e.target
                                .value
                            ),
                    })
                  }
                />
              </label>
            )
          )}

          <label>
            Type

            <select
              value={r.type}
              onChange={(e) =>
                setR({
                  ...r,
                  type: e.target
                    .value as any,
                })
              }
            >
              {RESOURCE_TYPES.map(
                (x) => (
                  <option key={x}>
                    {x}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            Exact location

            <select
              value={
                r.locationId || ""
              }
              onChange={(e) =>
                setR({
                  ...r,
                  locationId:
                    e.target
                      .value ||
                    undefined,
                })
              }
            >
              <option value="">
                No location
              </option>

              {locs.map(
                (l: Location) => (
                  <option
                    key={l.id}
                    value={l.id}
                  >
                    {l.name}
                  </option>
                )
              )}
            </select>
          </label>
        </div>

        <div className="modal-actions">
          <button
            className="secondary"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            className="primary"
            onClick={() => {
              if (
                r.available >=
                  0 &&
                r.total >= 0 &&
                r.reserved >= 0 &&
                r.available +
                  r.reserved <=
                  r.total
              ) {
                onSave(r);
              } else {
                alert(
                  "Invalid quantity. Available + Reserved cannot exceed Total."
                );
              }
            }}
          >
            <Save size={16} />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========================= ADMISSION MODAL ========================= */

function AdmissionModal({
  type,
  patientName,
  setPatientName,
  selectedBed,
  setSelectedBed,
  beds,
  onClose,
  onSave,
}: any) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-head">
          <div>
            <div className="eyebrow">
              PATIENT ADMISSION
            </div>

            <h2>
              Admit {type} Patient
            </h2>
          </div>

          <button
            className="icon-btn"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="form-grid">
          <label>
            Patient name

            <input
              value={patientName}
              onChange={(e) =>
                setPatientName(
                  e.target.value
                )
              }
              placeholder="Enter patient name"
            />
          </label>

          <label>
            Bed

            {beds.length > 0 ? (
              <select
                value={selectedBed}
                onChange={(e) =>
                  setSelectedBed(
                    e.target.value
                  )
                }
              >
                <option value="">
                  Select available bed
                </option>

                {beds.map(
                  (r: Resource) => (
                    <option
                      key={r.id}
                      value={r.id}
                    >
                      {r.name} ·{" "}
                      {r.available}{" "}
                      available
                    </option>
                  )
                )}
              </select>
            ) : (
              <div className="alert-banner">
                <Bell size={16} />
                <span>
                  No {type} beds are currently available. The patient will be added to the waiting queue.
                </span>
              </div>
            )}
          </label>
        </div>

        <div className="modal-actions">
          <button
            className="secondary"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            className="primary"
            onClick={onSave}
          >
            <UserPlus size={16} />
            Admit Patient
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========================= LAYOUT ========================= */

function Layout({
  floors,
  locs,
  conns,
  resources,
  floorId,
  setFloorId,
  onUpload,
  onAddLoc,
  onConnect,
  onDeleteFloor,
  placing,
  setPlacing,
  onDeleteLoc,
  onDeleteConn,
  routeFrom,
  routeTo,
  setRouteFrom,
  setRouteTo,
  calcRoute,
  route,
}: any) {
  const f = floors.find(
    (x: Floor) =>
      x.id === floorId
  );

  const flocs = locs.filter(
    (l: Location) =>
      l.floorId === floorId
  );

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">
            FACILITY GRAPH
          </div>

          <h1>
            Layout & Navigation
          </h1>

          <p>
            Upload the real floor plan,
            place locations, connect the
            graph, then calculate a route.
          </p>
        </div>

        <label className="primary file-btn">
          <Plus size={16} />
          Add / Replace Floor

          <input
            hidden
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) =>
              e.target.files?.[0] &&
              onUpload(
                e.target.files[0]
              )
            }
          />
        </label>
      </div>

      <div className="layout-toolbar">
        <select
          value={floorId}
          onChange={(e) =>
            setFloorId(
              e.target.value
            )
          }
        >
          {floors.map(
            (x: Floor) => (
              <option
                key={x.id}
                value={x.id}
              >
                {x.name} ·{" "}
                {x.level}
              </option>
            )
          )}
        </select>

        <button
          className={
            placing
              ? "primary"
              : "secondary"
          }
          onClick={() =>
            setPlacing(!placing)
          }
        >
          <MapPin size={16} />

          {placing
            ? "Click floor plan to place"
            : "Place Location"}
        </button>

        <button
          className="secondary"
          onClick={onConnect}
        >
          <RouteIcon size={16} />
          Connect
        </button>

        <button
          className="danger"
          onClick={onDeleteFloor}
        >
          Delete Floor
        </button>
      </div>

      {!f ? (
        <div className="empty">
          No floor uploaded yet.
        </div>
      ) : (
        <div className="layout-grid">
          <section className="panel floor-panel">
            <div
              className={`floor-canvas ${
                placing
                  ? "placing"
                  : ""
              }`}
              onClick={(e) => {
                if (!placing)
                  return;

                const rect =
                  (
                    e.currentTarget as HTMLDivElement
                  ).getBoundingClientRect();

                onAddLoc(
                  Math.max(
                    2,
                    Math.min(
                      98,
                      ((e.clientX -
                        rect.left) /
                        rect.width) *
                        100
                    )
                  ),
                  Math.max(
                    2,
                    Math.min(
                      98,
                      ((e.clientY -
                        rect.top) /
                        rect.height) *
                        100
                    )
                  )
                );

                setPlacing(false);
              }}
            >
              <img
                src={f.image}
                alt={f.name}
              />

              {flocs.map(
                (l: Location) => (
                  <button
                    key={l.id}
                    className={`map-pin ${l.type}`}
                    style={{
                      left: `${l.x}%`,
                      top: `${l.y}%`,
                    }}
                    title={`${l.name} · ${l.type}`}
                  >
                    <span>
                      {l.name}
                    </span>
                  </button>
                )
              )}

              {route?.segments?.find(
                (s: any) =>
                  s.floor.id === f.id
              ) && (
                <svg
                  className="route-svg"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <polyline
                    points={route.segments
                      .find(
                        (s: any) =>
                          s.floor.id ===
                          f.id
                      )
                      .locations.map(
                        (l: Location) =>
                          `${l.x},${l.y}`
                      )
                      .join(" ")}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="1.2"
                    strokeDasharray="3 1.5"
                  />
                </svg>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>
                  Shortest path
                </h2>

                <p>
                  Dijkstra over stored
                  connections, including
                  cross-floor edges.
                </p>
              </div>
            </div>

            <label>
              From

              <select
                value={routeFrom}
                onChange={(e) =>
                  setRouteFrom(
                    e.target.value
                  )
                }
              >
                <option value="">
                  Select start
                </option>

                {locs.map(
                  (l: Location) => (
                    <option
                      key={l.id}
                      value={l.id}
                    >
                      {l.name}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              To

              <select
                value={routeTo}
                onChange={(e) =>
                  setRouteTo(
                    e.target.value
                  )
                }
              >
                <option value="">
                  Select destination
                </option>

                {locs.map(
                  (l: Location) => (
                    <option
                      key={l.id}
                      value={l.id}
                    >
                      {l.name}
                    </option>
                  )
                )}
              </select>
            </label>

            <button
              className="primary wide"
              disabled={
                !routeFrom ||
                !routeTo
              }
              onClick={calcRoute}
            >
              <RouteIcon size={16} />
              Calculate Shortest Path
            </button>

            {route ? (
              <>
                <div className="route-result">
                  <b>
                    {route.distance}{" "}
                    units
                  </b>

                  <span>
                    {
                      route.segments
                        .length
                    }{" "}
                    floor(s)
                  </span>

                  <ol>
                    {route.directions.map(
                      (
                        d: string,
                        i: number
                      ) => (
                        <li key={i}>
                          {d}
                        </li>
                      )
                    )}
                  </ol>
                </div>

                <div className="route-floors">
                  {route.segments.map(
                    (seg: any) => (
                      <div
                        className="route-floor"
                        key={
                          seg.floor.id
                        }
                      >
                        <b>
                          {
                            seg.floor
                              .name
                          }{" "}
                          ·{" "}
                          {
                            seg.floor
                              .level
                          }
                        </b>

                        <div className="floor-canvas">
                          <img
                            src={
                              seg.floor
                                .image
                            }
                            alt={
                              seg.floor
                                .name
                            }
                          />

                          <svg
                            className="route-svg"
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                          >
                            <polyline
                              points={seg.locations
                                .map(
                                  (
                                    l: Location
                                  ) =>
                                    `${l.x},${l.y}`
                                )
                                .join(
                                  " "
                                )}
                              fill="none"
                              stroke="#ef4444"
                              strokeWidth="1.2"
                              strokeDasharray="3 1.5"
                            />
                          </svg>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </>
            ) : (
              <p className="hint">
                No route calculated.
              </p>
            )}

            <div className="mini-list">
              <b>
                Locations on{" "}
                {f.level}
              </b>

              {flocs.map(
                (l: Location) => (
                  <div key={l.id}>
                    <span>
                      {l.name}
                    </span>

                    <small>
                      {l.type}
                    </small>

                    <button
                      className="danger-text"
                      onClick={() =>
                        onDeleteLoc(
                          l.id
                        )
                      }
                    >
                      ×
                    </button>
                  </div>
                )
              )}
            </div>
          </section>
        </div>
      )}

      {conns.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <h2>
              Stored connections
            </h2>
          </div>

          <div className="connection-list">
            {conns.map(
              (c: Connection) => (
                <div key={c.id}>
                  <span>
                    {
                      locs.find(
                        (l: Location) =>
                          l.id ===
                          c.from
                      )?.name
                    }{" "}
                    ↔{" "}
                    {
                      locs.find(
                        (l: Location) =>
                          l.id ===
                          c.to
                      )?.name
                    }
                  </span>

                  <small>
                    {c.weight} units ·{" "}
                    {c.label}
                  </small>

                  <button
                    className="danger-text"
                    onClick={() =>
                      onDeleteConn(
                        c.id
                      )
                    }
                  >
                    Delete
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ========================= EMERGENCY ========================= */

function Emergency({
  hosp,
  requests,
  resources,
  onRaise,
  onAccept,
  onReject,
  onAdvance,
}: any) {
  const active =
    requests.filter(
      (r: Request) =>
        ![
          "RESOLVED",
          "REJECTED",
        ].includes(r.status)
    );

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">
            EMERGENCY CENTER
          </div>

          <h1>
            Requests & readiness
          </h1>

          <p>
            Raise, track and respond to
            resource requests assigned to
            this hospital.
          </p>
        </div>

        <button
          className="danger"
          onClick={onRaise}
        >
          <Siren size={16} />
          Emergency Resource Request
        </button>
      </div>

      <div className="request-list">
        {active.length === 0 ? (
          <div className="empty">
            No active requests.
          </div>
        ) : (
          active.map(
            (r: Request) => (
              <div
                className="request-card"
                key={r.id}
              >
                <div>
                  <div className="request-title">
                    <Badge
                      value={
                        r.priority
                      }
                    />

                    <b>
                      {r.quantity} ×{" "}
                      {r.resourceName}
                    </b>
                  </div>

                  <p>
                    {r.notes}
                  </p>

                  <small>
                    {new Date(
                      r.createdAt
                    ).toLocaleString()}{" "}
                    · {r.status}
                  </small>
                </div>

                <div className="request-actions">
                  {r.sourceHospitalId ===
                    hosp.id &&
                    r.status ===
                      "ASSIGNED" && (
                      <>
                        <button
                          className="primary"
                          onClick={() =>
                            onAccept(r)
                          }
                        >
                          <CheckCircle
                            size={15}
                          />
                          Accept
                        </button>

                        <button
                          className="secondary"
                          onClick={() =>
                            onReject(r)
                          }
                        >
                          Reject
                        </button>
                      </>
                    )}

                  {[
                    "ACCEPTED",
                    "ASSIGNED",
                  ].includes(
                    r.status
                  ) &&
                    r.sourceHospitalId ===
                      hosp.id && (
                      <button
                        className="secondary"
                        onClick={() =>
                          onAdvance(
                            r,
                            "IN_TRANSIT"
                          )
                        }
                      >
                        <Send
                          size={15}
                        />
                        In transit
                      </button>
                    )}

                  {r.status ===
                    "IN_TRANSIT" &&
                    r.sourceHospitalId ===
                      hosp.id && (
                      <button
                        className="secondary"
                        onClick={() =>
                          onAdvance(
                            r,
                            "DELIVERED"
                          )
                        }
                      >
                        Delivered
                      </button>
                    )}

                  {r.status ===
                    "DELIVERED" &&
                    r.requestingHospitalId ===
                      hosp.id && (
                      <button
                        className="primary"
                        onClick={() =>
                          onAdvance(
                            r,
                            "RESOLVED"
                          )
                        }
                      >
                        Resolve
                      </button>
                    )}
                </div>
              </div>
            )
          )
        )}
      </div>
    </>
  );
}