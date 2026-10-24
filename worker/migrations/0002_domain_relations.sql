-- DATA-02: domain relationships only. Service validators own transitions/calculations.
CREATE TABLE catalogs (
  store_id TEXT NOT NULL,
  family TEXT NOT NULL DEFAULT 'catalog' CHECK (family = 'catalog'),
  id TEXT NOT NULL,
  version TEXT NOT NULL,
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  PRIMARY KEY (store_id, id),
  UNIQUE (store_id, id, version),
  FOREIGN KEY (store_id, family, id) REFERENCES records(store_id, family, id)
);
CREATE TABLE count_sessions (
  store_id TEXT NOT NULL,
  family TEXT NOT NULL DEFAULT 'count' CHECK (family = 'count'),
  id TEXT NOT NULL,
  catalog_id TEXT NOT NULL,
  catalog_version TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('open','completed')),
  PRIMARY KEY (store_id, id),
  FOREIGN KEY (store_id, family, id) REFERENCES records(store_id, family, id),
  FOREIGN KEY (store_id, catalog_id, catalog_version) REFERENCES catalogs(store_id, id, version)
);
CREATE TABLE count_lines (
  store_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  id TEXT NOT NULL,
  item_snapshot_json TEXT NOT NULL CHECK (json_valid(item_snapshot_json)),
  response TEXT NOT NULL CHECK (response IN ('uncounted','measured-zero','measured','enough','skipped')),
  quantity_raw TEXT,
  quantity_encoding TEXT,
  unit_snapshot_json TEXT CHECK (unit_snapshot_json IS NULL OR json_valid(unit_snapshot_json)),
  skip_reason TEXT,
  PRIMARY KEY (store_id, session_id, id),
  FOREIGN KEY (store_id, session_id) REFERENCES count_sessions(store_id, id),
  CHECK (quantity_encoding IS NULL), -- DEC-05 must approve an encoding before a later migration enables it.
  CHECK (response NOT IN ('measured','measured-zero') OR quantity_raw IS NOT NULL)
);
CREATE TABLE cash_closes (
  store_id TEXT NOT NULL,
  family TEXT NOT NULL DEFAULT 'cash-close' CHECK (family = 'cash-close'),
  id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('incomplete','submitted','reviewed')),
  expected_cents INTEGER CHECK (expected_cents IS NULL OR (typeof(expected_cents) = 'integer' AND abs(expected_cents) <= 9007199254740991)),
  actual_deposit_cents INTEGER CHECK (actual_deposit_cents IS NULL OR (typeof(actual_deposit_cents) = 'integer' AND abs(actual_deposit_cents) <= 9007199254740991)),
  policy_decision TEXT NOT NULL DEFAULT 'DEC-02' CHECK (policy_decision = 'DEC-02'),
  policy_version TEXT,
  PRIMARY KEY (store_id, id),
  FOREIGN KEY (store_id, family, id) REFERENCES records(store_id, family, id),
  FOREIGN KEY (policy_decision, policy_version) REFERENCES policy_versions(decision_id, version),
  CHECK (state = 'incomplete' OR policy_version IS NOT NULL)
);
CREATE TABLE purchase_orders (
  store_id TEXT NOT NULL,
  family TEXT NOT NULL DEFAULT 'order' CHECK (family = 'order'),
  id TEXT NOT NULL,
  count_session_id TEXT,
  state TEXT NOT NULL CHECK (state IN ('draft','issued','cancelled')),
  issued_snapshot_json TEXT CHECK (issued_snapshot_json IS NULL OR json_valid(issued_snapshot_json)),
  PRIMARY KEY (store_id, id),
  FOREIGN KEY (store_id, family, id) REFERENCES records(store_id, family, id),
  FOREIGN KEY (store_id, count_session_id) REFERENCES count_sessions(store_id, id),
  CHECK (state = 'draft' OR issued_snapshot_json IS NOT NULL)
);
CREATE TABLE order_lines (
  store_id TEXT NOT NULL, order_id TEXT NOT NULL, id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  PRIMARY KEY (store_id, order_id, id),
  FOREIGN KEY (store_id, order_id) REFERENCES purchase_orders(store_id, id)
);
CREATE TABLE receipts (
  store_id TEXT NOT NULL,
  family TEXT NOT NULL DEFAULT 'receipt' CHECK (family = 'receipt'),
  id TEXT NOT NULL, order_id TEXT NOT NULL,
  PRIMARY KEY (store_id, id), UNIQUE (store_id, id, order_id),
  FOREIGN KEY (store_id, family, id) REFERENCES records(store_id, family, id),
  FOREIGN KEY (store_id, order_id) REFERENCES purchase_orders(store_id, id)
);
CREATE TABLE receipt_lines (
  store_id TEXT NOT NULL, receipt_id TEXT NOT NULL, order_id TEXT NOT NULL, order_line_id TEXT NOT NULL, id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  PRIMARY KEY (store_id, receipt_id, id),
  FOREIGN KEY (store_id, receipt_id, order_id) REFERENCES receipts(store_id, id, order_id),
  FOREIGN KEY (store_id, order_id, order_line_id) REFERENCES order_lines(store_id, order_id, id)
);
CREATE TABLE schedules (
  store_id TEXT NOT NULL,
  family TEXT NOT NULL DEFAULT 'schedule' CHECK (family = 'schedule'),
  id TEXT NOT NULL, state TEXT NOT NULL CHECK (state IN ('draft','published')),
  published_snapshot_json TEXT CHECK (published_snapshot_json IS NULL OR json_valid(published_snapshot_json)),
  PRIMARY KEY (store_id, id),
  FOREIGN KEY (store_id, family, id) REFERENCES records(store_id, family, id),
  CHECK (state = 'draft' OR published_snapshot_json IS NOT NULL)
);
CREATE TABLE schedule_requests (
  store_id TEXT NOT NULL,
  family TEXT NOT NULL DEFAULT 'schedule-request' CHECK (family = 'schedule-request'),
  id TEXT NOT NULL, employee_id TEXT NOT NULL REFERENCES employees(id),
  state TEXT NOT NULL CHECK (state IN ('pending','approved','declined')),
  policy_decision TEXT NOT NULL DEFAULT 'DEC-01' CHECK (policy_decision = 'DEC-01'), policy_version TEXT,
  PRIMARY KEY (store_id, id),
  FOREIGN KEY (store_id, family, id) REFERENCES records(store_id, family, id),
  FOREIGN KEY (policy_decision, policy_version) REFERENCES policy_versions(decision_id, version),
  CHECK (state = 'pending' OR policy_version IS NOT NULL)
);
CREATE TABLE import_jobs (
  store_id TEXT NOT NULL,
  family TEXT NOT NULL DEFAULT 'import' CHECK (family = 'import'),
  id TEXT NOT NULL, fingerprint TEXT NOT NULL, source_slot TEXT NOT NULL, kind TEXT NOT NULL,
  parser_version TEXT NOT NULL, mapping_revision INTEGER NOT NULL CHECK (mapping_revision BETWEEN 0 AND 9007199254740991),
  supersedes_id TEXT,
  PRIMARY KEY (store_id, id),
  FOREIGN KEY (store_id, family, id) REFERENCES records(store_id, family, id),
  FOREIGN KEY (store_id, supersedes_id) REFERENCES import_jobs(store_id, id)
);
CREATE TABLE forms (
  store_id TEXT NOT NULL,
  family TEXT NOT NULL DEFAULT 'form' CHECK (family = 'form'),
  id TEXT NOT NULL, definition_version TEXT NOT NULL, employee_id TEXT REFERENCES employees(id),
  employee_name_snapshot TEXT NOT NULL, state TEXT NOT NULL CHECK (state IN ('draft','submitted')),
  submitted_snapshot_json TEXT CHECK (submitted_snapshot_json IS NULL OR json_valid(submitted_snapshot_json)),
  PRIMARY KEY (store_id, id),
  FOREIGN KEY (store_id, family, id) REFERENCES records(store_id, family, id),
  CHECK (state = 'draft' OR submitted_snapshot_json IS NOT NULL)
);
CREATE TABLE follow_ups (
  store_id TEXT NOT NULL,
  family TEXT NOT NULL DEFAULT 'follow-up' CHECK (family = 'follow-up'),
  id TEXT NOT NULL, parent_family TEXT NOT NULL, parent_id TEXT NOT NULL, due_date TEXT NOT NULL,
  assignee_employee_id TEXT REFERENCES employees(id), state TEXT NOT NULL CHECK (state IN ('open','resolved')),
  resolution_json TEXT CHECK (resolution_json IS NULL OR json_valid(resolution_json)),
  PRIMARY KEY (store_id, id),
  FOREIGN KEY (store_id, family, id) REFERENCES records(store_id, family, id),
  FOREIGN KEY (store_id, parent_family, parent_id) REFERENCES records(store_id, family, id),
  CHECK (state = 'open' OR resolution_json IS NOT NULL)
);
CREATE TABLE attachments (
  store_id TEXT NOT NULL,
  family TEXT NOT NULL DEFAULT 'attachment' CHECK (family = 'attachment'),
  id TEXT NOT NULL, parent_family TEXT NOT NULL, parent_id TEXT NOT NULL,
  parent_revision INTEGER NOT NULL CHECK (parent_revision BETWEEN 1 AND 9007199254740991),
  object_key TEXT UNIQUE, filename TEXT NOT NULL, media_type TEXT, byte_size INTEGER CHECK (byte_size IS NULL OR byte_size >= 0), checksum TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','available','failed')),
  policy_decision TEXT NOT NULL DEFAULT 'DEC-03' CHECK (policy_decision = 'DEC-03'), policy_version TEXT,
  PRIMARY KEY (store_id, id),
  FOREIGN KEY (store_id, family, id) REFERENCES records(store_id, family, id),
  FOREIGN KEY (store_id, parent_family, parent_id) REFERENCES records(store_id, family, id),
  FOREIGN KEY (policy_decision, policy_version) REFERENCES policy_versions(decision_id, version),
  CHECK (status != 'available' OR (object_key IS NOT NULL AND checksum IS NOT NULL AND byte_size IS NOT NULL AND policy_version IS NOT NULL))
);
CREATE TABLE stock_events (
  store_id TEXT NOT NULL,
  family TEXT NOT NULL DEFAULT 'stock-event' CHECK (family = 'stock-event'),
  id TEXT NOT NULL, destination_store_id TEXT REFERENCES stores(id),
  policy_decision TEXT NOT NULL DEFAULT 'DEC-05' CHECK (policy_decision = 'DEC-05'), policy_version TEXT NOT NULL,
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  PRIMARY KEY (store_id, id),
  FOREIGN KEY (store_id, family, id) REFERENCES records(store_id, family, id),
  FOREIGN KEY (policy_decision, policy_version) REFERENCES policy_versions(decision_id, version)
);
