-- DATA-05: receipt claim, conditional record write and event insertion use one D1 batch.
CREATE TABLE mutation_operations (
  caller_scope TEXT NOT NULL,
  store_id TEXT NOT NULL REFERENCES stores(id),
  family TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  request_json TEXT NOT NULL CHECK (json_valid(request_json)),
  result_json TEXT NOT NULL CHECK (json_valid(result_json)),
  PRIMARY KEY (caller_scope, store_id, family, record_id, action, operation_id)
);
CREATE TABLE change_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caller_scope TEXT NOT NULL,
  store_id TEXT NOT NULL,
  family TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  prior_revision INTEGER NOT NULL CHECK (prior_revision BETWEEN 0 AND 9007199254740990),
  revision INTEGER NOT NULL CHECK (revision = prior_revision + 1),
  occurred_at TEXT NOT NULL,
  actor_json TEXT NOT NULL CHECK (json_valid(actor_json)),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  UNIQUE (store_id, family, record_id, revision),
  FOREIGN KEY (store_id, family, record_id) REFERENCES records(store_id, family, id),
  FOREIGN KEY (caller_scope, store_id, family, record_id, action, operation_id)
    REFERENCES mutation_operations(caller_scope, store_id, family, record_id, action, operation_id)
);
CREATE INDEX change_events_record ON change_events(store_id, family, record_id, revision);
CREATE TRIGGER change_events_no_update BEFORE UPDATE ON change_events BEGIN SELECT RAISE(ABORT, 'history_append_only'); END;
CREATE TRIGGER change_events_no_delete BEFORE DELETE ON change_events BEGIN SELECT RAISE(ABORT, 'history_append_only'); END;
CREATE TRIGGER mutation_operations_no_update BEFORE UPDATE ON mutation_operations BEGIN SELECT RAISE(ABORT, 'operation_immutable'); END;
CREATE TRIGGER mutation_operations_no_delete BEFORE DELETE ON mutation_operations BEGIN SELECT RAISE(ABORT, 'operation_immutable'); END;
