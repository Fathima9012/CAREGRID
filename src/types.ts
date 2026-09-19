export type ResourceType =
  | "ICU_BED"
  | "EMERGENCY_BED"
  | "GENERAL_BED"
  | "BLOOD_UNITS"
  | "OXYGEN"
  | "MEDICINES"
  | "IV_SETS"
  | "MEDICAL_SUPPLIES"
  | "EMERGENCY_EQUIPMENT"
  | "OTHER";

export type Status =
  | "AVAILABLE"
  | "LOW"
  | "CRITICAL"
  | "RESERVED"
  | "UNAVAILABLE";

export type LocationType =
  | "ROOM"
  | "WARD"
  | "STORAGE"
  | "ICU"
  | "EMERGENCY"
  | "PHARMACY"
  | "ELEVATOR"
  | "STAIRS"
  | "ENTRANCE"
  | "CORRIDOR"
  | "CHECKPOINT";

export type Priority = "NORMAL" | "CRITICAL" | "EMERGENCY";

export type RequestStatus =
  | "RAISED"
  | "ACKNOWLEDGED"
  | "SEARCHING"
  | "ASSIGNED"
  | "ACCEPTED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "RESOLVED"
  | "REJECTED";

export interface Hospital {
  id: string;
  name: string;
  city: string;
  status: "ACTIVE" | "BUSY" | "SURGE" | "OFFLINE";
}

export interface Floor {
  id: string;
  hospitalId: string;
  name: string;
  level: string;
  image: string;
}

export interface Location {
  id: string;
  hospitalId: string;
  floorId: string;
  name: string;
  type: LocationType;
  x: number;
  y: number;
  notes: string;
}

export interface Connection {
  id: string;
  hospitalId: string;
  from: string;
  to: string;
  weight: number;
  label: string;
}

export interface Resource {
  id: string;
  hospitalId: string;
  name: string;
  type: ResourceType;
  total: number;
  available: number;
  reserved: number;
  minimum: number;
  usagePerDay: number;
  unit: string;
  locationId?: string;
  updatedAt: string;
}

export interface Request {
  id: string;
  requestingHospitalId: string;
  resourceType: ResourceType;
  resourceName: string;
  quantity: number;
  priority: Priority;
  status: RequestStatus;
  sourceHospitalId?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  hospitalId: string;
  status: "ACTIVE" | "PREPARING" | "ARRIVED" | "RESOLVED";
  message: string;
  requiredResources: string[];
  createdAt: string;
  type?: "AMBULANCE_INCOMING";
}

export interface Activity {
  id: string;
  hospitalId?: string;
  action: string;
  detail: string;
  at: string;
}

export interface User {
  id: string;
  name: string;
  role: "HOSPITAL_STAFF" | "NETWORK_COORDINATOR";
  hospitalId?: string;
}

export interface RouteResult {
  path: Location[];
  distance: number;
  segments: { floor: Floor; locations: Location[] }[];
  directions: string[];
}

export const RESOURCE_TYPES: ResourceType[] = [
  "ICU_BED", "EMERGENCY_BED", "GENERAL_BED", "BLOOD_UNITS",
  "OXYGEN", "MEDICINES", "IV_SETS", "MEDICAL_SUPPLIES",
  "EMERGENCY_EQUIPMENT", "OTHER",
];

export const LOCATION_TYPES: LocationType[] = [
  "ROOM", "WARD", "STORAGE", "ICU", "EMERGENCY", "PHARMACY",
  "ELEVATOR", "STAIRS", "ENTRANCE", "CORRIDOR", "CHECKPOINT",
];

export const typeLabel = (t: string) =>
  t.replaceAll("_", " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
