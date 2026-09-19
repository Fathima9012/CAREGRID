import React, { useState } from "react";
import {
  Command,
  Search,
  Map,
  AlertTriangle,
  BarChart3,
  Network,
  Upload,
  CheckCircle,
  Send,
} from "lucide-react";

import {
  Hospital,
  Floor,
  Location,
  Resource,
  Request,
  User,
} from "../types";

import Badge from "./Badge";
import { db, statusOf } from "../store";

type Props = {
  user: User;
  data: any;
  setTick: () => void;
};

export default function NetworkApp({ user, data, setTick }: Props) {
  const [tab, setTab] = useState("command");
  const [q, setQ] = useState("O- Blood");
  const [qty, setQty] = useState(3);

  const hospitals: Hospital[] = data.hospitals || [];
  const requests: Request[] = data.requests || [];
  const resources: Resource[] = data.resources || [];
  const floors: Floor[] = data.floors || [];
  const locations: Location[] = data.locations || [];

  const [layoutHospital, setLayoutHospital] = useState(
    hospitals[0]?.id || ""
  );

  const [layoutFloor, setLayoutFloor] = useState(
    floors.find((f) => f.hospitalId === hospitals[0]?.id)?.id || ""
  );

  const critical = resources.filter(
    (r) => statusOf(r) === "CRITICAL" || statusOf(r) === "UNAVAILABLE"
  );

  const matches = resources.filter(
    (r) =>
      r.name.toLowerCase().includes(q.toLowerCase()) &&
      r.available >= qty
  );

  const search = () => setTab("search");

  const assign = (req: Request, source: Resource) => {
    if (source.available < req.quantity) {
      alert("Insufficient source quantity.");
      return;
    }

    if (source.hospitalId === req.requestingHospitalId) {
      alert("The source hospital must be different from the requesting hospital.");
      return;
    }

    db.upsert("requests", {
      ...req,
      sourceHospitalId: source.hospitalId,
      status: "ASSIGNED",
      updatedAt: new Date().toISOString(),
    });

    db.upsert("resources", {
      ...source,
      available: source.available - req.quantity,
      reserved: source.reserved + req.quantity,
      updatedAt: new Date().toISOString(),
    });

    db.activity(
      undefined,
      "SOURCE_ASSIGNED",
      `${source.hospitalId} assigned ${req.quantity} × ${req.resourceName}; quantity reserved.`
    );

    setTick();
  };

  const escalate = (req: Request) => {
    db.upsert("requests", {
      ...req,
      status: "SEARCHING",
      updatedAt: new Date().toISOString(),
    });

    db.activity(
      undefined,
      "REQUEST_ESCALATED",
      `${req.quantity} × ${req.resourceName} moved to network search.`
    );

    setTick();
  };

  const saveFloor = (file: File) => {
    if (!layoutHospital) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      alert("Invalid image format. Use PNG, JPG/JPEG or WEBP.");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      alert("Image exceeds 8 MB.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const current = floors.find((f) => f.id === layoutFloor);

      if (
        current &&
        current.hospitalId === layoutHospital &&
        confirm(`Replace the image for ${current.name}?`)
      ) {
        db.upsert("floors", {
          ...current,
          image: String(reader.result),
        });

        setTick();
        return;
      }

      const floor: Floor = {
        id: db.uid("floor"),
        hospitalId: layoutHospital,
        name: prompt("Floor name", "New Floor") || "New Floor",
        level: prompt("Floor level", "F1") || "F1",
        image: String(reader.result),
      };

      db.upsert("floors", floor);
      setLayoutFloor(floor.id);
      setTick();
    };

    reader.readAsDataURL(file);
  };

  const selectedFloor = floors.find((f) => f.id === layoutFloor);

  const selectedLocations = locations.filter(
    (l) => l.floorId === layoutFloor
  );

  return (
    <div className="workspace">
      <aside className="sidebar">
        <div className="side-title">
          <Network size={20} />
          Network Command Center
        </div>

        <button
          className={tab === "command" ? "nav active" : "nav"}
          onClick={() => setTab("command")}
        >
          <Command size={18} />
          Command Center
        </button>

        <button
          className={tab === "search" ? "nav active" : "nav"}
          onClick={() => setTab("search")}
        >
          <Search size={18} />
          Resource Search
        </button>

        <button
          className={tab === "layouts" ? "nav active" : "nav"}
          onClick={() => setTab("layouts")}
        >
          <Map size={18} />
          Hospital Layouts
        </button>

        <button
          className={tab === "requests" ? "nav active" : "nav"}
          onClick={() => setTab("requests")}
        >
          <AlertTriangle size={18} />
          Emergency Requests
        </button>

        <button
          className={tab === "analytics" ? "nav active" : "nav"}
          onClick={() => setTab("analytics")}
        >
          <BarChart3 size={18} />
          Analytics
        </button>

        <div className="side-spacer" />

        <div className="side-summary">
          <b>{hospitals.length}</b>
          <span>registered hospitals</span>

          <b>
            {
              requests.filter(
                (r) => !["RESOLVED", "REJECTED"].includes(r.status)
              ).length
            }
          </b>
          <span>active requests</span>
        </div>
      </aside>

      <section className="content">
        {tab === "command" && (
          <CommandCenter
            hospitals={hospitals}
            requests={requests}
            critical={critical}
            resources={resources}
            onSearch={search}
          />
        )}

        {tab === "search" && (
          <SearchPage
            q={q}
            setQ={setQ}
            qty={qty}
            setQty={setQty}
            matches={matches}
            onAssign={assign}
            requests={requests}
            hospitals={hospitals}
            locations={locations}
          />
        )}

        {tab === "layouts" && (
          <Layouts
            hospitals={hospitals}
            floors={floors}
            locations={locations}
            selectedHospital={layoutHospital}
            setSelectedHospital={(id: string) => {
              setLayoutHospital(id);

              const firstFloor = floors.find(
                (f) => f.hospitalId === id
              );

              setLayoutFloor(firstFloor?.id || "");
            }}
            floor={selectedFloor}
            setFloor={setLayoutFloor}
            locs={selectedLocations}
            onUpload={saveFloor}
          />
        )}

        {tab === "requests" && (
          <Requests
            requests={requests}
            hospitals={hospitals}
            resources={resources}
            onAssign={assign}
            onEscalate={escalate}
            onAdvance={(req: Request, status: Request["status"]) => {
              db.upsert("requests", {
                ...req,
                status,
                updatedAt: new Date().toISOString(),
              });

              setTick();
            }}
          />
        )}

        {tab === "analytics" && (
          <Analytics data={data} hospitals={hospitals} />
        )}
      </section>
    </div>
  );
}

