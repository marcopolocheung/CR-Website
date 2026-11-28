-- DEC-03-FILES (owner-approved 2026-11-27): keep-forever policy for company files.
-- Seeds the policy row that attachments with status 'available' must reference. No table changes.
INSERT INTO policy_versions (decision_id, version, approved_by, approved_at, value_json) VALUES (
  'DEC-03', 'attachments-v1', 'owner', '2026-11-27T00:00:00Z',
  '{"family":"attachment","retention":"forever","versions":"all","trash":"forever","maxBytes":26214400,"types":["xlsx","xls","csv","pdf","docx","doc","png","jpg","jpeg","heic"]}'
);
