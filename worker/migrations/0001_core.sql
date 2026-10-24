-- DATA-02: additive foundations. No KV migration, approved policies or real staff.
CREATE TABLE stores (
  id TEXT PRIMARY KEY CHECK (id IN ('CR2', 'CR3'))
);
INSERT INTO stores VALUES ('CR2'), ('CR3');
CREATE TABLE stations (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id),
  UNIQUE (store_id, id),
  CHECK ((id IN ('CR2-kitchen', 'CR2-diningroom') AND store_id = 'CR2') OR
         (id IN ('CR3-kitchen', 'CR3-diningroom') AND store_id = 'CR3'))
);
INSERT INTO stations VALUES ('CR2-kitchen','CR2'),('CR2-diningroom','CR2'),('CR3-kitchen','CR3'),('CR3-diningroom','CR3');
CREATE TABLE policy_versions (
  decision_id TEXT NOT NULL CHECK (decision_id IN ('DEC-01','DEC-02','DEC-03','DEC-04','DEC-05','DEC-06','DEC-07')),
  version TEXT NOT NULL,
  approved_by TEXT NOT NULL CHECK (length(trim(approved_by)) > 0),
  approved_at TEXT NOT NULL,
  value_json TEXT NOT NULL CHECK (json_valid(value_json)),
  PRIMARY KEY (decision_id, version)
);
CREATE TABLE employees (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  revision INTEGER NOT NULL CHECK (revision BETWEEN 1 AND 9007199254740991),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE employee_memberships (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  store_id TEXT NOT NULL REFERENCES stores(id),
  station_id TEXT,
  effective_from TEXT,
  effective_until TEXT,
  policy_decision TEXT NOT NULL DEFAULT 'DEC-04' CHECK (policy_decision = 'DEC-04'),
  policy_version TEXT,
  FOREIGN KEY (store_id, station_id) REFERENCES stations(store_id, id),
  FOREIGN KEY (policy_decision, policy_version) REFERENCES policy_versions(decision_id, version),
  CHECK (effective_until IS NULL OR effective_from IS NULL OR effective_until >= effective_from)
);
CREATE TABLE employee_mappings (
  id TEXT PRIMARY KEY,
  source_system TEXT NOT NULL,
  source_scope TEXT NOT NULL,
  external_id TEXT NOT NULL,
  employee_id TEXT REFERENCES employees(id),
  state TEXT NOT NULL CHECK (state IN ('unmapped','reviewed')),
  effective_context TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TEXT,
  CHECK ((state = 'unmapped' AND employee_id IS NULL AND reviewed_by IS NULL AND reviewed_at IS NULL) OR
         (state = 'reviewed' AND employee_id IS NOT NULL AND reviewed_by IS NOT NULL AND length(trim(reviewed_by)) > 0 AND reviewed_at IS NOT NULL)),
  UNIQUE (source_system, source_scope, external_id, effective_context)
);
CREATE TABLE records (
  store_id TEXT NOT NULL REFERENCES stores(id),
  family TEXT NOT NULL CHECK (family IN ('employee','membership','employee-mapping','schedule','schedule-request','cash-close','catalog','count','order','receipt','stock-event','import','form','follow-up','attachment')),
  id TEXT NOT NULL,
  station_id TEXT,
  schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  revision INTEGER NOT NULL CHECK (revision BETWEEN 1 AND 9007199254740991),
  context_kind TEXT NOT NULL CHECK (context_kind IN ('day','period','undated')),
  business_date TEXT,
  period_start TEXT,
  period_end TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  data_json TEXT NOT NULL CHECK (json_valid(data_json)),
  PRIMARY KEY (store_id, family, id),
  FOREIGN KEY (store_id, station_id) REFERENCES stations(store_id, id),
  CHECK ((context_kind = 'day' AND business_date IS NOT NULL AND period_start IS NULL AND period_end IS NULL) OR
         (context_kind = 'period' AND business_date IS NULL AND period_start IS NOT NULL AND period_end IS NOT NULL AND period_start <= period_end) OR
         (context_kind = 'undated' AND business_date IS NULL AND period_start IS NULL AND period_end IS NULL))
);
CREATE INDEX records_context ON records(store_id, family, business_date, period_start);
CREATE TABLE legacy_snapshots (
  snapshot_id TEXT NOT NULL,
  source_key TEXT NOT NULL,
  raw_value_base64 TEXT NOT NULL,
  metadata_json TEXT CHECK (metadata_json IS NULL OR json_valid(metadata_json)),
  expiration INTEGER,
  checksum TEXT NOT NULL,
  classification TEXT NOT NULL CHECK (classification IN ('retained','quarantined')),
  reason_code TEXT,
  PRIMARY KEY (snapshot_id, source_key)
);
CREATE TABLE record_lineage (
  snapshot_id TEXT NOT NULL,
  source_key TEXT NOT NULL,
  store_id TEXT NOT NULL,
  family TEXT NOT NULL,
  record_id TEXT NOT NULL,
  PRIMARY KEY (snapshot_id, source_key, store_id, family, record_id),
  FOREIGN KEY (snapshot_id, source_key) REFERENCES legacy_snapshots(snapshot_id, source_key),
  FOREIGN KEY (store_id, family, record_id) REFERENCES records(store_id, family, id)
);
