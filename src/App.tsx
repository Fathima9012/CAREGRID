import React, { useEffect, useState } from "react";
import { db } from "./store";
import { User } from "./types";

import Login from "./components/Login";
import Shell from "./components/Shell";
import HospitalApp from "./components/HospitalApp";
import NetworkApp from "./components/NetworkApp";

export default function App() {
  const [data, setData] = useState(db.get());
  const [user, setUser] =
    useState<User | null>(null);

  const [, force] = useState(0);

  /*
   * Keep the application synchronized
   * whenever the CareGrid store changes.
   */
  useEffect(() => {
    const handleChange = () => {
      setData(db.get());
      force((x) => x + 1);
    };

    window.addEventListener(
      "caregrid-change",
      handleChange
    );

    return () => {
      window.removeEventListener(
        "caregrid-change",
        handleChange
      );
    };
  }, []);

  /*
   * Refresh application data.
   */
  const refresh = () => {
    setData(db.get());
    force((x) => x + 1);
  };

  /*
   * Export complete CareGrid database.
   */
  const exportData = () => {
    const blob = new Blob(
      [db.export()],
      {
        type: "application/json",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;
    a.download =
      "caregrid-backup.json";

    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  };

  /*
   * Import CareGrid backup.
   */
  const importData = (
    file: File
  ) => {
    const reader =
      new FileReader();

    reader.onload = () => {
      try {
        const parsed =
          JSON.parse(
            String(reader.result)
          );

        /*
         * Basic validation so an
         * unrelated JSON file cannot
         * overwrite the database.
         */
        if (
          !parsed ||
          !Array.isArray(
            parsed.hospitals
          ) ||
          !Array.isArray(
            parsed.resources
          ) ||
          !Array.isArray(
            parsed.floors
          ) ||
          !Array.isArray(
            parsed.locations
          ) ||
          !Array.isArray(
            parsed.requests
          )
        ) {
          throw new Error(
            "Invalid backup"
          );
        }

        localStorage.setItem(
          "caregrid_db_v1",
          JSON.stringify(parsed)
        );

        refresh();

        alert(
          "CareGrid data imported successfully."
        );
      } catch {
        alert(
          "Invalid CareGrid backup JSON."
        );
      }
    };

    reader.onerror = () => {
      alert(
        "Unable to read the backup file."
      );
    };

    reader.readAsText(file);
  };

  /*
   * Login screen.
   */
  if (!user) {
    return (
      <Login
        hospitals={
          data.hospitals
        }
        onLogin={setUser}
      />
    );
  }

  /*
   * Main application.
   */
  return (
    <Shell
      user={user}
      onLogout={() =>
        setUser(null)
      }
      onReset={() => {
        if (
          confirm(
            "Reset all CareGrid demo data?"
          )
        ) {
          db.reset();
          refresh();
        }
      }}
      onExport={exportData}
      onImport={importData}
    >
      {user.role ===
      "NETWORK_COORDINATOR" ? (
        <NetworkApp
          user={user}
          data={data}
          setTick={refresh}
        />
      ) : (
        <HospitalApp
          user={user}
          data={data}
          setTick={refresh}
        />
      )}
    </Shell>
  );
}