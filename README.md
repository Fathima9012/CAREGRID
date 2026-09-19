# CareGrid — Hospital Resource Coordination & Emergency Response

Hackathon-ready React/Vite prototype built from scratch using the uploaded CareGrid concept as the visual/product reference.

## What is implemented

- Separate login page with exactly two post-login interfaces:
  - Hospital Interface: Dashboard, Resources, Layout & Navigation, Emergency Center
  - Network Coordinator Interface: Command Center, Resource Search, Hospital Layouts, Emergency Requests, Analytics
- Persistent browser data store (`localStorage`) with seed/demo data.
- CRUD for hospital resources.
- Explainable shortage prediction: `(available - minimum safe level) / usage per day`.
- Normal and emergency resource requests.
- Cross-hospital quantity matching — a source is only assignable when `available >= requested`.
- Source-hospital accept/reject workflow.
- Transfer state flow: RAISED → SEARCHING → ASSIGNED → ACCEPTED → IN TRANSIT → DELIVERED → RESOLVED.
- Source reservation and delivery inventory updates.
- One-action incoming ambulance alert.
- Discharge +1 availability update.
- Upload real PNG/JPG/JPEG/WEBP floor plans; 8 MB validation.
- Floor records are hospital-scoped.
- Click-to-place location editor with relative x/y coordinates.
- Stored location graph and user-created connections.
- Multi-floor graph edges.
- Dijkstra shortest path over stored graph — no hard-coded navigation graph.
- Route overlay drawn over the actual uploaded floor image.
- Network Coordinator can add floor plans to any registered hospital; hospital staff consume the same stored layout.
- Network layout viewer is read-only for graph edits.
- Data export/import for live demo backup.
- Responsive desktop/tablet/mobile layout.
- Analytics derived from stored records rather than hard-coded numbers.

## Run

Requires Node.js 18+.

```bash
npm install
npm run dev
```
local run link: http://localhost:3000

Open the Vite URL shown in the terminal.

## Live demo

1. Enter **Hospital Interface → City Care Hospital**.
2. Open **Emergency Center** and raise `3 × O- Blood`.
3. The seeded hospital has only `1` unit, so the request remains available for network coordination.
4. Log out and enter **Network Coordinator**.
5. Open **Emergency Requests** and click **Find & Assign**.
6. Coastal Medical Centre has `5` units, so it is quantity-matched and assigned.
7. Log out and enter **Hospital Interface → Coastal Medical Centre**.
8. Open **Emergency Center** and click **Accept**.
9. Advance the request to **In Transit → Delivered**.
10. The source reservation is released on delivery and the request resolves at the receiving hospital.
11. Open **Hospital Layouts** as Network Coordinator to view the source hospital's floor plan.
12. Open **Layout & Navigation** at the hospital and select Emergency Ward → Blood Storage to calculate the stored-graph route.

## Real layout demo

Use **Network Coordinator → Hospital Layouts → Add floor / layout** to upload a real hospital floor plan. Then, in the hospital interface, use **Layout & Navigation → Place Location**, click the image, name/type the node, and create connections. The image is only the visual layer; the structured locations and connections are the navigation graph.

Replace/update floor images later by uploading another floor record. Existing graph records remain editable/deletable from the hospital layout editor.

## Persistence

This version intentionally works without external credentials so it can be demonstrated immediately and persist data across refreshes. The persistence layer is isolated in `src/store.ts`; a Supabase/PostgreSQL adapter can replace it without changing the UI workflow.

A reference PostgreSQL schema is included in `supabase/schema.sql`.

## Important prototype boundary

Authentication is intentionally a lightweight hackathon role-context login, not production identity management. For production deployment, connect the same two interfaces to Supabase Auth/RLS or an enterprise identity provider and enforce hospital-level authorization server-side.
