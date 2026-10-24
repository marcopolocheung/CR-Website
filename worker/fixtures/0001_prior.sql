-- Synthetic prior-schema snapshot; contains no real employees, business rules or credentials.
INSERT INTO employees VALUES ('fixture-employee-1','Persona de prueba',1,1,'2026-10-24T12:00:00.000Z','2026-10-24T12:00:00.000Z');
INSERT INTO employee_mappings (id,source_system,source_scope,external_id,state,effective_context) VALUES ('fixture-map-1','fixture-payroll','CR3-kitchen','fixture-external-1','unmapped','fixture-period');
INSERT INTO records (store_id,family,id,revision,context_kind,business_date,created_at,updated_at,data_json) VALUES ('CR3','cash-close','fixture-close-1',1,'day','2026-10-24','2026-10-24T12:00:00.000Z','2026-10-24T12:00:00.000Z','{"narrative":"Texto original","sourceCents":0}');
INSERT INTO legacy_snapshots VALUES ('fixture-snapshot','cashout:CR3:2026-10-24','e30=',NULL,NULL,'fixture-checksum','retained',NULL);
INSERT INTO record_lineage VALUES ('fixture-snapshot','cashout:CR3:2026-10-24','CR3','cash-close','fixture-close-1');
