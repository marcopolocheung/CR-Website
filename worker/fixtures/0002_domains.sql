-- Local fixture only: policy table intentionally empty.
INSERT INTO cash_closes (store_id,id,state,actual_deposit_cents) VALUES ('CR3','fixture-close-1','incomplete',0);
INSERT INTO records (store_id,family,id,revision,context_kind,created_at,updated_at,data_json) VALUES ('CR3','catalog','fixture-catalog-1',1,'undated','2026-10-24T12:00:00.000Z','2026-10-24T12:00:00.000Z','{}');
INSERT INTO catalogs VALUES ('CR3','catalog','fixture-catalog-1','fixture-v1','{"itemLabel":"Producto original","unit":null}');
INSERT INTO records (store_id,family,id,revision,context_kind,business_date,created_at,updated_at,data_json) VALUES ('CR3','count','fixture-count-1',1,'day','2026-10-24','2026-10-24T12:00:00.000Z','2026-10-24T12:00:00.000Z','{}');
INSERT INTO count_sessions VALUES ('CR3','count','fixture-count-1','fixture-catalog-1','fixture-v1','open');
INSERT INTO count_lines (store_id,session_id,id,item_snapshot_json,response,quantity_raw) VALUES ('CR3','fixture-count-1','raw','{"label":"Producto original"}','measured','3B/2T'),('CR3','fixture-count-1','zero','{"label":"Zero"}','measured-zero','0'),('CR3','fixture-count-1','uncounted','{"label":"Uncounted"}','uncounted',NULL),('CR3','fixture-count-1','enough','{"label":"Enough"}','enough',NULL),('CR3','fixture-count-1','skipped','{"label":"Skipped"}','skipped',NULL);
