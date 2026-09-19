-- Reference schema for moving CareGrid from the browser demo store to Supabase/PostgreSQL.
create table if not exists hospitals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  status text not null default 'ACTIVE'
);
create table if not exists floors (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  name text not null,
  level text not null,
  layout_image_url text not null
);
create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  floor_id uuid not null references floors(id) on delete cascade,
  name text not null,
  type text not null,
  x double precision not null check (x >= 0 and x <= 100),
  y double precision not null check (y >= 0 and y <= 100),
  notes text default ''
);
create table if not exists location_connections (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  from_location_id uuid not null references locations(id) on delete cascade,
  to_location_id uuid not null references locations(id) on delete cascade,
  weight double precision not null check (weight > 0),
  label text default ''
);
create table if not exists resources (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  name text not null,
  type text not null,
  quantity numeric not null check (quantity >= 0),
  available numeric not null check (available >= 0),
  reserved numeric not null check (reserved >= 0),
  minimum_safe_level numeric not null default 0,
  usage_per_day numeric not null default 0,
  unit text not null,
  location_id uuid references locations(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table if not exists resource_requests (
  id uuid primary key default gen_random_uuid(),
  requesting_hospital_id uuid not null references hospitals(id),
  resource_type text not null,
  resource_name text not null,
  quantity numeric not null check (quantity > 0),
  priority text not null,
  status text not null,
  source_hospital_id uuid references hospitals(id),
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists ambulance_alerts (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  status text not null,
  message text not null,
  created_at timestamptz not null default now()
);
create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid references hospitals(id) on delete set null,
  action text not null,
  detail text not null,
  timestamp timestamptz not null default now()
);

-- In production, add Supabase Storage for floor-plan images and RLS policies:
-- hospital users: CRUD only for their hospital's rows.
-- network coordinators: read all hospitals and write approved layout rows.
