import React from "react";
import {
  Activity,
  LogOut,
  RefreshCcw,
  Download,
  Upload,
} from "lucide-react";
import { User } from "../types";

type Props = {
  user: User;
  onLogout: () => void;
  onReset: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  children: React.ReactNode;
};

export default function Shell({
  user,
  onLogout,
  onReset,
  onExport,
  onImport,
  children,
}: Props) {
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand small">
          <div className="brand-mark">
            <Activity size={20} />
          </div>

          <div>
            <b>CareGrid</b>
            <span>
              Resource coordination network
            </span>
          </div>
        </div>

        <div className="top-actions">
          <span className="live">
            <i />
            LIVE DATA
          </span>

          <span className="user-chip">
            {user.name} ·{" "}
            {user.role ===
            "NETWORK_COORDINATOR"
              ? "Network Coordinator"
              : "Hospital Staff"}
          </span>

          <button
            className="icon-btn"
            title="Export data"
            onClick={onExport}
          >
            <Download size={16} />
          </button>

          <label
            className="icon-btn"
            title="Import data"
          >
            <Upload size={16} />

            <input
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                const file =
                  e.target.files?.[0];

                if (file) {
                  onImport(file);
                  e.target.value = "";
                }
              }}
            />
          </label>

          <button
            className="icon-btn"
            title="Reset demo data"
            onClick={onReset}
          >
            <RefreshCcw size={16} />
          </button>

          <button
            className="icon-btn"
            title="Log out"
            onClick={onLogout}
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}