import React, { useState } from "react";
import {
  Activity,
  ShieldCheck,
  Hospital as Hosp,
  Network,
  ArrowRight,
} from "lucide-react";
import {
  Hospital,
  User,
} from "../types";

type Props = {
  hospitals: Hospital[];
  onLogin: (user: User) => void;
};

export default function Login({
  hospitals,
  onLogin,
}: Props) {
  const [portal, setPortal] =
    useState<
      "HOSPITAL" | "NETWORK"
    >("HOSPITAL");

  const [hospitalId, setHospitalId] =
    useState(
      hospitals[0]?.id || ""
    );

  const [name, setName] =
    useState("");

  const loginHospital = () => {
    if (!hospitalId) {
      alert(
        "Please select a hospital."
      );
      return;
    }

    onLogin({
      id: crypto.randomUUID(),
      name:
        name.trim() ||
        "Hospital Staff",
      role: "HOSPITAL_STAFF",
      hospitalId,
    });
  };

  const loginNetwork = () => {
    onLogin({
      id: crypto.randomUUID(),
      name:
        name.trim() ||
        "Network Coordinator",
      role: "NETWORK_COORDINATOR",
    });
  };

  return (
    <div className="login">
      <div className="login-card">
        <div className="brand">
          <div className="brand-mark">
            <Activity size={24} />
          </div>

          <div>
            <b>CareGrid</b>

            <span>
              Hospital Resource Coordination
              & Emergency Response
            </span>
          </div>
        </div>

        <div className="login-tabs">
          <button
            className={
              portal === "HOSPITAL"
                ? "active"
                : ""
            }
            onClick={() => {
              setPortal("HOSPITAL");
              setName("");
            }}
          >
            <Hosp size={17} />
            Hospital
          </button>

          <button
            className={
              portal === "NETWORK"
                ? "active"
                : ""
            }
            onClick={() => {
              setPortal("NETWORK");
              setName("");
            }}
          >
            <Network size={17} />
            Network
          </button>
        </div>

        {portal === "HOSPITAL" ? (
          <>
            <label>
              Hospital
            </label>

            <select
              value={hospitalId}
              onChange={(e) =>
                setHospitalId(
                  e.target.value
                )
              }
            >
              {hospitals.length ===
              0 ? (
                <option value="">
                  No hospitals available
                </option>
              ) : (
                hospitals.map(
                  (hospital) => (
                    <option
                      key={
                        hospital.id
                      }
                      value={
                        hospital.id
                      }
                    >
                      {
                        hospital.name
                      }{" "}
                      —{" "}
                      {
                        hospital.city
                      }
                    </option>
                  )
                )
              )}
            </select>

            <label>
              Staff name
            </label>

            <input
              placeholder="e.g. Emergency Charge Nurse"
              value={name}
              onChange={(e) =>
                setName(
                  e.target.value
                )
              }
              onKeyDown={(e) => {
                if (
                  e.key ===
                  "Enter"
                ) {
                  loginHospital();
                }
              }}
            />

            <button
              className="primary wide"
              onClick={
                loginHospital
              }
              disabled={
                !hospitalId
              }
            >
              <ShieldCheck
                size={17}
              />

              Enter Hospital
              Interface

              <ArrowRight
                size={17}
              />
            </button>

            <p className="hint">
              Prototype authentication:
              choose a hospital and role
              context. Data and permissions
              are enforced by hospital scope.
            </p>
          </>
        ) : (
          <>
            <label>
              Coordinator name
            </label>

            <input
              placeholder="e.g. Network Coordinator"
              value={name}
              onChange={(e) =>
                setName(
                  e.target.value
                )
              }
              onKeyDown={(e) => {
                if (
                  e.key ===
                  "Enter"
                ) {
                  loginNetwork();
                }
              }}
            />

            <button
              className="primary wide"
              onClick={
                loginNetwork
              }
            >
              <Network
                size={17}
              />

              Enter Network
              Command Center

              <ArrowRight
                size={17}
              />
            </button>

            <p className="hint">
              Network users can coordinate
              transfers and manage or view
              registered hospital layouts.
            </p>
          </>
        )}

        <div className="demo-note">
          <b>
            Live demo ready
          </b>

          <span>
            Seeded hospitals, resources,
            layouts and emergency transfer
            data persist after refresh.
          </span>
        </div>
      </div>
    </div>
  );
}