function CommandCenter({
  hospitals,
  requests,
  critical,
  resources,
  onSearch,
}: any) {
  const activeRequests = requests.filter(
    (r: Request) => !["RESOLVED", "REJECTED"].includes(r.status)
  );

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">CAREGRID NETWORK</div>
          <h1>Command Center</h1>
          <p>Regional resource coordination across connected hospitals.</p>
        </div>

        <button className="primary" onClick={onSearch}>
          <Search size={16} />
          Search network resources
        </button>
      </div>

      <div className="metrics">
        {[
          [hospitals.length, "Registered hospitals", ""],
          [activeRequests.length, "Active emergencies", "danger"],
          [critical.length, "Critical shortages", "danger"],
          [
            resources.filter((r: Resource) => r.available > 0).length,
            "Resource records available",
            "",
          ],
        ].map((m: any) => (
          <div className="metric" key={m[1]}>
            <strong className={m[2]}>{m[0]}</strong>
            <span>{m[1]}</span>
          </div>
        ))}
      </div>

      <div className="grid two">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Emergency request queue</h2>
              <p>Requests requiring coordination</p>
            </div>
          </div>

          {activeRequests.slice(0, 8).map((r: Request) => (
            <div className="queue-row" key={r.id}>
              <div>
                <Badge value={r.priority} />
                <b>
                  {r.quantity} × {r.resourceName}
                </b>
                <small>
                  {
                    hospitals.find(
                      (h: Hospital) => h.id === r.requestingHospitalId
                    )?.name
                  }
                </small>
              </div>

              <span>{r.status}</span>
            </div>
          ))}

          {activeRequests.length === 0 && (
            <div className="empty">No active emergency requests.</div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Hospital network</h2>
          </div>

          {hospitals.map((h: Hospital) => (
            <div className="hospital-row" key={h.id}>
              <span className="status-dot" />

              <div>
                <b>{h.name}</b>
                <small>{h.city}</small>
              </div>

              <Badge value={h.status} />
            </div>
          ))}
        </section>
      </div>
    </>
  );
}

function SearchPage({
  q,
  setQ,
  qty,
  setQty,
  matches,
  onAssign,
  requests,
  hospitals,
  locations,
}: any) {
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">NETWORK RESOURCE SEARCH</div>
          <h1>Find a resource</h1>
          <p>Only hospitals with enough available quantity are shown.</p>
        </div>
      </div>

      <div className="searchbar">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="O- Blood, Oxygen, ICU Beds..."
        />

        <input
          type="number"
          min="1"
          value={qty}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
        />

        <button className="primary">Search</button>
      </div>

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Hospital</th>
              <th>Resource</th>
              <th>Available</th>
              <th>Location</th>
              <th>Match</th>
              <th />
            </tr>
          </thead>

          <tbody>
            {matches.map((r: Resource) => (
              <tr key={r.id}>
                <td>
                  <b>
                    {
                      hospitals.find(
                        (h: Hospital) => h.id === r.hospitalId
                      )?.name
                    }
                  </b>
                </td>

                <td>{r.name}</td>

                <td>{r.available}</td>

                <td>
                  {locations.find(
                    (l: Location) => l.id === r.locationId
                  )?.name || "—"}
                </td>

                <td>
                  <Badge value="AVAILABLE" />
                </td>

                <td>
                  <button
                    className="primary compact"
                    onClick={() => {
                      const req = requests.find(
                        (x: Request) =>
                          x.resourceName.toLowerCase() ===
                            r.name.toLowerCase() &&
                          x.quantity <= r.available &&
                          !["RESOLVED", "REJECTED"].includes(x.status) &&
                          x.requestingHospitalId !== r.hospitalId
                      );

                      if (req) {
                        onAssign(req, r);
                      } else {
                        alert(
                          "No matching open request for this resource."
                        );
                      }
                    }}
                  >
                    Assign source
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {matches.length === 0 && (
          <div className="empty">
            No connected hospital can satisfy {qty} units of “{q}”.
          </div>
        )}
      </div>
    </>
  );
}

function Layouts({
  hospitals,
  floors,
  selectedHospital,
  setSelectedHospital,
  floor,
  setFloor,
  locs,
  onUpload,
}: any) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">HOSPITAL LAYOUTS</div>
          <h1>Network facility maps</h1>
          <p>
            View and maintain floor plans for connected hospitals.
          </p>
        </div>

        <label className="primary file-btn">
          <Upload size={16} />
          Add floor / layout

          <input
            hidden
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) =>
              e.target.files?.[0] && onUpload(e.target.files[0])
            }
          />
        </label>
      </div>

      <div className="layout-toolbar">
        <select
          value={selectedHospital}
          onChange={(e) => setSelectedHospital(e.target.value)}
        >
          {hospitals.map((h: Hospital) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>

        <select
          value={floor?.id || ""}
          onChange={(e) => setFloor(e.target.value)}
        >
          {floors
            .filter((f: Floor) => f.hospitalId === selectedHospital)
            .map((f: Floor) => (
              <option key={f.id} value={f.id}>
                {f.name} · {f.level}
              </option>
            ))}
        </select>
      </div>

      {!floor ? (
        <div className="empty">
          No floor plan for this hospital yet. Upload one above.
        </div>
      ) : (
        <div className="layout-grid">
          <section className="panel floor-panel">
            <div className="floor-canvas">
              <img src={floor.image} />

              {locs.map((l: Location) => (
                <button
                  className={`map-pin ${l.type}`}
                  key={l.id}
                  style={{
                    left: `${l.x}%`,
                    top: `${l.y}%`,
                  }}
                  onClick={() => setSelected(l.id)}
                >
                  <span>{l.name}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2>{floor.name}</h2>
            <p>
              {floor.level} · {locs.length} stored locations
            </p>

            <div className="mini-list">
              {locs.map((l: Location) => (
                <div key={l.id}>
                  <span>{l.name}</span>
                  <small>{l.type}</small>
                </div>
              ))}
            </div>

            {selected && (
              <div className="selected-box">
                <b>
                  {locs.find((l: Location) => l.id === selected)?.name}
                </b>
                <p>
                  Network view is read-only for location graph editing.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function Requests({
  requests,
  hospitals,
  resources,
  onAssign,
  onEscalate,
  onAdvance,
}: any) {
  const active = requests.filter(
    (r: Request) => !["RESOLVED", "REJECTED"].includes(r.status)
  );

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">COORDINATION QUEUE</div>
          <h1>Emergency Requests</h1>
          <p>
            Coordinate resources between connected hospitals.
          </p>
        </div>
      </div>

      <div className="request-list">
        {active.length === 0 ? (
          <div className="empty">No active requests.</div>
        ) : (
          active.map((r: Request) => (
            <div className="request-card" key={r.id}>
              <div>
                <div className="request-title">
                  <Badge value={r.priority} />
                  <b>
                    {r.quantity} × {r.resourceName}
                  </b>
                </div>

                <p>
                  {
                    hospitals.find(
                      (h: Hospital) => h.id === r.requestingHospitalId
                    )?.name
                  }{" "}
                  · {r.status}
                </p>
              </div>

              <div className="request-actions">
                {(r.status === "RAISED" ||
                  r.status === "SEARCHING") && (
                  <button
                    className="primary"
                    onClick={() => {
                      const source = resources.find(
                        (x: Resource) =>
                          x.name.toLowerCase() ===
                            r.resourceName.toLowerCase() &&
                          x.available >= r.quantity &&
                          x.hospitalId !== r.requestingHospitalId
                      );

                      if (source) {
                        onAssign(r, source);
                      } else {
                        onEscalate(r);
                        alert(
                          "No connected hospital currently has enough quantity."
                        );
                      }
                    }}
                  >
                    <Search size={15} />
                    Find & Assign
                  </button>
                )}

                {r.status === "ASSIGNED" && (
                  <span className="hint">
                    Waiting for source hospital acceptance
                  </span>
                )}

                {r.status === "ACCEPTED" && (
                  <button
                    className="primary"
                    onClick={() => onAdvance(r, "IN_TRANSIT")}
                  >
                    <Send size={15} />
                    Mark in transit
                  </button>
                )}

                {r.status === "IN_TRANSIT" && (
                  <button
                    className="primary"
                    onClick={() => onAdvance(r, "DELIVERED")}
                  >
                    Mark delivered
                  </button>
                )}

                {r.status === "DELIVERED" && (
                  <button
                    className="primary"
                    onClick={() => onAdvance(r, "RESOLVED")}
                  >
                    <CheckCircle size={15} />
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

function Analytics({ data, hospitals }: any) {
  const req: Request[] = data.requests || [];

  const total = req.length;

  const emergency = req.filter(
    (r) => r.priority === "EMERGENCY"
  ).length;

  const resolved = req.filter(
    (r) => r.status === "RESOLVED"
  ).length;

  const active = req.filter(
    (r) => !["RESOLVED", "REJECTED"].includes(r.status)
  ).length;

  const resources: Resource[] = data.resources || [];

  const utilization =
    resources.reduce(
      (sum, r) =>
        sum +
        (r.total ? (r.total - r.available) / r.total : 0),
      0
    ) / (resources.length || 1);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">OPERATIONS ANALYTICS</div>
          <h1>Network analytics</h1>
          <p>Figures are derived from stored CareGrid records.</p>
        </div>
      </div>

      <div className="metrics">
        {[
          [total, "Total requests", ""],
          [emergency, "Emergency requests", "danger"],
          [active, "Active requests", ""],
          [resolved, "Resolved requests", "good"],
          [
            Math.round(utilization * 100) + "%",
            "Resource utilization",
            "",
          ],
        ].map((m: any) => (
          <div className="metric" key={m[1]}>
            <strong className={m[2]}>{m[0]}</strong>
            <span>{m[1]}</span>
          </div>
        ))}
      </div>

      <div className="grid two">
        <section className="panel">
          <h2>Requests by priority</h2>

          {["NORMAL", "CRITICAL", "EMERGENCY"].map((p) => {
            const n = req.filter(
              (r) => r.priority === p
            ).length;

            return (
              <div className="bar-row" key={p}>
                <span>{p}</span>

                <div>
                  <i
                    style={{
                      width: `${
                        total
                          ? Math.max(4, (n / total) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>

                <b>{n}</b>
              </div>
            );
          })}
        </section>

        <section className="panel">
          <h2>Hospital capacity snapshot</h2>

          {hospitals.map((h: Hospital) => {
            const rs = resources.filter(
              (r) => r.hospitalId === h.id
            );

            const available = rs.reduce(
              (s, r) => s + r.available,
              0
            );

            const totalCapacity = rs.reduce(
              (s, r) => s + r.total,
              0
            );

            return (
              <div className="bar-row" key={h.id}>
                <span>{h.name}</span>

                <div>
                  <i
                    style={{
                      width: `${
                        totalCapacity
                          ? (available / totalCapacity) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>

                <b>
                  {available}/{totalCapacity}
                </b>
              </div>
            );
          })}
        </section>
      </div>
    </>
  );
}
