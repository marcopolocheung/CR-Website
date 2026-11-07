var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../src/lib/internal-tools/contracts.ts
var SCHEMA_VERSION = 1;
var STATION_STORES = {
  "CR3-diningroom": "CR3",
  "CR3-kitchen": "CR3",
  "CR2-kitchen": "CR2",
  "CR2-diningroom": "CR2"
};
function isStoreId(value) {
  return value === "CR2" || value === "CR3";
}
__name(isStoreId, "isStoreId");
function isStationId(value) {
  return typeof value === "string" && Object.hasOwn(STATION_STORES, value);
}
__name(isStationId, "isStationId");
function businessDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "0001-01-01") return null;
  const date = /* @__PURE__ */ new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}
__name(businessDate, "businessDate");
function utcTimestamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value ? value : null;
}
__name(utcTimestamp, "utcTimestamp");
function opaque(value) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
}
__name(opaque, "opaque");
var recordId = /* @__PURE__ */ __name((value) => opaque(value) ? value : null, "recordId");
var operationId = /* @__PURE__ */ __name((value) => opaque(value) ? value : null, "operationId");
var revision = /* @__PURE__ */ __name((value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null, "revision");
var ERROR_STATUS = {
  validation_failed: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  revision_conflict: 409,
  operation_reused: 409,
  policy_unresolved: 409,
  unsupported_schema: 400,
  rate_limited: 429,
  backend_unconfigured: 503,
  unavailable: 503
};
function apiError(code, detail = {}) {
  return { schemaVersion: SCHEMA_VERSION, error: { ...detail, code } };
}
__name(apiError, "apiError");

// ../src/lib/internal-tools/json.ts
function canonicalJson(value) {
  const seen = /* @__PURE__ */ new Set();
  function encode(input) {
    if (input === null || typeof input === "boolean" || typeof input === "string") return JSON.stringify(input);
    if (typeof input === "number" && Number.isFinite(input)) return JSON.stringify(input);
    if (!input || typeof input !== "object" || seen.has(input)) throw new Error("invalid_json");
    if (!Array.isArray(input) && Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null) throw new Error("invalid_json");
    seen.add(input);
    try {
      if (Array.isArray(input)) {
        return "[" + Array.from({ length: input.length }, (_, index) => encode(input[index])).join(",") + "]";
      }
      return "{" + Object.keys(input).sort().map((key2) => JSON.stringify(key2) + ":" + encode(input[key2])).join(",") + "}";
    } finally {
      seen.delete(input);
    }
  }
  __name(encode, "encode");
  return encode(value);
}
__name(canonicalJson, "canonicalJson");

// ../src/lib/scheduler/types.ts
var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
var DINING_ROLES = ["server", "cashier", "lead", "manager"];
var KITCHEN_ROLES = [
  "cook",
  "line-cook",
  "fried-rice",
  "dishwasher",
  "meat-prep",
  "veggie-prep",
  "mv-prep",
  "shadow",
  "manager"
];
var ROLES = Array.from(/* @__PURE__ */ new Set([...DINING_ROLES, ...KITCHEN_ROLES]));

// ../src/lib/scheduler/week.ts
var DAY_MS = 24 * 60 * 60 * 1e3;
function toUtcMs(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}
__name(toUtcMs, "toUtcMs");
function toIsoDate(utcMs) {
  return new Date(utcMs).toISOString().slice(0, 10);
}
__name(toIsoDate, "toIsoDate");
function dateForDay(weekStart, day) {
  return toIsoDate(toUtcMs(weekStart) + DAYS.indexOf(day) * DAY_MS);
}
__name(dateForDay, "dateForDay");

// ../src/lib/scheduler/requests.ts
var REQUEST_POLICY = "DEC-01-v1";
var MAX_REQUESTS = 200;
function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
__name(object, "object");
function keys(value, names) {
  return Object.keys(value).length === names.length && names.every((name) => Object.hasOwn(value, name));
}
__name(keys, "keys");
function text(value, max, required = true) {
  return typeof value === "string" && value.length <= max && (!required || value.trim().length > 0);
}
__name(text, "text");
function validRequest(value, station) {
  if (!object(value) || !keys(value, ["id", "employee", "kind", "startDate", "endDate", "ranges", "reason", "requestedAt", "enteredBy", "enteredAt", "policyVersion", "status", "review"])) return false;
  if (!recordId(value.id) || !object(value.employee) || !keys(value.employee, ["stationId", "sourceEmployeeId", "name"]) || value.employee.stationId !== station || !text(value.employee.sourceEmployeeId, 128) || !text(value.employee.name, 120)) return false;
  if (!businessDate(value.startDate) || !businessDate(value.endDate) || value.startDate > value.endDate || Date.parse(value.endDate) - Date.parse(value.startDate) > 365 * 864e5) return false;
  if (value.policyVersion !== REQUEST_POLICY || !utcTimestamp(value.requestedAt) || !utcTimestamp(value.enteredAt) || value.requestedAt > value.enteredAt || !text(value.enteredBy, 120) || !text(value.reason, 1e3, false)) return false;
  if (value.kind !== "time-off" && value.kind !== "availability") return false;
  if (!Array.isArray(value.ranges) || value.ranges.length > 8 || (value.kind === "time-off" ? value.ranges.length !== 0 : value.ranges.length === 0)) return false;
  let previousEnd = -1;
  for (const range of value.ranges) {
    if (!object(range) || !keys(range, ["start", "end"]) || !Number.isInteger(range.start) || !Number.isInteger(range.end)) return false;
    const start = range.start, end = range.end;
    if (start < 0 || start >= 1440 || end <= start || end > start + 1440 || start < previousEnd) return false;
    previousEnd = end;
  }
  if (value.status === "pending") return value.review === null;
  return (value.status === "approved" || value.status === "declined") && object(value.review) && keys(value.review, ["by", "at", "reason"]) && text(value.review.by, 120) && text(value.review.reason, 1e3, false) && utcTimestamp(value.review.at) !== null && value.review.at >= value.enteredAt;
}
__name(validRequest, "validRequest");
function requestsOverlap(a, b) {
  return a.employee.stationId === b.employee.stationId && a.employee.sourceEmployeeId === b.employee.sourceEmployeeId && a.startDate <= b.endDate && b.startDate <= a.endDate;
}
__name(requestsOverlap, "requestsOverlap");
function validRequestData(value, station) {
  if (!isStationId(station) || !object(value) || !keys(value, ["version", "stationId", "requests"]) || value.version !== 1 || value.stationId !== station || !Array.isArray(value.requests) || value.requests.length > MAX_REQUESTS || !value.requests.every((item) => validRequest(item, station))) return false;
  const requests = value.requests;
  if (new Set(requests.map((item) => item.id)).size !== requests.length) return false;
  const approved = requests.filter((item) => item.status === "approved");
  return !approved.some((item, index) => approved.slice(index + 1).some((other) => requestsOverlap(item, other)));
}
__name(validRequestData, "validRequestData");
function requestTransitionIssue(previous, next, preparer) {
  const before = previous?.requests ?? [];
  if (next.requests.length === before.length + 1) {
    if (before.some((item, i) => canonicalJson(item) !== canonicalJson(next.requests[i]))) return "preserve_original_request";
    const added = next.requests.at(-1);
    return added.status === "pending" && added.enteredBy === preparer ? null : "entry_provenance_required";
  }
  if (next.requests.length !== before.length) return "preserve_original_request";
  const changed = before.filter((item, i) => canonicalJson(item) !== canonicalJson(next.requests[i]));
  if (changed.length !== 1) return "one_request_per_operation";
  const old = changed[0], current = next.requests[before.indexOf(old)];
  if (old.status !== "pending" || current.status === "pending" || current.review?.by !== preparer) return "review_provenance_required";
  return canonicalJson({ ...current, status: old.status, review: old.review }) === canonicalJson(old) ? null : "preserve_original_request";
}
__name(requestTransitionIssue, "requestTransitionIssue");

// src/record-mutations.ts
var families = ["employee", "membership", "employee-mapping", "schedule", "schedule-request", "cash-close", "catalog", "count", "order", "receipt", "stock-event", "import", "form", "follow-up", "attachment"];
function validDateContext(context) {
  if (!context || typeof context !== "object") return false;
  return context.kind === "undated" || (context.kind === "day" ? businessDate(context.businessDate) !== null : context.kind === "period" && businessDate(context.start) !== null && businessDate(context.end) !== null && context.start <= context.end);
}
__name(validDateContext, "validDateContext");
function failed(body) {
  return { ok: false, status: ERROR_STATUS[body.error.code], body };
}
__name(failed, "failed");
function key(context, operation) {
  return [context.callerScope, context.storeId, context.family, context.id, context.action, operation];
}
__name(key, "key");
var receiptWhere = "caller_scope=? AND store_id=? AND family=? AND record_id=? AND action=? AND operation_id=?";
async function receipt(db, identity) {
  return db.prepare(`SELECT request_json,result_json FROM mutation_operations WHERE ${receiptWhere}`).bind(...identity).first();
}
__name(receipt, "receipt");
function replay(prior, request) {
  return prior.request_json === request ? { ok: true, record: JSON.parse(prior.result_json), replayed: true } : failed(apiError("operation_reused"));
}
__name(replay, "replay");
async function mutateRecord(db, context, mutation, validate) {
  if (mutation?.schemaVersion !== SCHEMA_VERSION) return failed(apiError("unsupported_schema"));
  if (!isStoreId(context.storeId) || !families.includes(context.family) || !recordId(context.id) || !recordId(context.callerScope) || !recordId(context.action) || !validDateContext(context.context) || context.stationId !== void 0 && (!isStationId(context.stationId) || STATION_STORES[context.stationId] !== context.storeId) || !operationId(mutation.operationId) || revision(mutation.baseRevision) === null || mutation.baseRevision >= Number.MAX_SAFE_INTEGER || !context.actor || (context.actor.kind === "entered-label" ? typeof context.actor.label !== "string" || !context.actor.label.trim() : context.actor.kind !== "authenticated" || typeof context.actor.subject !== "string" || !context.actor.subject.trim())) {
    return failed(apiError("validation_failed"));
  }
  let request;
  try {
    request = canonicalJson({
      schemaVersion: mutation.schemaVersion,
      baseRevision: mutation.baseRevision,
      data: mutation.data,
      stationId: context.stationId ?? null,
      context: context.context,
      actor: context.actor
    });
  } catch {
    return failed(apiError("validation_failed"));
  }
  const identity = key(context, mutation.operationId);
  try {
    const prior = await receipt(db, identity);
    if (prior) return replay(prior, request);
    const issues = validate(mutation.data);
    if (issues.length) return failed(apiError("validation_failed", { fields: issues }));
    const now = utcTimestamp((/* @__PURE__ */ new Date()).toISOString());
    const nextRevision = revision(mutation.baseRevision + 1);
    const data = canonicalJson(mutation.data);
    const envelope2 = {
      schemaVersion: SCHEMA_VERSION,
      family: context.family,
      id: recordId(context.id),
      storeId: context.storeId,
      ...context.stationId ? { stationId: context.stationId } : {},
      context: context.context,
      revision: nextRevision,
      createdAt: now,
      updatedAt: now,
      data: mutation.data
    };
    const createResult = canonicalJson(envelope2);
    const recordKeys = [context.storeId, context.family, context.id];
    const claim = db.prepare(`INSERT INTO mutation_operations
      (caller_scope,store_id,family,record_id,action,operation_id,request_json,result_json)
      SELECT ?,?,?,?,?,?,?,json_set(?, '$.createdAt', COALESCE((SELECT created_at FROM records WHERE store_id=? AND family=? AND id=?), ?))
      WHERE (?=0 AND NOT EXISTS (SELECT 1 FROM records WHERE store_id=? AND family=? AND id=?))
         OR EXISTS (SELECT 1 FROM records WHERE store_id=? AND family=? AND id=? AND revision=?)`).bind(...identity, request, createResult, ...recordKeys, now, mutation.baseRevision, ...recordKeys, ...recordKeys, mutation.baseRevision);
    const claimExists = `EXISTS (SELECT 1 FROM mutation_operations WHERE ${receiptWhere})`;
    const business = context.context.kind === "day" ? context.context.businessDate : null;
    const start = context.context.kind === "period" ? context.context.start : null;
    const end = context.context.kind === "period" ? context.context.end : null;
    const insert = db.prepare(`INSERT INTO records
      (store_id,family,id,station_id,schema_version,revision,context_kind,business_date,period_start,period_end,created_at,updated_at,data_json)
      SELECT ?,?,?,?,1,1,?,?,?,?,?,?,? WHERE ?=0 AND ${claimExists}`).bind(...recordKeys, context.stationId ?? null, context.context.kind, business, start, end, now, now, data, mutation.baseRevision, ...identity);
    const update = db.prepare(`UPDATE records SET station_id=?, revision=?, context_kind=?, business_date=?, period_start=?, period_end=?, updated_at=?, data_json=?
      WHERE store_id=? AND family=? AND id=? AND revision=? AND ? > 0 AND ${claimExists}`).bind(
      context.stationId ?? null,
      nextRevision,
      context.context.kind,
      business,
      start,
      end,
      now,
      data,
      ...recordKeys,
      mutation.baseRevision,
      mutation.baseRevision,
      ...identity
    );
    const event = db.prepare(`INSERT INTO change_events
      (caller_scope,store_id,family,record_id,action,operation_id,prior_revision,revision,occurred_at,actor_json,snapshot_json)
      SELECT caller_scope,store_id,family,record_id,action,operation_id,?,
        (SELECT revision FROM records WHERE store_id=? AND family=? AND id=? AND revision=? AND updated_at=? AND data_json=?),?,?,result_json
      FROM mutation_operations WHERE ${receiptWhere}`).bind(mutation.baseRevision, ...recordKeys, nextRevision, now, data, now, canonicalJson(context.actor), ...identity);
    const results = await db.batch([claim, insert, update, event]);
    if (results[0].meta.changes === 0) {
      const current = await db.prepare("SELECT revision FROM records WHERE store_id=? AND family=? AND id=?").bind(...recordKeys).first();
      return failed(apiError("revision_conflict", { currentRevision: revision(current?.revision ?? 0) }));
    }
    const saved = await receipt(db, identity);
    if (!saved) return failed(apiError("unavailable"));
    return { ok: true, record: JSON.parse(saved.result_json), replayed: false };
  } catch {
    try {
      const saved = await receipt(db, identity);
      if (saved) return replay(saved, request);
    } catch {
    }
    return failed(apiError("unavailable"));
  }
}
__name(mutateRecord, "mutateRecord");

// src/schedule-requests.ts
async function readRequestMutation(request) {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 6e5) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}
__name(readRequestMutation, "readRequestMutation");
var requestRecordId = /* @__PURE__ */ __name((station) => `requests-${station}`, "requestRecordId");
async function requestRecord(db, station) {
  const row = await db.prepare("SELECT data_json,revision,created_at,updated_at FROM records WHERE store_id=? AND family='schedule-request' AND id=?").bind(STATION_STORES[station], requestRecordId(station)).first();
  if (!row) return null;
  const data = JSON.parse(row.data_json);
  if (!validRequestData(data, station)) throw new Error("Invalid schedule requests");
  return {
    schemaVersion: 1,
    family: "schedule-request",
    id: requestRecordId(station),
    storeId: STATION_STORES[station],
    stationId: station,
    context: { kind: "undated" },
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    data
  };
}
__name(requestRecord, "requestRecord");
async function saveRequests(db, station, raw) {
  const body = raw;
  if (!body || typeof body.preparer !== "string" || !body.preparer.trim() || body.preparer.length > 120 || !body.mutation || !validRequestData(body.mutation.data, station)) {
    return { ok: false, status: 400, body: apiError("validation_failed") };
  }
  const previous = await requestRecord(db, station);
  const preparer = body.preparer.trim();
  const result = await mutateRecord(db, {
    storeId: STATION_STORES[station],
    family: "schedule-request",
    id: requestRecordId(station),
    stationId: station,
    context: { kind: "undated" },
    callerScope: "manager",
    action: "edit-requests",
    actor: { kind: "entered-label", label: preparer }
  }, body.mutation, (data) => {
    if ((previous?.revision ?? 0) !== body.mutation.baseRevision) return [{ path: "baseRevision", code: "stale_revision" }];
    const issue = requestTransitionIssue(previous?.data ?? null, data, preparer);
    return issue ? [{ path: "requests", code: issue }] : [];
  });
  if (!result.ok && result.body.error.fields?.some((issue) => issue.code === "stale_revision")) {
    return { ok: false, status: 409, body: apiError("revision_conflict", { currentRevision: revision(previous?.revision ?? 0) }) };
  }
  return result;
}
__name(saveRequests, "saveRequests");

// ../src/lib/scheduler/time.ts
function minutes(hour, minute = 0) {
  return hour * 60 + minute;
}
__name(minutes, "minutes");

// ../src/lib/scheduler/data.ts
var seedTemplate = Object.fromEntries(
  DAYS.map((day) => {
    const amSlots = [
      { period: "AM", role: "lead", label: "Shift lead", start: minutes(9, 30), end: minutes(16), required: true },
      { period: "AM", role: "server", label: "Server", start: minutes(10), end: minutes(16), required: true },
      { period: "AM", role: "cashier", label: "Cashier 1", start: minutes(10, 30), end: minutes(16), required: true }
    ];
    if (day === "Thursday" || day === "Friday") {
      amSlots.push({
        period: "AM",
        role: "cashier",
        label: "Cashier 2",
        start: minutes(12),
        end: minutes(16),
        required: true
      });
    }
    const pmServerStart = day === "Saturday" || day === "Sunday" ? minutes(16) : minutes(17);
    const pmSlots = [
      { period: "PM", role: "lead", label: "Shift lead", start: minutes(16), end: minutes(23), required: true },
      { period: "PM", role: "server", label: "Server", start: pmServerStart, end: minutes(23), required: true },
      { period: "PM", role: "cashier", label: "Cashier 1", start: minutes(16), end: minutes(23), required: true },
      { period: "PM", role: "cashier", label: "Cashier 2", start: minutes(16, 30), end: minutes(23), required: true }
    ];
    if (day === "Friday") {
      pmSlots.push({
        period: "PM",
        role: "manager",
        label: "Friday manager",
        start: minutes(15),
        end: minutes(23),
        required: true
      });
    }
    return [day, [...amSlots, ...pmSlots]];
  })
);
function expandTemplate(template, weekStart) {
  return DAYS.flatMap(
    (day) => template[day].map((slot, index) => ({
      ...slot,
      day,
      ...weekStart ? { date: dateForDay(weekStart, day) } : {},
      id: `${day.toLowerCase()}-${slot.period.toLowerCase()}-${index}-${slot.label.toLowerCase().replaceAll(" ", "-")}`
    }))
  );
}
__name(expandTemplate, "expandTemplate");
var KITCHEN_COVER_START = minutes(9);
var KITCHEN_COVER_END = minutes(20);
function kitchenSlot(role, label2, start, end, required = true) {
  return { period: start >= minutes(16) ? "PM" : "AM", role, label: label2, start, end, required };
}
__name(kitchenSlot, "kitchenSlot");
var CR03_EARLY_MV_START = { Sunday: minutes(8), Tuesday: minutes(9) };
var CR03_EARLY_MV = Object.fromEntries(
  DAYS.map((day) => [day, { start: CR03_EARLY_MV_START[day] ?? minutes(6), end: minutes(13, 30) }])
);
var seedKitchenTemplateCR03 = Object.fromEntries(
  DAYS.map((day) => {
    const sunday = day === "Sunday";
    const slots = [
      // Lunch (AM) crew.
      sunday ? kitchenSlot("cook", "Cook (AM)", minutes(10, 15), minutes(16)) : kitchenSlot("cook", "Cook (AM)", minutes(9), minutes(16)),
      kitchenSlot("line-cook", "Line Cook (AM)", sunday ? minutes(10, 15) : minutes(9), minutes(16)),
      kitchenSlot("mv-prep", "M/V Prep (early)", CR03_EARLY_MV[day].start, CR03_EARLY_MV[day].end)
    ];
    if (!sunday) {
      slots.push(kitchenSlot("mv-prep", "M/V Prep (late)", minutes(9), minutes(16)));
    }
    slots.push(kitchenSlot("cook", "Cook (PM)", minutes(16), minutes(23)));
    slots.push(kitchenSlot("line-cook", "Line Cook (PM)", minutes(16), minutes(23)));
    slots.push(kitchenSlot("fried-rice", "F.R. Cook (PM)", minutes(16), minutes(23)));
    slots.push(kitchenSlot("dishwasher", "Dishwasher (PM)", minutes(17), minutes(23)));
    slots.push(kitchenSlot("fried-rice", "F.R. Cook (AM)", minutes(10, 15), minutes(16), false));
    slots.push(kitchenSlot("dishwasher", "Dishwasher (AM)", sunday ? minutes(10, 15) : minutes(9), minutes(16), false));
    slots.push(kitchenSlot("shadow", "Shadow (PM)", minutes(16), minutes(23), false));
    slots.push(kitchenSlot("meat-prep", "Meat Prep (PM)", minutes(17), minutes(23), false));
    return [day, slots];
  })
);
var seedKitchenTemplateCR02 = Object.fromEntries(
  DAYS.map((day) => {
    const slots = [
      ["cook", "Cook"],
      ["line-cook", "Line Cook"],
      ["fried-rice", "Fried Rice"],
      ["dishwasher", "Dishwasher"],
      ["meat-prep", "Meat Prep"],
      ["veggie-prep", "Veggie Prep"],
      ["shadow", "Shadow"],
      ["manager", "Manager"]
    ].map(([role, label2]) => kitchenSlot(role, label2, KITCHEN_COVER_START, KITCHEN_COVER_END));
    return [day, slots];
  })
);
function defaultTemplateForRestaurant(restaurantId) {
  if (restaurantId === "CR3-kitchen") return cloneTemplate(seedKitchenTemplateCR03);
  if (restaurantId === "CR2-kitchen") return cloneTemplate(seedKitchenTemplateCR02);
  return cloneTemplate(seedTemplate);
}
__name(defaultTemplateForRestaurant, "defaultTemplateForRestaurant");
function cloneTemplate(source) {
  return Object.fromEntries(DAYS.map((day) => [day, source[day].map((slot) => ({ ...slot }))]));
}
__name(cloneTemplate, "cloneTemplate");

// ../src/lib/schedule-share.ts
function templateHashForSlots(slots) {
  let hash = 2166136261;
  const input = slots.map((slot) => slot.id).join("\n");
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
__name(templateHashForSlots, "templateHashForSlots");
function layoutForWeek(saved, restaurantId, templateHash) {
  const candidates = [...saved.filter((template) => template != null), defaultTemplateForRestaurant(restaurantId), seedTemplate];
  const layouts = candidates.map((template) => expandTemplate(template));
  const match = layouts.find((slots) => templateHashForSlots(slots) === templateHash);
  return { slots: match ?? layouts[0], matches: match !== void 0 };
}
__name(layoutForWeek, "layoutForWeek");

// ../src/lib/converter/published-hours.ts
function weeksInPeriod(start, end) {
  if (!businessDate(start) || !businessDate(end) || start > end || Date.parse(end) - Date.parse(start) > 62 * 864e5) throw new Error("Invalid comparison period");
  const first = Date.parse(start + "T00:00:00Z"), sunday = first - new Date(first).getUTCDay() * 864e5, result = [];
  for (let ms = sunday; ms <= Date.parse(end + "T00:00:00Z"); ms += 7 * 864e5) result.push(new Date(ms).toISOString().slice(0, 10));
  return result;
}
__name(weeksInPeriod, "weeksInPeriod");
async function publishedHours(stationId, weekStart, raw, weekTemplate, globalTemplate) {
  const empty = { stationId, weekStart, status: raw ? "invalid" : "missing", revision: null, updatedAt: null, fingerprint: null, people: [], assignments: [], timingBasis: "legacy-estimate", templateSource: "unknown", ruleFingerprint: null };
  if (!raw || typeof raw !== "object") return empty;
  const doc = raw;
  if (doc.v !== 3 || doc.weekStart !== weekStart || !Number.isSafeInteger(doc.rev) || doc.rev < 1 || typeof doc.updatedAt !== "string" || !Number.isFinite(Date.parse(doc.updatedAt)) || typeof doc.templateHash !== "string" || !doc.week || doc.week.weekStart !== weekStart || doc.week.version !== 1 || !Array.isArray(doc.week.people) || doc.week.people.length > 300 || !doc.week.people.every((p) => typeof p === "string" && p.length <= 120) || !Array.isArray(doc.week.slotPeople) || !doc.week.slotPeople.every((i) => Number.isInteger(i) && i >= -1 && i < doc.week.people.length)) return empty;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJson(doc))), fingerprint = Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join("");
  const result = { ...empty, revision: doc.rev, updatedAt: doc.updatedAt, fingerprint: "sha256:" + fingerprint, status: doc.visible === false ? "hidden" : "published", people: doc.week.people.map((label2, index) => ({ key: `pub:${fingerprint}:${index}`, label: label2, index })) };
  if (doc.visible === false) return result;
  const layout = layoutForWeek([weekTemplate, globalTemplate], stationId, doc.templateHash);
  if (!layout.matches || doc.week.slotPeople.length !== layout.slots.length) return { ...result, status: "layout_unavailable" };
  result.templateSource = weekTemplate && templateHashForSlots(expandTemplate(weekTemplate)) === doc.templateHash ? "current-week-rules" : globalTemplate && templateHashForSlots(expandTemplate(globalTemplate)) === doc.templateHash ? "current-station-rules" : "built-in-rules";
  const ruleDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJson(layout.slots)));
  result.ruleFingerprint = "sha256:" + Array.from(new Uint8Array(ruleDigest), (n) => n.toString(16).padStart(2, "0")).join("");
  const assignments = [];
  for (let index = 0; index < layout.slots.length; index++) {
    const slot = layout.slots[index], person = doc.week.slotPeople[index];
    if (!Number.isInteger(slot.start) || !Number.isInteger(slot.end) || slot.start < 0 || slot.start >= 1440 || slot.end < 0 || slot.end > 2880 || slot.start === slot.end) return { ...result, status: "layout_unavailable" };
    if (person < 0) continue;
    assignments.push({ key: result.people[person].key, date: dateForDay(weekStart, slot.day), slotId: slot.id, start: slot.start, end: slot.end <= slot.start ? slot.end + 1440 : slot.end });
  }
  return { ...result, assignments };
}
__name(publishedHours, "publishedHours");

// ../src/lib/converter/business-date.ts
var DATE_POLICY = "DEC-01-v1";
var STORE_TIME_ZONE = "America/Chicago";
var parts = /* @__PURE__ */ __name((ms) => Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: STORE_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(ms)).map((p) => [p.type, p.value])), "parts");
function instantDate(ms) {
  const p = parts(ms);
  return `${p.year}-${p.month}-${p.day}`;
}
__name(instantDate, "instantDate");
function sourceTime(raw) {
  const invalid = { date: "", instant: null, issue: "invalid" };
  const text4 = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/.exec(text4);
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i.exec(text4);
  if (!iso && !us) return invalid;
  const y = +(iso ? iso[1] : us[3]), m = +(iso ? iso[2] : us[1]), d = +(iso ? iso[3] : us[2]);
  const date = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  if (!businessDate(date)) return invalid;
  if (!(iso?.[4] || us?.[4])) return { date, instant: null, issue: null };
  let hour = +(iso?.[4] ?? us[4]);
  const minute = +(iso?.[5] ?? us[5]), second = +(iso?.[6] ?? us?.[6] ?? 0);
  if (us?.[7]) {
    if (hour < 1 || hour > 12) return invalid;
    hour = hour % 12 + (us[7].toUpperCase() === "PM" ? 12 : 0);
  }
  if (hour > 23 || minute > 59 || second > 59) return invalid;
  if (iso?.[7]) {
    const instant = Date.parse(text4.replace(" ", "T"));
    return Number.isFinite(instant) ? { date: instantDate(instant), instant, issue: null } : invalid;
  }
  const local = Date.UTC(y, m - 1, d, hour, minute, second);
  const candidates = [300, 360].map((offset) => local + offset * 6e4).filter((ms) => {
    const p = parts(ms);
    return instantDate(ms) === date && +p.hour === hour && +p.minute === minute && +p.second === second;
  });
  return { date, instant: candidates.length === 1 ? candidates[0] : null, issue: candidates.length === 1 ? null : candidates.length ? "ambiguous" : "invalid" };
}
__name(sourceTime, "sourceTime");

// ../src/lib/converter/employee-mapping.ts
var uuid = /* @__PURE__ */ __name((v) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v), "uuid");
var text2 = /* @__PURE__ */ __name((v, max) => typeof v === "string" && !!v.trim() && v.length <= max, "text");
var object2 = /* @__PURE__ */ __name((v) => !!v && typeof v === "object" && !Array.isArray(v), "object");
var keys2 = /* @__PURE__ */ __name((v, allowed) => Object.keys(v).every((k) => allowed.includes(k)), "keys");
function validDirectory(value, store) {
  if (!object2(value) || !keys2(value, ["version", "employees", "mappings", "hourTargets"]) || value.version !== 1 || value.hourTargets !== "disabled" || !Array.isArray(value.employees) || value.employees.length > 300 || !Array.isArray(value.mappings) || value.mappings.length > 2e3) return false;
  if (!value.employees.every((e) => object2(e) && keys2(e, ["id", "name", "active"]) && uuid(e.id) && text2(e.name, 120) && typeof e.active === "boolean") || new Set(value.employees.map((e) => e.id)).size !== value.employees.length) return false;
  const employees = new Set(value.employees.map((e) => e.id)), mappings = value.mappings;
  if (!mappings.every((m) => object2(m) && keys2(m, ["id", "system", "scope", "externalId", "employeeId", "from", "until", "reviewedBy"]) && uuid(m.id) && ["toast", "scheduler"].includes(m.system) && text2(m.externalId, 200) && employees.has(m.employeeId) && !!businessDate(m.from) && (m.until === null || !!businessDate(m.until) && m.until >= m.from) && text2(m.reviewedBy, 120) && (m.system === "toast" ? m.scope === store : isStationId(m.scope) && STATION_STORES[m.scope] === store))) return false;
  if (new Set(mappings.map((m) => m.id)).size !== mappings.length) return false;
  return !mappings.some((a, i) => mappings.slice(i + 1).some((b) => a.system === b.system && a.scope === b.scope && a.externalId === b.externalId && a.from <= (b.until ?? "9999-12-31") && b.from <= (a.until ?? "9999-12-31")));
}
__name(validDirectory, "validDirectory");
function sourceEmployeeKey(row, fingerprint) {
  const id = row["Employee External Id"].trim();
  return id || (/^sha256:[a-f0-9]{64}$/.test(fingerprint) && row.__sourceRow ? `row:${fingerprint}:${row.__sourceRow}` : null);
}
__name(sourceEmployeeKey, "sourceEmployeeKey");
function mapHours(rows, directory, store, fingerprint) {
  return rows.map((row, index) => {
    const key2 = sourceEmployeeKey(row, fingerprint), date = sourceTime(row["In Date"]).date;
    const matches = directory?.mappings.filter((m) => m.system === "toast" && m.scope === store && m.externalId === key2 && date >= m.from && (!m.until || date <= m.until)) ?? [];
    const mapping = matches.length === 1 ? matches[0] : null, employee = mapping ? directory?.employees.find((e) => e.id === mapping.employeeId) ?? null : null;
    return { sourceRow: row.__sourceRow ?? index + 2, key: key2, mapping, employee, values: row };
  });
}
__name(mapHours, "mapHours");
function ambiguousNames(rows, mapped) {
  const names = /* @__PURE__ */ new Map();
  for (const row of mapped) {
    const name = row.values.Employee.trim();
    if (!names.has(name)) names.set(name, /* @__PURE__ */ new Set());
    names.get(name).add(row.key ?? `row:${row.sourceRow}`);
  }
  return mapped.some((row) => (names.get(row.values.Employee.trim())?.size ?? 0) > 1 && !row.employee);
}
__name(ambiguousNames, "ambiguousNames");

// ../src/lib/converter/sales-context.ts
function needsContextReview(context, date, store) {
  return !context || !businessDate(date) || !store || context.sources.some((s) => s.uncertain || s.dates.length !== 1 || s.dates[0] !== date || s.stores.length !== 1 || s.stores[0] !== store);
}
__name(needsContextReview, "needsContextReview");
function validSalesContext(value) {
  if (!value || typeof value !== "object") return false;
  const v = value;
  return Object.keys(v).every((k) => ["policy", "sources", "reason", "cashout"].includes(k)) && v.policy === DATE_POLICY && typeof v.reason === "string" && v.reason.length <= 1e3 && Array.isArray(v.sources) && v.sources.length === 3 && new Set(v.sources.map((s) => s.slot)).size === 3 && v.sources.every((s) => ["general", "lunch", "dinner"].includes(s.slot) && Object.keys(s).every((k) => ["slot", "dates", "stores", "uncertain"].includes(k)) && typeof s.uncertain === "boolean" && Array.isArray(s.dates) && s.dates.every((d) => businessDate(d)) && Array.isArray(s.stores) && s.stores.every(isStoreId)) && (v.cashout === null || !!v.cashout && Object.keys(v.cashout).every((k) => ["storeId", "date", "updatedAt", "revision"].includes(k)) && isStoreId(v.cashout.storeId) && !!businessDate(v.cashout.date) && typeof v.cashout.updatedAt === "string" && Number.isFinite(Date.parse(v.cashout.updatedAt)) && /^sha256:[a-f0-9]{64}$/.test(v.cashout.revision));
}
__name(validSalesContext, "validSalesContext");

// ../src/lib/converter/validation.ts
var problem = /* @__PURE__ */ __name((key2, params) => ({ key: key2, params }), "problem");
var HOURS_COLUMNS = ["Employee External Id", "Employee", "Job Title", "In Date", "Out Date", "Total Hours", "Regular Hours", "Overtime Hours"];
function sourceNumber(value, money = true) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const text4 = value.trim();
  const pattern = money ? /^[+-]?\$?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)$/ : /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
  if (!pattern.test(text4)) return null;
  const parsed = Number(text4.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}
__name(sourceNumber, "sourceNumber");
function validSourceDate(value) {
  if (!value.trim() || !Number.isFinite(Date.parse(value))) return false;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:\D|$)/.exec(value);
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\D|$)/.exec(value);
  if (!iso && !us) return true;
  const [year, month, day] = iso ? [+iso[1], +iso[2], +iso[3]] : [+us[3], +us[1], +us[2]];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
__name(validSourceDate, "validSourceDate");
function validateHoursRows(records, parserErrors = [], review = false) {
  const issues = parserErrors.map((error) => problem("importValidation.csv", { row: (error.row ?? 0) + 1, code: error.code }));
  const nonempty = records.some((row) => row.some((value) => String(value ?? "").trim()));
  if (!nonempty) return { value: null, issues: [problem("importValidation.empty")] };
  const headers = (records[0] ?? []).map((value) => String(value ?? ""));
  if (!HOURS_COLUMNS.some((column) => headers.includes(column))) return { value: null, issues: [...issues, problem("importValidation.hoursReport")] };
  for (const column of HOURS_COLUMNS) {
    const count = headers.filter((value) => value === column).length;
    if (count !== 1) issues.push(problem(count ? "importValidation.csvDuplicateColumn" : "importValidation.csvColumn", { column }));
  }
  if (issues.length) return { value: null, issues };
  let malformed = false;
  const rows = [];
  records.slice(1).forEach((cells, index) => {
    if (cells.every((value) => !String(value ?? "").trim())) return;
    const row = index + 2;
    if (cells.length !== headers.length) {
      malformed = true;
      issues.push(problem("importValidation.csvWidth", { row }));
    }
    const record = Object.fromEntries(HOURS_COLUMNS.map((column) => [column, String(cells[headers.indexOf(column)] ?? "")]));
    for (const column of ["Employee External Id", "Employee"]) {
      if (!record[column].trim()) issues.push(problem("importValidation.csvRequired", { row, column }));
    }
    for (const column of ["Total Hours", "Regular Hours", "Overtime Hours"]) {
      if (sourceNumber(record[column], false) === null) issues.push(problem("importValidation.csvNumber", { row, column }));
    }
    for (const column of ["In Date", "Out Date"]) {
      if (!validSourceDate(record[column])) issues.push(problem("importValidation.csvDate", { row, column }));
    }
    if (review) record.__sourceRow = row;
    rows.push(record);
  });
  if (!rows.length) issues.push(problem("importValidation.noRows"));
  return { value: malformed || !rows.length || !review && issues.length ? null : rows, issues };
}
__name(validateHoursRows, "validateHoursRows");

// ../src/lib/converter/workbook-output.ts
var FILENAME = /^[A-Za-z0-9_.-]+\.xlsx$/;
function isWorkbookOutput(value) {
  if (!value || typeof value !== "object") return false;
  const output = value;
  return Object.keys(output).every((key2) => ["filename", "base64", "sha256"].includes(key2)) && typeof output.filename === "string" && FILENAME.test(output.filename) && typeof output.base64 === "string" && output.base64.length > 0 && output.base64.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(output.base64) && typeof output.sha256 === "string" && /^[a-f0-9]{64}$/.test(output.sha256);
}
__name(isWorkbookOutput, "isWorkbookOutput");

// ../src/lib/internal-tools/i18n/en.ts
var en = {
  "cash.keypad": "Count keypad",
  "cash.notEntered": "Not entered",
  "cash.clearCount": "Clear",
  "cash.backspace": "Delete digit",
  "cash.previousCount": "Previous count",
  "cash.nextCount": "Next count",
  "cash.closeKeypad": "Close keypad",
  "cash.countContext": "{shift} \xB7 {name}",
  "cash.countFor": "{amount} denomination count",
  "cash.countHelp": "Blank counts are not entered; type 0 to record zero. Blank counts contribute $0 to the existing totals. Entry status stays on this device. Select a count to use the optional keypad.",
  "cash.countProgress": "{number} of {total} denomination counts entered on this device",
  "cash.legacyCountState": "This earlier sheet has counts whose original entry status is unknown. Editing one count does not confirm the others.",
  "cash.invalidCount": "Enter a whole count from 0 to 100000, or clear the field.",
  "cash.fixCounts": "Correct invalid denomination counts before saving. Invalid counts contribute $0 to these preview totals; your original input is retained.",
  "entry.help": "Tab / Shift+Tab move through controls. Enter / Shift+Enter move through entry fields. Enter never saves. Escape cancels a confirmation.",
  "requests.title": "Time off requests",
  "requests.waiting": "{count} waiting",
  "requests.language": "Request language",
  "requests.loaded": "Requests loaded.",
  "requests.loading": "Loading saved requests\u2026",
  "requests.unconfigured": "Request storage is not active on this server. Existing scheduling remains available; new requests cannot be saved here yet.",
  "requests.uncertain": "Request changes have not been confirmed. Retry the exact save or reload and review the latest decisions.",
  "requests.policy": "Managers enter requests received by text or conversation. Dates are inclusive Chicago business dates; an overnight shift belongs to its starting date. Temporary hours replace availability for each selected date. Only approved requests affect scheduling. Recurring availability and suspensions stay separate.",
  "requests.new": "Enter a request",
  "requests.employee": "Requested for",
  "requests.choose": "Choose an employee",
  "requests.kind": "Request type",
  "requests.timeOff": "Time off",
  "requests.availability": "Temporary availability",
  "requests.enteredBy": "Your name",
  "requests.start": "Starting date",
  "requests.end": "Ending date (inclusive)",
  "requests.received": "Original request time",
  "requests.deviceTime": "Enter the time this request came in.",
  "requests.from": "Available from",
  "requests.until": "Available until",
  "requests.nextDay": "Ends the next day",
  "requests.reason": "Original request / reason (optional)",
  "requests.savePending": "Save pending request",
  "requests.saving": "Saving\u2026",
  "requests.saved": "Server confirmed the request change.",
  "requests.reviewer": "Reviewed by",
  "requests.reviewReason": "Review reason (optional)",
  "requests.pending": "Pending requests",
  "requests.approved": "Approved exceptions",
  "requests.declined": "Declined requests",
  "requests.empty": "No requests in this group.",
  "requests.approve": "Approve",
  "requests.decline": "Decline",
  "requests.overlapHint": "Another request overlaps these dates for this employee. Review them together; overlapping approvals are not allowed.",
  "requests.overlap": "This approval overlaps an already approved exception. Keep the original decision and enter a nonoverlapping request.",
  "requests.invalid": "Check the employee, dates, hours, manager label and request time. Requests cover at most 366 days; original requests and prior decisions cannot be rewritten.",
  "requests.unauthorized": "Manager access was not accepted. Your fields are kept; reopen with the current manager code before saving.",
  "requests.failed": "Could not confirm request data with the server. Entered fields and the earlier snapshot are kept. Retry or reload before relying on these decisions.",
  "requests.conflict": "Another manager changed these requests. Your original request and review text are kept. Reload, compare the latest decisions, then review again.",
  "requests.reload": "Reload requests",
  "requests.retry": "Retry exact save",
  "requests.resolve": "Resolve an uncertain save",
  "requests.reloadWarning": "Reload the server decisions and resolve the last attempted save? Entry and review text stay on screen. Check whether the request was already saved before submitting again.",
  "requests.reloaded": "Latest requests loaded. Unsaved entry and review text remain; compare them with the server decisions.",
  "requests.cancel": "Keep working",
  "requests.capacity": "This station has reached the request-history limit. Existing history is preserved; contact the maintainer before adding more.",
  "mapping.contextWarning": "Changing the source, store or period replaces working mapping choices. Download a working mapping copy first if needed. Continue?",
  "comparison.overlapping_actual": "Selected files repeat the same identified clock-in/out row. All conflicting imports are excluded; explicitly choose the intended source instead of double-counting attendance.",
  "comparison.combinedEmployees": "Combined hours by shared employee",
  "comparison.sourceAssignments": "Source row and assignment references",
  "comparison.title": "Scheduled versus actual",
  "comparison.scope": "Read-only comparison of selected reviewed hours imports and observed published schedules. No payroll recalculation, targets or schedule publication. Choose sources explicitly; source coverage may be incomplete.",
  "comparison.both": "CR2 + CR3",
  "comparison.load": "Load reviewed sources and schedules",
  "comparison.loading": "Loading reviewed sources and published schedules\u2026",
  "comparison.loaded": "Sources loaded. Review identities and selected imports, then compare.",
  "comparison.period": "Choose an inclusive period of at most 63 calendar dates.",
  "comparison.reload": "Reload sources and replace working schedule mappings? Download any unsaved mapping copy first. Existing reviewed imports remain intact.",
  "comparison.loadedScope": "Loaded source context: {store} \xB7 {start} to {end}.",
  "comparison.stale": "The selected context differs from the loaded sources. Reload before comparing. The earlier snapshot remains visible.",
  "comparison.imports": "Selected reviewed hours imports",
  "comparison.mapping": "Published snapshot identity review",
  "comparison.mappingNote": "Legacy publications contain names and positions, not shared IDs. Bind each exact publication fingerprint/person position explicitly. Use identities reviewed in hours mappings; names never select a match. Changes affect schedule estimates only, not historical actual-hour mappings.",
  "comparison.run": "Compare selected sources",
  "comparison.result": "Observed scheduled versus actual hours",
  "comparison.estimate": "Scheduled hours are estimates from published assignments and compatible current/built-in shift rules. Legacy layout hashes do not pin times. Missing coverage, unresolved identities and overlaps remain limitations; variance is not a payroll correction.",
  "comparison.limitations": "Coverage and comparison limitations",
  "comparison.perStore": "Observed totals by store",
  "comparison.store": "Store",
  "comparison.actual": "Included source total hours",
  "comparison.regular": "Source regular hours",
  "comparison.overtime": "Source overtime hours",
  "comparison.scheduled": "Observed scheduled estimate (hours)",
  "comparison.unmatched": "Unmatched source total hours",
  "comparison.employee": "Shared employee",
  "comparison.employees": "Employee comparison by store",
  "comparison.variance": "Actual minus estimated schedule",
  "comparison.combined": "Combined observed source hours: {actual} \xB7 scheduled estimate: {scheduled} \xB7 unique mapped identities: {people}",
  "comparison.evidence": "Source exceptions and published revision evidence",
  "comparison.download": "Download comparison evidence JSON",
  "comparison.missing_history": "No selected reviewed import covers this exact store/period; actual hours are unavailable.",
  "comparison.more_history": "Additional history pages exist. Only the explicitly selected loaded imports contribute; coverage is incomplete.",
  "comparison.unpublished": "A station week is missing or hidden; no published estimate is inferred.",
  "comparison.layout": "A published snapshot or compatible layout is unavailable. Its scheduled hours are unknown.",
  "comparison.legacy_timing": "Legacy schedule timing is estimated from compatible rules, not an immutable published time snapshot.",
  "comparison.unmapped_actual": "Actual source rows have no reviewed shared identity; their hours remain in unmatched totals.",
  "comparison.unmapped_schedule": "Published assignments have no reviewed shared identity; estimates remain separately unmatched.",
  "comparison.duplicate_source": "Multiple selected versions reuse source bytes. All conflicting versions are excluded until you select one.",
  "comparison.overlap": "Mapped published assignments overlap, including across stations/stores. Estimates are not adjudicated or corrected.",
  "comparison.excluded_rows": "Source review excludes rows; see original import exceptions and preserved source totals.",
  "comparison.partial_period": "A selected import has a different period and is excluded; partial coverage is not treated as zero.",
  "importHistory.exportRecord": "Download reviewed record JSON",
  "importHistory.title": "Shared import history",
  "importHistory.policy": "Save reviewed values, source fingerprints and reported workbook metadata. Raw source files and workbook bytes are not uploaded. No automatic disposal. Device copies remain separate. A recorded download request does not prove a file was saved on disk.",
  "importHistory.load": "Load matching import history",
  "importHistory.save": "Save reviewed export to history",
  "importHistory.loaded": "Matching import history loaded.",
  "importHistory.empty": "No saved imports for this exact store and period.",
  "importHistory.saved": "Reviewed import saved to server.",
  "importHistory.duplicate": "This source identity is already recorded. Load its reviewed values for another download, or deliberately reprocess as a new linked version.",
  "importHistory.reprocess": "Record deliberate reprocessing",
  "importHistory.reprocessWarning": "Create a new reviewed import version linked to the earlier record? The earlier version will be preserved.",
  "importHistory.resume": "Resume reviewed values for download",
  "importHistory.resumeWarning": "Replace the current editor with these reviewed server values? Original source files are not available; the workbook will be regenerated after review. Device copies remain intact.",
  "importHistory.resumed": "Reviewed server values resumed. Review again before regenerating the workbook; original uploads were not restored.",
  "importHistory.supersedes": "Earlier import version",
  "importHistory.output": "Reported generated workbook",
  "importHistory.more": "Load more matching imports",
  "mapping.title": "Reviewed employee ID mappings",
  "mapping.scope": "Names never establish identity. Select an explicit shared ID for each source key. Unmatched rows remain visible and retain their source hours. Ambiguous same-name people and missing IDs require review before export. Hour targets are disabled.",
  "mapping.unlock": "Unlock manager access in Cash out to load or save shared mappings. Device copies and source review remain available.",
  "mapping.load": "Load saved mappings",
  "mapping.loaded": "Saved mapping revision loaded; source values are unchanged.",
  "mapping.saved": "Mappings saved to server. Review the hours again before export.",
  "mapping.unsaved": "Working mappings are not saved to server. Save explicitly or download a working copy before reloading.",
  "mapping.preparer": "Enter the preparer before reviewing a mapping.",
  "mapping.name": "New identity display name (names may repeat)",
  "mapping.sharedId": "Existing shared UUID, only if explicitly verified (optional)",
  "mapping.add": "Add explicit identity",
  "mapping.noExternal": "No external ID; mapping is scoped to this source fingerprint and row",
  "mapping.unmatched": "Unmatched shared identity",
  "mapping.inactive": "Inactive identity retained for history",
  "mapping.save": "Save reviewed mappings to server",
  "mapping.revision": "Saved directory revision: {revision}",
  "mapping.invalidEmployee": "Enter a name and a valid, distinct shared UUID, or leave UUID blank to assign a new identity.",
  "mapping.replace": "Replace your working mappings with the saved server revision? Download a working copy first if needed.",
  "mapping.copy": "Download working mappings",
  "importApi.unauthorized": "Manager access expired. Unlock again; working values are retained.",
  "importApi.backend_unconfigured": "This import service is unavailable or not configured. Current work is retained.",
  "importApi.conflict": "Another editor saved a newer revision. Download your working copy, then explicitly reload and compare before saving.",
  "importApi.unavailable": "Could not reach the service. Retry the same save; current work is retained.",
  "importApi.invalid": "The service rejected this mapping. Check identity, dates and overlapping mappings.",
  "hoursReview.title": "Review employee hours",
  "hoursReview.rule": "Inclusive start dates own the complete shift, including overnight. Source total, regular and overtime hours are preserved. Excluded rows remain visible.",
  "hoursReview.counts": "{source} source rows \xB7 {included} included \xB7 {excluded} excluded",
  "hoursReview.source": "Source total hours",
  "hoursReview.included": "Included total hours",
  "hoursReview.excluded": "Excluded total hours",
  "hoursReview.regular": "Included source regular hours",
  "hoursReview.overtime": "Included source overtime hours",
  "hoursReview.include": "Included",
  "hoursReview.exclude": "Excluded",
  "hoursReview.result": "Result",
  "hoursReview.period": "Select a valid inclusive period.",
  "hoursReview.open": "Open punch: missing clock-out.",
  "hoursReview.date": "Invalid or unsupported timestamp.",
  "hoursReview.ambiguous": "Ambiguous local time: source offset is required.",
  "hoursReview.reversed": "Clock-out precedes clock-in.",
  "hoursReview.hours": "Missing, negative or invalid source hours.",
  "hoursReview.outside": "Starting business date is outside the selected period.",
  "hoursReview.identity": "Missing employee name or external ID. Resolve identity before export; no hours are silently dropped.",
  "hoursReview.acknowledge": "I reviewed all included and excluded rows and the source totals. Export only the included rows.",
  "hoursReview.column0": "Employee external ID",
  "hoursReview.column1": "Employee",
  "hoursReview.column2": "Job title",
  "hoursReview.column3": "Clock-in",
  "hoursReview.column4": "Clock-out",
  "hoursReview.column5": "Total hours",
  "hoursReview.column6": "Regular hours",
  "hoursReview.column7": "Overtime hours",
  "salesContext.rule": "Weekday follows the selected business date. Source dates and stores must match, or require a reviewed reason before download.",
  "salesContext.unknown": "Not provided or not recognized in this source",
  "salesContext.reason": "Reviewed override reason (required for missing or mismatched source context)",
  "salesContext.cashout": "Saved cash-out source (content fingerprint, not an atomic server revision)",
  "shell.internal": "Internal use only \u2014 not for customer distribution",
  "shell.language": "Language / Idioma",
  "nav.tools": "Internal tools",
  "nav.home": "Dashboard",
  "nav.bookkeeping": "Bookkeeping",
  "nav.inventory": "Inventory",
  "nav.scheduler": "Scheduler",
  "nav.forms": "Forms & write-ups",
  "nav.bookkeepingDescription": "Cash out, daily sales report, employee hours",
  "nav.inventoryDescription": "CR3 supply counts and order list",
  "nav.schedulerDescription": "Build and publish weekly schedules",
  "nav.formsDescription": "Create, save and print forms",
  "bookkeeping.tools": "Bookkeeping tools",
  "bookkeeping.sales": "Daily sales report",
  "bookkeeping.hours": "Employee hours",
  "bookkeeping.pickStore": "Pick a China Rose location first.",
  "common.store": "Store",
  "common.date": "Date",
  "common.print": "Print",
  "common.loading": "Loading\u2026",
  "common.sending": "Sending\u2026",
  "common.savedDevice": "Saved on this device",
  "common.savedServer": "Saved to server",
  "common.waiting": "Waiting for connection",
  "common.unsaved": "Unsaved changes",
  "errors.unauthorized": "That code was not accepted. Ask for the current one and try again.",
  "errors.unavailable": "Could not reach the server. Keep your work and try again.",
  "errors.unconfigured": "Saving is not set up on the server yet. Ask whoever manages the website to finish setup.",
  "errors.rateLimited": "Too many requests. Wait a bit and try again.",
  "errors.rejected": "The server rejected this sheet. Check counts and amounts, then try again.",
  "errors.conflict": "Someone else saved first. Keep your edits, then reload or compare before saving.",
  "errors.forbidden": "You do not have access to this action.",
  "errors.notFound": "This record was not found.",
  "errors.policy": "This action is waiting for an approved policy.",
  "cash.title": "Cash out",
  "cash.dashboard": "Cash dashboard",
  "cash.managerInstructions": "Enter the manager code, the same one that unlocks the scheduler demo.",
  "cash.managerCode": "Manager code",
  "cash.checking": "Checking\u2026",
  "cash.unlock": "Unlock",
  "cash.missingFigure": "Enter the Toast or Z report figure",
  "cash.notSaved": "Nothing saved for {store} on {date}.",
  "cash.replaceConfirm": "Replace the sheet on screen with the saved {store} sheet for {date}?",
  "cash.loaded": "Loaded {store} {date}.",
  "cash.saved": "Saved to server: {store} {date}.",
  "cash.removeConfirm": "Remove this cashier?",
  "cash.clearConfirm": "Clear the whole sheet? This cannot be undone.",
  "cash.clear": "Clear sheet",
  "cash.load": "Load saved",
  "cash.save": "Save day",
  "cash.shift": "{shift} shift",
  "cash.addCashier": "+ Add cashier",
  "cash.cashierName": "Cashier name",
  "cash.cashierPlaceholder": "Cashier {number}",
  "cash.removeCashier": "Remove cashier",
  "cash.toast": "Toast cash payments",
  "cash.drawer": "Drawer total",
  "cash.turnIn": "Turn-in (\u2212 {amount})",
  "cash.overShort": "Over / short",
  "cash.shiftDeposit": "{shift} deposit",
  "cash.shiftOverShort": "{shift} over / short",
  "cash.dayTotal": "Day total",
  "cash.actualDeposit": "Actual deposit (AM + PM)",
  "cash.cashierDifference": "Cashier over / short (AM + PM)",
  "cash.zExpected": "Z report expected cash",
  "cash.zDifference": "Over / short vs Z report",
  "cash.history": "Last 30 days \xB7 {store}",
  "cash.empty": "No saved days yet.",
  "cash.dayDeposit": "Day deposit",
  "cash.dayDifference": "Day over/short",
  "cash.vsZ": "vs Z report",
  "dashboard.loading": "Loading cash-outs\u2026",
  "dashboard.cash": "Cash",
  "dashboard.bothStores": "Both stores",
  "dashboard.range": "Range",
  "dashboard.days": "{number} days",
  "dashboard.deposits": "Deposits",
  "dashboard.lastDays": "last {number} days",
  "dashboard.average": "Average per day",
  "dashboard.noComparison": "no earlier period to compare",
  "dashboard.previous": "vs previous {number} days",
  "dashboard.netDifference": "Net over / short",
  "dashboard.shortDays": "Days short: {number}",
  "dashboard.noShortDays": "no short days",
  "dashboard.missing": "Missing cash-outs",
  "dashboard.fillIn": "Fill them in",
  "dashboard.everyDay": "every day saved",
  "dashboard.dailyDeposits": "Daily deposits",
  "dashboard.noCashout": "No cash-out saved",
  "dashboard.day": "Day",
  "dashboard.vsToast": "Over / short vs Toast",
  "dashboard.over": "Over",
  "dashboard.short": "Short",
  "dashboard.noToast": "Toast figures not entered",
  "dashboard.byDay": "By day",
  "dashboard.oneStore": "1 store",
  "dashboard.notCounted": "Not counted yet",
  "dashboard.chart": "Chart; the By day table below has every value",
  "imports.firstName": "First name",
  "imports.lastName": "Last name",
  "imports.day": "Day of week",
  "imports.selectDay": "Select day",
  "imports.location": "Location",
  "imports.selectLocation": "Select China Rose location",
  "imports.salesInstructions": "Upload only Excel (.xlsx) files exported from toasttab.com. Remember to enable editing in Excel to see every change.",
  "imports.general": "General report",
  "imports.lunch": "Lunch report",
  "imports.dinner": "Dinner report",
  "imports.pickContext": "Pick the location and date first.",
  "imports.loadingCashout": "Loading cash-out\u2026",
  "imports.noCashout": "No cash-out saved for {date}.",
  "imports.filledCashout": "Filled from the cash-out for {date}.",
  "imports.uploadAll": "Please upload all three files (general, lunch, dinner)",
  "imports.failed": "Could not convert this file. Check the source and try again.",
  "imports.fillCashout": "Fill from cash-out",
  "imports.unlockCashout": "Unlock the Cash out tab to fill these from a saved day.",
  "imports.download": "Convert & download",
  "imports.hoursTitle": "Employee hours (CSV)",
  "imports.startDate": "Start date",
  "imports.endDate": "End date",
  "imports.hoursCsv": "Hours CSV",
  "imports.noFile": "No file selected.",
  "imports.chooseLocation": "Choose China Rose #3 or #2.",
  "imports.pickDates": "Pick start & end dates.",
  "imports.parsing": "Parsing CSV...",
  "imports.downloaded": "Done! XLSX downloaded.",
  "imports.fileReady": "File ready. Click convert to download.",
  "weekday.mon": "MON",
  "weekday.tue": "TUE",
  "weekday.wed": "WED",
  "weekday.thu": "THU",
  "weekday.fri": "FRI",
  "weekday.sat": "SAT",
  "weekday.sun": "SUN",
  "feedback.fixFields": "Check these fields:",
  "feedback.failed": "Could not save",
  "feedback.confirmTitle": "Confirm action",
  "feedback.cancel": "Cancel",
  "feedback.confirm": "Confirm",
  "feedback.storageFailed": "Could not save on this device. Keep this page open or copy your work.",
  "imports.pickLocation": "Choose a location.",
  "imports.pickDate": "Choose a date.",
  "cash.savedHistoryUnavailable": "Saved to server: {store} {date}. History could not refresh; keep your work and try loading history again.",
  "cash.draftContextNote": "Sheet values are saved on this device. Confirm the store and date when resuming.",
  "cash.earlierVersionSaved": "An earlier version of {store} {date} was saved to the server. Your newer edits still need saving.",
  "drafts.choose": "Resume a draft or start new",
  "drafts.deviceOnly": "Drafts stay on this device. Resuming keeps the original and opens a separate working copy.",
  "drafts.storageUnavailable": "Draft storage is unavailable. Keep this page open and download a copy before leaving.",
  "drafts.startNew": "Start new draft",
  "drafts.refresh": "Refresh drafts",
  "drafts.empty": "No drafts for this task, store and date.",
  "drafts.label": "{task} \xB7 {store} \xB7 {date}",
  "drafts.preparedBy": "Preparer: {preparer}",
  "drafts.savedAt": "Saved on this device: {time}",
  "drafts.upgradedCopy": "This older draft will open as a new copy. The original stays available.",
  "drafts.resumeCopy": "Resume as a copy",
  "drafts.unreadable": "This draft could not be read. Download its original source before starting a new one.",
  "drafts.downloadSource": "Download original source",
  "drafts.task.cash-out": "Cash out",
  "drafts.task.inventory-count": "Inventory count",
  "drafts.task.form": "Form",
  "drafts.task.sales-import": "Sales import",
  "drafts.task.hours-import": "Hours import",
  "drafts.task.schedule": "Schedule",
  "drafts.preparer": "Preparer label",
  "drafts.preparerHelp": "Enter the name or label for this working copy. It is not an authenticated signature.",
  "drafts.change": "Choose another draft",
  "drafts.handoff": "Save draft and lock",
  "drafts.downloadCurrent": "Download this working copy",
  "drafts.legacy": "An older cash-out draft has no store or date. Choose its context explicitly; the original source will remain unchanged.",
  "drafts.active": "Working draft \xB7 {store} \xB7 {date} \xB7 {preparer}",
  "drafts.station": "Station: {station}",
  "drafts.shift": "Shift: {shift}",
  "drafts.record": "Record: {record}",
  "cash.assignLegacy": "Use older draft for selected store/date",
  "cash.legacyConfirm": "Use the older unassigned sheet for {store} on {date}? The original source will remain unchanged.",
  "cash.legacyInvalid": "This older draft could not be assigned. Download its original to recover the values; nothing has been replaced.",
  "cash.legacyChanged": "The older draft changed in another window. Review its current source before assigning it.",
  "navigation.leaveDraft": "Leave this page? Your work has a copy on this device. Check the server-save status before leaving.",
  "navigation.leaveUnsaved": "Leave this page without a reliable device copy? Copy or download your changes first, or stay on this page.",
  "navigation.leave": "Leave page",
  "recovery.title": "Recover your changes",
  "recovery.retry": "Retry the same save",
  "recovery.reloadCompare": "Load server copy to compare",
  "recovery.copy": "Copy my changes",
  "recovery.download": "Download my changes",
  "recovery.useServer": "Use the server version",
  "recovery.copied": "Your changes were copied.",
  "recovery.copyFailed": "Could not copy. Download your changes instead.",
  "recovery.compare": "Compare changes",
  "recovery.field": "Field",
  "recovery.yours": "Your version",
  "recovery.theirs": "Server version",
  "recovery.noDifferences": "No field differences found. The server revision still changed.",
  "recovery.conflict": "Another editor saved this list. Your changes are retained. Compare or copy them before choosing a server version; no automatic overwrite will occur.",
  "recovery.localList": "Your list edits are on this page. Save them or download a copy before leaving.",
  "recovery.replaceConfirm": "Replace your on-screen list with the server version? Copy or download your changes first.",
  "recovery.dropList": "Discard your list edits and return to the saved list?",
  "recovery.listSaved": "Item list saved to server.",
  "recovery.inventoryName": "Name",
  "recovery.inventorySupplier": "Supplier",
  "recovery.inventoryUse": "Use value",
  "recovery.inventoryGray": "Gray row",
  "recovery.missingItem": "Not in this version",
  "recovery.saveList": "Save list",
  "recovery.editList": "Edit list",
  "recovery.yes": "Yes",
  "recovery.no": "No",
  "recovery.sheetTitle": "Sheet title",
  "recovery.account": "Account",
  "recovery.useLabel": "Use label",
  "recovery.showSupplier": "Show supplier",
  "recovery.itemOrder": "Item order",
  "recovery.note": "Note",
  "recovery.newerList": "The earlier list version was saved. Your newer edits still need saving.",
  "recovery.retryLegacy": "Try saving these list edits again",
  "importValidation.replace": "Replace",
  "importValidation.replaceSlot": "Replace {slot}",
  "importValidation.checking": "Checking file\u2026",
  "importValidation.valid": "File checks passed.",
  "importValidation.choose": "Choose the original source report.",
  "importValidation.fixFile": "Correct the source report and replace this file. Other inputs are kept.",
  "importValidation.empty": "This file is empty. Export the report again and replace it.",
  "importValidation.salesType": "Choose the original Toast Excel report (.xlsx or .xls), with its named worksheets.",
  "importValidation.hoursType": "Choose the original employee hours CSV report (.csv).",
  "importValidation.unreadable": "This file could not be read. Export an unencrypted source report again and replace it.",
  "importValidation.sheet": "Worksheet \u201C{sheet}\u201D is missing. Choose the correct Toast Excel report for this slot; a single CSV cannot contain the required named worksheets.",
  "importValidation.emptySheet": "Worksheet \u201C{sheet}\u201D has no data rows. Export the full report and replace the file.",
  "importValidation.column": "Worksheet \u201C{sheet}\u201D is missing column \u201C{column}\u201D. Restore the original report headers.",
  "importValidation.duplicateColumn": "Worksheet \u201C{sheet}\u201D repeats column \u201C{column}\u201D. Export an unmodified report with one header per column.",
  "importValidation.number": "Worksheet \u201C{sheet}\u201D, row {row}, \u201C{column}\u201D is blank or not a valid number. Correct it in the source; enter 0 only if the report confirms zero.",
  "importValidation.requiredRow": "Worksheet \u201C{sheet}\u201D is missing row \u201C{label}\u201D. Export the complete matching report.",
  "importValidation.duplicateRow": "Worksheet \u201C{sheet}\u201D repeats row \u201C{label}\u201D. Resolve duplicates in the source report before exporting.",
  "importValidation.badMetric": "A required sales value is missing or invalid. Correct and replace the source report.",
  "importValidation.hoursReport": "This is not the expected employee hours report. Upload the original CSV with Employee External Id and source hours columns.",
  "importValidation.csvColumn": "CSV header is missing \u201C{column}\u201D. Export the complete employee hours report.",
  "importValidation.csvDuplicateColumn": "CSV header repeats \u201C{column}\u201D. Restore one original header per column.",
  "importValidation.csv": "CSV record {row} has a format problem ({code}). Correct delimiters or quotation marks and replace the file. Record numbers include the header and blank records.",
  "importValidation.csvWidth": "CSV record {row} has a different number of columns from the header. Correct delimiters or quotation marks; no rows were exported.",
  "importValidation.csvRequired": "CSV record {row}: \u201C{column}\u201D is missing. Correct the source report; this row will not be silently skipped.",
  "importValidation.csvNumber": "CSV record {row}: \u201C{column}\u201D must contain a complete decimal number (for example 0 or 7.50). Correct the source value.",
  "importValidation.csvDate": "CSV record {row}: \u201C{column}\u201D is missing or is not a readable date/time. Export the original completed hours report; shift and payroll rules are unchanged.",
  "importValidation.noRows": "The CSV contains headers but no employee rows. Export the report with its source rows.",
  "importValidation.blocked": "Download blocked by source-file errors. Your inputs are kept.",
  "importValidation.exportFailed": "The workbook could not be generated. Your inputs are kept; check the connection to the template and try again.",
  "importValidation.period": "End date must be on or after start date. The preview includes whole shifts whose starting business date is within the inclusive range.",
  "importValidation.requiredCell": "Worksheet \u201C{sheet}\u201D, row {row}: \u201C{column}\u201D is missing. Restore the original source value.",
  "importValidation.manualDeposit": "{shift} deposit: enter a complete dollar amount, or leave it blank if unavailable.",
  "importValidation.manualDifference": "{shift} over/short: enter a complete dollar amount, or leave it blank if unavailable.",
  "salesReview.prepare": "Prepare sales review",
  "salesReview.title": "Review extracted sales figures",
  "salesReview.prepared": "Review prepared in session memory. Check sources and flags before downloading.",
  "salesReview.scope": "Store, date and weekday below were selected on this form. Verify the source reports cover that same store and period; file structure alone does not prove it.",
  "salesReview.generalDetected": "General report sheets detected",
  "salesReview.categoryDetected": "Sales category report detected; verify its lunch/dinner period",
  "salesReview.figures": "Figures copied to the workbook",
  "salesReview.sourceNote": "Source names and headers are shown exactly as supplied. Missing optional card/discount rows keep the existing zero mapping. Blank manual amounts stay blank.",
  "salesReview.figure": "Figure",
  "salesReview.value": "Amount",
  "salesReview.source": "Source evidence",
  "salesReview.cell": "Excel cell",
  "salesReview.entered": "Entered on this form",
  "salesReview.absent": "Optional source row absent; existing mapping uses zero",
  "salesReview.raw": "Original value",
  "salesReview.row": "Row {row}",
  "salesReview.missingValue": "Not available",
  "salesReview.checks": "Reconciliation checks",
  "salesReview.checkNote": "Within each category report, the total is compared with its detail rows. Payments compare the report total with the five mapped payment figures. Cross-report and cash/deposit comparisons require review: definitions, periods, other payment types or adjustments may differ. A matching number does not confirm matching scope or business approval. Missing detail or fractional-cent values cannot be confirmed.",
  "salesReview.match": "Arithmetic matches",
  "salesReview.different": "Difference \u2014 review required",
  "salesReview.missing": "Missing total/detail \u2014 cannot confirm",
  "salesReview.review": "Cross-report comparison \u2014 verify scope",
  "salesReview.comparison": "Source total: {left} \xB7 Compared total: {right} \xB7 Difference: {difference}",
  "salesReview.unmapped": "Payment rows outside the existing workbook mapping are listed below. They remain in your source file and are not automatically added to the workbook. Verify their treatment before downloading.",
  "salesReview.acknowledge": "I checked the selected context, source figures, missing values, differences and payment coverage for this workbook.",
  "salesReview.revenue": "Reported revenue",
  "salesReview.cash": "Cash payments",
  "salesReview.discover": "Discover",
  "salesReview.amex": "Amex",
  "salesReview.mastercard": "Mastercard",
  "salesReview.visa": "Visa",
  "salesReview.discounts": "Check discounts",
  "salesReview.voids": "Voids",
  "salesReview.food": "Food net sales",
  "salesReview.drink": "Drink net sales",
  "salesReview.tax": "Reported tax",
  "salesReview.amDeposit": "AM entered deposit",
  "salesReview.pmDeposit": "PM entered deposit",
  "salesReview.amDifference": "AM entered over/short",
  "salesReview.pmDifference": "PM entered over/short",
  "salesReview.lunchSales": "Lunch: total net sales versus category detail",
  "salesReview.dinnerSales": "Dinner: total net sales versus category detail",
  "salesReview.lunchTax": "Lunch: total tax versus category detail",
  "salesReview.dinnerTax": "Dinner: total tax versus category detail",
  "salesReview.payments": "Payments: report total versus mapped cash/cards",
  "salesReview.crossSales": "Revenue summary versus lunch + dinner net totals",
  "salesReview.crossPayments": "Revenue summary versus mapped cash/cards",
  "salesReview.cashDeposits": "Reported cash versus entered AM + PM deposits",
  "salesReview.unmappedCategories": "Extra sales categories are included in the arithmetic checks below their source report, but the existing workbook copies only FOOD and DRINK into its category cells. Review these other source rows before downloading (amounts shown: net sales, tax).",
  "importRetention.recovery": "Keep or recover this import",
  "importRetention.session": "Uploads and unsaved edits stay in this session\u2019s memory. Repeat download reuses the same generated workbook until you change inputs or start the next report.",
  "importRetention.deviceNote": "Optional device copies contain validated values and any generated workbook, not original upload files. They are available to other users of this browser, are not server saved, and remain after Start next report.",
  "importRetention.save": "Save a copy on this device",
  "importRetention.saved": "Import values and any generated workbook saved on this device. Original upload files are not stored.",
  "importRetention.failed": "Could not save this copy on the device. Your working import is still in memory; download it before leaving. Existing saved copies were preserved.",
  "importRetention.corrupt": "This saved output failed its integrity check. Your current work and original saved copy were preserved; download the original source for recovery.",
  "importRetention.nameRequired": "Enter a preparer name of 1\u2013120 characters before saving a device copy.",
  "importRetention.prepareFirst": "Validate the source and select its store/date or period first. Sales also needs a prepared review before a device copy can be saved.",
  "importRetention.selectContext": "Select the store and date or period to see matching device copies.",
  "importRetention.outputStored": "Generated workbook included; repeat download is available without an upload.",
  "importRetention.valuesStored": "Values only; generating the sales workbook may still need a connection to its template.",
  "importRetention.resumed": "Saved import values/output restored into this editor. Original upload files are not stored; reselect them only to reprocess. A later save creates an independent copy.",
  "importRetention.replaceWarning": "Replace this source file? This invalidates the current validation/review and generated workbook. Other inputs and saved device copies are kept.",
  "importRetention.startWarning": "Start the next report? This clears this editor\u2019s inputs, files, review and generated workbook. Download or save a device copy first if needed. Existing device copies are kept.",
  "importRetention.resumeWarning": "Resume this saved copy in place of the current working import? Unsaved edits and uploaded files in this editor will be replaced. Existing device copies are kept.",
  "importRetention.startNext": "Start next report",
  "importRetention.preparer": "Prepared by (for a device copy)",
  "forms.type.injury-report": "Injury report",
  "forms.type.customer-complaint": "Customer complaint",
  "forms.type.payroll-change-request": "Payroll change request",
  "forms.type.pay-rate-increase": "Pay rate increase application",
  "forms.delete": "Delete",
  "forms.deleteNamed": "Delete {type} for {employee}, {date}",
  "forms.deleteTitle": "Delete saved form?",
  "forms.deleteDescription": "This permanently deletes the saved form and removes it from all saved-form lists. This cannot be undone. Device drafts and downloaded or printed copies are separate.",
  "formDrafts.injury-reportTitle": "New injury report: choose the store, date and your name",
  "formDrafts.customer-complaintTitle": "New customer complaint: choose the store, date and your name",
  "formDrafts.payroll-change-requestTitle": "New payroll change request: choose the store, date and your name",
  "formDrafts.pay-rate-increaseTitle": "New pay rate increase application: choose the store, date and your name",
  "forms.savedTitle": "Saved forms",
  "forms.search": "Search name, label or store",
  "forms.type": "Form type",
  "forms.allTypes": "All forms",
  "forms.type.write-up": "Write-up",
  "forms.from": "From date",
  "forms.to": "To date",
  "forms.clearFilters": "Clear filters",
  "forms.count": "Showing {shown} of {total}",
  "forms.colDate": "Date",
  "forms.colType": "Form",
  "forms.colEmployee": "Person",
  "forms.colLabel": "Label",
  "forms.open": "Open",
  "forms.openNamed": "Open {type} for {employee}, {date}",
  "forms.none": "No forms saved yet.",
  "forms.noMatches": "No saved forms match these filters.",
  "forms.loadFailed": "Could not load saved forms. Your filters are kept.",
  "forms.retry": "Try again",
  "formDrafts.writeUpTitle": "New write-up: choose the store, date and your name",
  "formDrafts.intro": "Your work saves on this device as you type, so a reload or closed tab does not lose it. It is only on the server after you press Save.",
  "formDrafts.saved": "Saved to the server. This copy stays on the device for reference.",
  "formDrafts.alreadySaved": "This draft was already saved as a write-up. Saving again creates a second, separate write-up.",
  "formDrafts.saveAnother": "Edit as a new write-up"
};
var en_default = en;

// ../src/lib/converter/import-snapshot.ts
var FORM_KEYS = ["firstName", "lastName", "day", "date", "location", "amDeposit", "pmDeposit", "amOverShort", "pmOverShort"];
var SOURCE_CELLS = ["C8", "C9", "C10", "C11", "C12", "C13", "C16", "C17", "C18", "C19", "C20", "C21", "C22", "C23"];
var ALL_CELLS = [...SOURCE_CELLS, "C4", "C5", "C6", "C7"];
var SLOTS = ["general", "lunch", "dinner"];
var object3 = /* @__PURE__ */ __name((value) => !!value && typeof value === "object" && !Array.isArray(value), "object");
var keys3 = /* @__PURE__ */ __name((value, allowed) => Object.keys(value).every((key2) => allowed.includes(key2)), "keys");
var numberOrNull = /* @__PURE__ */ __name((value) => value === null || typeof value === "number" && Number.isFinite(value), "numberOrNull");
var label = /* @__PURE__ */ __name((value) => typeof value === "string" && value.startsWith("salesReview.") && Object.hasOwn(en_default, value), "label");
function importStore(location) {
  if (location === "CHINA ROSE #3 - 7046 W MILITARY DR") return "CR3";
  if (location === "CHINA ROSE #2 - 2535 SW MILITARY DR") return "CR2";
  return null;
}
__name(importStore, "importStore");
function validReview(value) {
  if (!object3(value) || !keys3(value, ["sources", "figures", "checks", "metrics", "form", "unmapped", "unmappedCategories", "context"])) return false;
  if (value.context !== void 0 && !validSalesContext(value.context)) return false;
  const { form, metrics, sources, figures, checks, unmapped, unmappedCategories } = value;
  if (!object3(form) || !keys3(form, FORM_KEYS) || !FORM_KEYS.every((key2) => typeof form[key2] === "string") || !importStore(form.location) || !businessDate(form.date)) return false;
  if (!object3(metrics) || !keys3(metrics, SOURCE_CELLS) || !SOURCE_CELLS.every((key2) => typeof metrics[key2] === "number" && Number.isFinite(metrics[key2]))) return false;
  if (!Array.isArray(sources) || sources.length !== 3 || new Set(sources.map((source) => source?.slot)).size !== 3 || !sources.every((source) => object3(source) && keys3(source, ["slot", "filename", "sheets", "fingerprint"]) && (source.fingerprint === void 0 || typeof source.fingerprint === "string" && /^sha256:[a-f0-9]{64}$/.test(source.fingerprint)) && SLOTS.includes(source.slot) && typeof source.filename === "string" && Array.isArray(source.sheets) && source.sheets.every((sheet) => typeof sheet === "string"))) return false;
  if (!Array.isArray(figures) || figures.length !== 18 || new Set(figures.map((figure) => figure?.cell)).size !== 18 || !figures.every((figure) => object3(figure) && keys3(figure, ["cell", "label", "value", "slot", "filename", "sheet", "row", "column", "raw", "absent"]) && ALL_CELLS.includes(figure.cell) && label(figure.label) && numberOrNull(figure.value) && [...SLOTS, "form"].includes(figure.slot) && ["filename", "sheet", "column"].every((key2) => typeof figure[key2] === "string") && (figure.row === null || Number.isSafeInteger(figure.row) && figure.row > 0) && (typeof figure.raw === "string" || numberOrNull(figure.raw)) && typeof figure.absent === "boolean")) return false;
  const manual = { C4: "amDeposit", C5: "pmDeposit", C6: "amOverShort", C7: "pmOverShort" };
  if (!figures.every((figure) => SOURCE_CELLS.includes(figure.cell) ? SLOTS.includes(figure.slot) && figure.value === metrics[figure.cell] && figure.filename === sources.find((source) => source.slot === figure.slot)?.filename : figure.slot === "form" && figure.value === (form[manual[figure.cell]] ? Number(form[manual[figure.cell]]) : null))) return false;
  if (!Array.isArray(checks) || checks.length !== 8 || !checks.every((check) => object3(check) && keys3(check, ["id", "label", "state", "left", "right", "difference"]) && typeof check.id === "string" && label(check.label) && ["match", "different", "missing", "review"].includes(check.state) && ["left", "right", "difference"].every((key2) => numberOrNull(check[key2])))) return false;
  if (!Array.isArray(unmapped) || !unmapped.every((row) => object3(row) && keys3(row, ["row", "type", "subtype", "value"]) && Number.isSafeInteger(row.row) && row.row > 0 && typeof row.type === "string" && typeof row.subtype === "string" && typeof row.value === "number" && Number.isFinite(row.value))) return false;
  return Array.isArray(unmappedCategories) && unmappedCategories.every((row) => object3(row) && keys3(row, ["slot", "row", "category", "net", "tax"]) && SLOTS.includes(row.slot) && Number.isSafeInteger(row.row) && row.row > 0 && typeof row.category === "string" && numberOrNull(row.net) && numberOrNull(row.tax));
}
__name(validReview, "validReview");
function isImportSnapshot(value) {
  if (!object3(value) || value.version !== 1 || !(value.output === null || isWorkbookOutput(value.output))) return false;
  if (value.kind === "sales") {
    if (!keys3(value, ["version", "kind", "review", "output"]) || !validReview(value.review)) return false;
    const date = value.review.form.date;
    return value.output === null || value.output.filename === `${date.slice(2, 4)}-${date.slice(5, 7)}${date.slice(8, 10)}_${importStore(value.review.form.location)}_Daily_Sales_Report.xlsx`;
  }
  if (value.kind !== "hours" || !keys3(value, ["version", "kind", "sourceName", "rows", "metadata", "output"]) || typeof value.sourceName !== "string" || !Array.isArray(value.rows) || !object3(value.metadata)) return false;
  const meta = value.metadata;
  if (!keys3(meta, ["location", "startDate", "endDate", "preparer", "fingerprint", "mapping"]) || !["location", "startDate", "endDate", "preparer"].every((key2) => typeof meta[key2] === "string") || !importStore(meta.location) || !businessDate(meta.startDate) || !businessDate(meta.endDate) || meta.startDate > meta.endDate) return false;
  if (meta.fingerprint !== void 0 && (typeof meta.fingerprint !== "string" || !/^sha256:[a-f0-9]{64}$/.test(meta.fingerprint))) return false;
  if (meta.mapping !== void 0 && (!object3(meta.mapping) || !keys3(meta.mapping, ["revision", "directory"]) || !Number.isSafeInteger(meta.mapping.revision) || meta.mapping.revision < 1 || !validDirectory(meta.mapping.directory, importStore(meta.location)))) return false;
  if (!value.rows.every((row) => object3(row) && keys3(row, [...HOURS_COLUMNS, "__sourceRow"]) && (row.__sourceRow === void 0 || Number.isSafeInteger(row.__sourceRow) && row.__sourceRow >= 2) && HOURS_COLUMNS.every((key2) => typeof row[key2] === "string"))) return false;
  const format = /* @__PURE__ */ __name((value2) => `${value2.slice(2, 4)}_${value2.slice(5, 7)}${value2.slice(8, 10)}`, "format");
  if (value.output && value.output.filename !== `${importStore(meta.location)}_${format(meta.startDate)}-${format(meta.endDate)}_EMPLOYEE_HOUR_LOG_SUMMARY.xlsx`) return false;
  return validateHoursRows([[...HOURS_COLUMNS], ...value.rows.map((row) => HOURS_COLUMNS.map((column) => row[column]))], [], true).value !== null;
}
__name(isImportSnapshot, "isImportSnapshot");

// ../src/lib/converter/hours-review.ts
function reviewHours(rows, start, end) {
  const validPeriod = !!businessDate(start) && !!businessDate(end) && start <= end;
  const reviewed = rows.map((values, index) => {
    const issues = [], from = sourceTime(values["In Date"]), to = sourceTime(values["Out Date"]);
    if (!validPeriod) issues.push("period");
    if (!values["Out Date"].trim()) issues.push("open");
    else if (from.issue === "ambiguous" || to.issue === "ambiguous") issues.push("ambiguous");
    else if (from.issue || to.issue) issues.push("date");
    else if (to.date < from.date || from.instant !== null && to.instant !== null && to.instant < from.instant) issues.push("reversed");
    if (!values["In Date"].trim() || from.issue === "invalid") {
      if (!issues.includes("date")) issues.push("date");
    }
    const numeric = ["Total Hours", "Regular Hours", "Overtime Hours"].map((key2) => sourceNumber(values[key2], false));
    if (numeric.some((n) => n === null || n < 0)) issues.push("hours");
    if (validPeriod && from.date && (from.date < start || from.date > end)) issues.push("outside");
    if (!values["Employee External Id"].trim() || !values.Employee.trim()) issues.push("identity");
    return { sourceRow: values.__sourceRow ?? index + 2, values, date: from.date, issues, included: !issues.some((i) => i !== "identity") };
  });
  const total = /* @__PURE__ */ __name((list, key2) => {
    const values = list.map((row) => sourceNumber(row.values[key2], false));
    return values.some((v) => v === null) ? null : values.reduce((a, b) => a + b, 0);
  }, "total");
  const included = reviewed.filter((row) => row.included), excluded = reviewed.filter((row) => !row.included);
  return {
    rows: reviewed,
    included,
    excluded,
    blocked: included.some((row) => row.issues.includes("identity")),
    validPeriod,
    totals: { source: total(reviewed, "Total Hours"), included: total(included, "Total Hours"), excluded: total(excluded, "Total Hours"), regular: total(included, "Regular Hours"), overtime: total(included, "Overtime Hours") }
  };
}
__name(reviewHours, "reviewHours");

// ../src/lib/converter/import-history.ts
var PARSER_VERSION = "imports-v1.1";
function snapshotPeriod(snapshot) {
  return snapshot.kind === "sales" ? { start: snapshot.review.form.date, end: snapshot.review.form.date } : { start: snapshot.metadata.startDate, end: snapshot.metadata.endDate };
}
__name(snapshotPeriod, "snapshotPeriod");
function snapshotStore(snapshot) {
  return importStore(snapshot.kind === "sales" ? snapshot.review.form.location : snapshot.metadata.location);
}
__name(snapshotStore, "snapshotStore");
function historySources(snapshot) {
  return snapshot.kind === "sales" ? snapshot.review.sources.map((s) => ({ slot: s.slot, filename: s.filename, fingerprint: s.fingerprint ?? "" })) : [{ slot: "hours", filename: snapshot.sourceName, fingerprint: snapshot.metadata.fingerprint ?? "" }];
}
__name(historySources, "historySources");
async function historyIdentity(snapshot) {
  const identity = { kind: snapshot.kind, storeId: snapshotStore(snapshot), period: snapshotPeriod(snapshot), parserVersion: PARSER_VERSION, workbookMappingVersion: "legacy-workbook-v1", mappingRevision: snapshot.kind === "hours" ? snapshot.metadata.mapping?.revision ?? 0 : 0, sources: historySources(snapshot).map(({ slot, fingerprint }) => ({ slot, fingerprint })).sort((a, b) => a.slot.localeCompare(b.slot)) };
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJson(identity)));
  return Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join("");
}
__name(historyIdentity, "historyIdentity");
function validHistoryData(value, store) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value;
  if (!Object.keys(v).every((k) => ["version", "kind", "identity", "parserVersion", "workbookMappingVersion", "mappingRevision", "sources", "snapshot", "output", "supersedesId", "reviewedBy", "accepted"].includes(k)) || v.version !== 1 || v.accepted !== true || !isImportSnapshot(v.snapshot) || v.snapshot.output !== null || snapshotStore(v.snapshot) !== store || v.kind !== v.snapshot.kind || v.parserVersion !== PARSER_VERSION || v.workbookMappingVersion !== "legacy-workbook-v1" || typeof v.identity !== "string" || !/^[a-f0-9]{64}$/.test(v.identity) || !Number.isSafeInteger(v.mappingRevision) || v.mappingRevision < 0 || v.mappingRevision !== (v.snapshot.kind === "hours" ? v.snapshot.metadata.mapping?.revision ?? 0 : 0) || typeof v.reviewedBy !== "string" || !v.reviewedBy.trim() || v.reviewedBy.length > 120 || !(v.supersedesId === null || typeof v.supersedesId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(v.supersedesId))) return false;
  const expected = historySources(v.snapshot);
  if (!Array.isArray(v.sources) || canonicalJson(v.sources) !== canonicalJson(expected) || !v.sources.every((s) => typeof s.fingerprint === "string" && /^sha256:[a-f0-9]{64}$/.test(s.fingerprint) && typeof s.filename === "string" && s.filename.length <= 255)) return false;
  if (!v.output || Object.keys(v.output).some((k) => !["filename", "sha256"].includes(k)) || typeof v.output.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(v.output.sha256) || typeof v.output.filename !== "string") return false;
  const period = snapshotPeriod(v.snapshot);
  if (!businessDate(period.start) || !businessDate(period.end) || period.start > period.end || !isStoreId(store)) return false;
  const snapshot = v.snapshot;
  if (snapshot.kind === "sales") {
    if (needsContextReview(snapshot.review.context, snapshot.review.form.date, store) && !snapshot.review.context?.reason.trim()) return false;
    const d2 = snapshot.review.form.date;
    return v.output.filename === `${d2.slice(2, 4)}-${d2.slice(5, 7)}${d2.slice(8, 10)}_${store}_Daily_Sales_Report.xlsx`;
  }
  const d = snapshot.metadata, review = reviewHours(snapshot.rows, d.startDate, d.endDate), mapped = mapHours(snapshot.rows, d.mapping?.directory ?? null, store, d.fingerprint ?? "");
  if (!review.validPeriod || !review.included.length || review.included.some((row) => !row.values.Employee.trim() || !row.values["Employee External Id"].trim() && !mapped.find((m) => m.sourceRow === row.sourceRow)?.employee) || ambiguousNames(review.included.map((r) => r.values), mapped.filter((m) => review.included.some((r) => r.sourceRow === m.sourceRow)))) return false;
  const format = /* @__PURE__ */ __name((d2) => `${d2.slice(2, 4)}_${d2.slice(5, 7)}${d2.slice(8, 10)}`, "format");
  return v.output.filename === `${store}_${format(d.startDate)}-${format(d.endDate)}_EMPLOYEE_HOUR_LOG_SUMMARY.xlsx`;
}
__name(validHistoryData, "validHistoryData");

// src/import-history.ts
function envelope(row, store) {
  const data = JSON.parse(row.data_json);
  if (!validHistoryData(data, store)) throw new Error("Unsupported import record");
  const p = snapshotPeriod(data.snapshot);
  return { schemaVersion: 1, family: "import", id: row.id, storeId: store, context: data.kind === "sales" ? { kind: "day", businessDate: p.start } : { kind: "period", ...p }, revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at, data };
}
__name(envelope, "envelope");
async function historyRecord(db, store, id) {
  const row = await db.prepare("SELECT id,data_json,revision,created_at,updated_at FROM records WHERE store_id=? AND family='import' AND id=?").bind(store, id).first();
  return row ? envelope(row, store) : null;
}
__name(historyRecord, "historyRecord");
async function historyPage(db, store, kind, start, end, cursor) {
  if (!["sales", "hours"].includes(kind) || !businessDate(start) || !businessDate(end) || start > end || kind === "sales" && start !== end || cursor && !recordId(cursor)) throw new Error("Invalid import query");
  const result = await db.prepare(`SELECT id,data_json,revision,created_at,updated_at FROM records WHERE store_id=? AND family='import' AND json_extract(data_json,'$.kind')=?
 AND ((context_kind='day' AND business_date=? AND ?=?) OR (context_kind='period' AND period_start=? AND period_end=?)) AND (?='' OR id<?) ORDER BY id DESC LIMIT 11`).bind(store, kind, start, start, end, start, end, cursor, cursor).all();
  return { records: result.results.slice(0, 10).map((row) => envelope(row, store)), nextCursor: result.results.length > 10 ? result.results[9].id : null };
}
__name(historyPage, "historyPage");
async function saveHistory(db, store, raw) {
  const body = raw;
  if (!body?.id || !recordId(body.id) || !body.mutation || body.mutation.baseRevision !== 0 || !validHistoryData(body.mutation.data, store)) return { ok: false, status: 400, body: apiError("validation_failed") };
  const data = body.mutation.data, p = snapshotPeriod(data.snapshot);
  if (await historyIdentity(data.snapshot) !== data.identity || !data.supersedesId && body.id !== `imp_${data.identity}` || data.supersedesId && !uuid(body.id)) return { ok: false, status: 400, body: apiError("validation_failed") };
  if (data.supersedesId) {
    const parent = await historyRecord(db, store, data.supersedesId);
    if (!parent || parent.id === body.id || parent.data.kind !== data.kind || JSON.stringify(snapshotPeriod(parent.data.snapshot)) !== JSON.stringify(p)) return { ok: false, status: 400, body: apiError("validation_failed") };
  }
  return mutateRecord(db, { storeId: store, family: "import", id: body.id, context: data.kind === "sales" ? { kind: "day", businessDate: businessDate(p.start) } : { kind: "period", start: businessDate(p.start), end: businessDate(p.end) }, callerScope: "manager", action: "record-reviewed-import", actor: { kind: "entered-label", label: data.reviewedBy } }, body.mutation, (value) => validHistoryData(value, store) ? [] : [{ path: "data", code: "invalid_import" }]);
}
__name(saveHistory, "saveHistory");

// src/import-directory.ts
async function directoryRecord(db, store) {
  const row = await db.prepare("SELECT data_json,revision,created_at,updated_at FROM records WHERE store_id=? AND family='employee-mapping' AND id='imports-directory'").bind(store).first();
  if (!row) return null;
  const data = JSON.parse(row.data_json);
  if (!validDirectory(data, store)) throw new Error("Invalid directory record");
  return { schemaVersion: 1, family: "employee-mapping", id: "imports-directory", storeId: store, context: { kind: "undated" }, revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at, data };
}
__name(directoryRecord, "directoryRecord");
async function saveDirectory(db, store, raw) {
  const body = raw;
  if (!body || typeof body.preparer !== "string" || !body.preparer.trim() || body.preparer.length > 120 || !body.mutation || !validDirectory(body.mutation.data, store)) return { ok: false, status: 400, body: apiError("validation_failed") };
  const previous = await directoryRecord(db, store);
  const preparer = body.preparer;
  return mutateRecord(db, { storeId: store, family: "employee-mapping", id: "imports-directory", context: { kind: "undated" }, callerScope: "manager", action: "review-directory", actor: { kind: "entered-label", label: preparer } }, body.mutation, (data) => {
    if (!validDirectory(data, store)) return [{ path: "data", code: "invalid_directory" }];
    if (previous?.data.employees.some((old) => !data.employees.some((e) => e.id === old.id))) return [{ path: "employees", code: "preserve_inactive_identity" }];
    if (data.mappings.some((mapping) => {
      const old = previous?.data.mappings.find((m) => m.id === mapping.id);
      return (!old || canonicalJson(old) !== canonicalJson(mapping)) && mapping.reviewedBy !== preparer.trim();
    })) return [{ path: "mappings", code: "review_provenance_required" }];
    return [];
  });
}
__name(saveDirectory, "saveDirectory");

// ../src/lib/digital-forms.ts
var f = /* @__PURE__ */ __name((key2, label2, kind, options) => ({ key: key2, label: label2, kind, options, required: ["employee", "incidentDate", "description", "periodEnd", "presentRate", "proposedRate", "effectiveDate"].includes(key2) }), "f");
var DIGITAL_FORMS = {
  "customer-complaint": {
    title: "Customer complaint",
    sections: [
      { title: "Complaint details", fields: [f("shift", "Shift of complaint", "select", ["AM", "PM"]), f("customer", "Customer name (optional)")] },
      { title: "Customer service", fields: [f("service", "Customer service concerns", "checks", ["Incorrect credit card charges", "Rude food server", "Rude cashier", "Rude shift leader / manager"])] },
      { title: "Food quality", fields: [f("quality", "Food quality concerns", "checks", ["Too salty", "Strange taste", "Too much sauce", "Sauce not enough", "Meat too tough", "Meat not done", "Rice too hard", "Rice burnt", "Rice raw", "Rice cold", "Meat cold"])] },
      { title: "Food quantity and other concerns", fields: [f("quantity", "Food quantity concerns", "checks", ["Meat not enough", "Vegetables not enough", "Rice not enough"]), f("other", "Other concerns", "checks", ["Table / chair dirty", "Floor dirty", "Restroom smells / messy", "Dining room too hot", "Dining room dirty", "Other"])] },
      { title: "Follow-up", fields: [f("comments", "Additional comments", "textarea"), f("resolution", "Action taken / resolution", "textarea"), f("manager", "Shift manager name"), f("managerDate", "Manager date", "date")] }
    ]
  },
  "pay-rate-increase": {
    title: "Pay rate increase application",
    sections: [
      { title: "Employee details", fields: [f("employee", "Employee name"), f("employeeNumber", "Employee number"), f("department", "Department"), f("position", "Position")] },
      { title: "Proposed increase", fields: [f("presentRate", "Present rate ($)", "money"), f("proposedRate", "Increase to ($)", "money"), f("payBasis", "Pay basis", "select", ["Hourly", "Salary"]), f("raiseDate", "Date of raise", "date"), f("effectiveDate", "Effective date", "date"), f("reason", "Reason / performance review", "textarea")] },
      { title: "Manager and office review", fields: [f("manager", "Store manager"), f("managerDate", "Manager date", "date"), f("approvedBy", "Approved by"), f("denialReason", "Application denied for the following reasons", "textarea")] }
    ]
  },
  "payroll-change-request": {
    title: "Payroll change request",
    sections: [
      { title: "Employee and pay period", fields: [f("company", "Company"), f("employeeNumber", "Employee number"), f("employee", "Employee name"), f("periodEnd", "Pay period ending date", "date")] },
      { title: "Payroll discrepancy", fields: [f("hoursShort", "Hours short"), f("payShort", "Pay short ($)", "money"), f("otherDiscrepancy", "Other discrepancy"), f("explanation", "Explanation", "textarea")] },
      { title: "Change information on payroll", fields: [f("nameChange", "Name change"), f("addressChange", "Address change", "textarea"), f("taxChange", "Tax withholding change"), f("otherChange", "Other change", "textarea")] },
      { title: "Signatures and approvals", fields: [f("employeeSignature", "Employee signature / name"), f("signedDate", "Employee signed date", "date"), f("manager", "Manager approved"), f("officeApproved", "Office approved")] }
    ]
  },
  "injury-report": {
    title: "Injury report",
    sections: [
      { title: "Injured person", fields: [f("company", "Company"), f("personType", "Injured person type", "select", ["Employee", "Customer", "Other"]), f("employee", "Injured person name"), f("phone", "Contact phone"), f("address", "Address", "textarea")] },
      { title: "Incident and first response", fields: [f("incidentDate", "Date of incident", "date"), f("incidentTime", "Time of incident", "time"), f("manager", "Manager on duty"), f("firstResponse", "First reaction to incident", "textarea"), f("emergencyResponse", "Emergency services contacted", "checks", ["Called 911", "Called police"]), f("referenceNumber", "911 reference number"), f("paramedic", "Name of paramedic"), f("policeCase", "Police case number"), f("officer", "Name of officer"), f("locationType", "Location of incident", "select", ["Inside the store", "Outside the store", "Other"]), f("location", "Where did the incident happen?")] },
      { title: "Witnesses and evidence", fields: [f("witness1", "First witness name"), f("witness1Phone", "First witness phone"), f("witness1Address", "First witness address"), f("witness2", "Second witness name"), f("witness2Phone", "Second witness phone"), f("witness2Address", "Second witness address"), f("evidence", "Evidence and where it is kept", "textarea")] },
      { title: "Report", fields: [f("description", "Describe the incident", "textarea"), f("reportedBy", "Report filled by"), f("reportDate", "Report date", "date")] }
    ]
  }
};
var isDigitalFormType = /* @__PURE__ */ __name((value) => typeof value === "string" && Object.hasOwn(DIGITAL_FORMS, value), "isDigitalFormType");
var digitalFields = /* @__PURE__ */ __name((type) => DIGITAL_FORMS[type].sections.flatMap((section) => section.fields), "digitalFields");
var validFormDate = /* @__PURE__ */ __name((value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, "validFormDate");
var text3 = /* @__PURE__ */ __name((value, max) => typeof value === "string" && value.length <= max, "text");
function isDigitalForm(value, type, complete = false) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const form = value;
  if (Object.keys(form).sort().join(",") !== "date,fields,preparedBy,store" || !validFormDate(form.date) || !["CR2", "CR3"].includes(form.store) || !text3(form.preparedBy, 120)) return false;
  if (!form.fields || typeof form.fields !== "object" || Array.isArray(form.fields)) return false;
  const fields = digitalFields(type);
  if (Object.keys(form.fields).length !== fields.length) return false;
  return fields.every((field) => {
    const v = form.fields[field.key];
    if (field.kind === "checks") return Array.isArray(v) && new Set(v).size === v.length && v.every((choice) => field.options.includes(choice));
    if (!text3(v, field.kind === "textarea" ? 3e3 : ["employee", "customer"].includes(field.key) ? 60 : 120)) return false;
    if (complete && (field.required || field.key === "employee") && !v.trim()) return false;
    if (field.kind === "select") return !v || field.options.includes(v);
    if (!complete) return true;
    if (field.kind === "date") return !v || validFormDate(v);
    if (field.kind === "time") return !v || /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
    if (field.kind === "money") return !v || /^\d{1,7}(\.\d{1,2})?$/.test(v);
    return true;
  });
}
__name(isDigitalForm, "isDigitalForm");
function digitalFormPerson(type, form) {
  const value = form.fields[type === "customer-complaint" ? "customer" : "employee"];
  return typeof value === "string" && value.trim() ? value.trim() : "Anonymous customer";
}
__name(digitalFormPerson, "digitalFormPerson");

// src/index.ts
var ID_RE = /^[A-Za-z0-9_-]{10}$/;
var CIPHER_RE = /^[A-Za-z0-9_-]+$/;
var HASH_RE = /^[0-9a-f]{1,16}$/;
var WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;
var MONTH_RE = /^\d{4}-\d{2}$/;
var MAX_CIPHER_CHARS = 16384;
var MAX_BODY_CHARS = 2e4;
var CASHOUT_TTL_SECONDS = 31 * 86400;
var CASHOUT_HISTORY_DAYS = 30;
var CASHOUT_FLOAT_CENTS = 1e4;
var CASHOUT_DENOMINATION_CENTS = [1e4, 5e3, 2e3, 1e3, 500, 100, 50, 25, 10, 5, 1];
var MAX_CASHIERS_PER_SHIFT = 20;
var MONEY_INPUT_RE = /^-?\d{0,7}(\.\d{0,2})?$/;
var DOC_TTL_SECONDS = 31536e3;
var WRITE_LIMIT_PER_HOUR = 60;
var VERIFY_LIMIT_PER_HOUR = 30;
var RESTAURANTS = ["CR3-diningroom", "CR3-kitchen", "CR2-kitchen", "CR2-diningroom"];
var DEFAULT_RESTAURANT = "CR3-diningroom";
var SCHEDULE_ONLY_RESTAURANTS = ["CR3-kitchen"];
function isScheduleOnlyRestaurant(restaurant) {
  return SCHEDULE_ONLY_RESTAURANTS.includes(restaurant);
}
__name(isScheduleOnlyRestaurant, "isScheduleOnlyRestaurant");
function isStaffEditableRestaurant(restaurant) {
  return isScheduleOnlyRestaurant(restaurant);
}
__name(isStaffEditableRestaurant, "isStaffEditableRestaurant");
var RESTAURANT_RE = /^[A-Za-z0-9-]{2,40}$/;
function isValidRestaurant(value) {
  return typeof value === "string" && RESTAURANTS.includes(value);
}
__name(isValidRestaurant, "isValidRestaurant");
function restaurantFromUrl(url) {
  const raw = url.searchParams.get("restaurant");
  if (raw === null || raw === "") return DEFAULT_RESTAURANT;
  if (!RESTAURANT_RE.test(raw) || !isValidRestaurant(raw)) return null;
  return raw;
}
__name(restaurantFromUrl, "restaurantFromUrl");
function isValidId(id) {
  return ID_RE.test(id);
}
__name(isValidId, "isValidId");
function monthKeyForWeekStart(weekStart) {
  return weekStart.slice(0, 7);
}
__name(monthKeyForWeekStart, "monthKeyForWeekStart");
function normalizeStoredWeek(raw) {
  if (!raw || typeof raw !== "object") return null;
  const doc = raw;
  if (typeof doc.id !== "string" || !isValidId(doc.id)) return null;
  if (typeof doc.ciphertext !== "string" || typeof doc.templateHash !== "string") return null;
  if (typeof doc.weekStart !== "string" || !WEEK_RE.test(doc.weekStart)) return null;
  if (typeof doc.rev !== "number" || typeof doc.updatedAt !== "string") return null;
  const visible = typeof doc.visible === "boolean" ? doc.visible : true;
  const monthKey = typeof doc.monthKey === "string" && MONTH_RE.test(doc.monthKey) ? doc.monthKey : monthKeyForWeekStart(doc.weekStart);
  return {
    v: 2,
    id: doc.id,
    rev: doc.rev,
    ciphertext: doc.ciphertext,
    templateHash: doc.templateHash,
    weekStart: doc.weekStart,
    updatedAt: doc.updatedAt,
    visible,
    monthKey
  };
}
__name(normalizeStoredWeek, "normalizeStoredWeek");
function validatePublishBody(body) {
  if (!body || typeof body !== "object") return null;
  const { ciphertext, templateHash, weekStart, visible } = body;
  if (typeof ciphertext !== "string" || ciphertext.length === 0 || ciphertext.length > MAX_CIPHER_CHARS || !CIPHER_RE.test(ciphertext)) {
    return null;
  }
  if (typeof templateHash !== "string" || !HASH_RE.test(templateHash)) return null;
  if (typeof weekStart !== "string" || !WEEK_RE.test(weekStart)) return null;
  if (visible !== void 0 && typeof visible !== "boolean") return null;
  const nextVisible = visible === void 0 ? true : visible;
  return { ciphertext, templateHash, weekStart, visible: nextVisible };
}
__name(validatePublishBody, "validatePublishBody");
function validateUpdateBody(body) {
  if (!body || typeof body !== "object") return null;
  const { ciphertext, visible, baseRev } = body;
  if (typeof baseRev !== "number" || !Number.isInteger(baseRev) || baseRev < 1) return null;
  let nextCipher;
  if (ciphertext !== void 0) {
    if (typeof ciphertext !== "string" || ciphertext.length === 0 || ciphertext.length > MAX_CIPHER_CHARS || !CIPHER_RE.test(ciphertext)) {
      return null;
    }
    nextCipher = ciphertext;
  }
  if (visible !== void 0 && typeof visible !== "boolean") return null;
  if (nextCipher === void 0 && visible === void 0) return null;
  return { ciphertext: nextCipher, visible, baseRev };
}
__name(validateUpdateBody, "validateUpdateBody");
function newShareId() {
  const bytes = crypto.getRandomValues(new Uint8Array(7));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
__name(newShareId, "newShareId");
var GOLDEN_VERSION = 1;
var MAX_PEOPLE = 64;
var MAX_NAME_CHARS = 80;
var MAX_TITLE_CHARS = 120;
var MAX_SLOTS = 200;
function goldenKey(weekStart, restaurant = DEFAULT_RESTAURANT) {
  return `r:${restaurant}:golden:${weekStart}`;
}
__name(goldenKey, "goldenKey");
function legacyGoldenKey(weekStart) {
  return `golden:${weekStart}`;
}
__name(legacyGoldenKey, "legacyGoldenKey");
function goldenMonthRevKey(monthKey, restaurant = DEFAULT_RESTAURANT) {
  return `r:${restaurant}:golden:month-rev:${monthKey}`;
}
__name(goldenMonthRevKey, "goldenMonthRevKey");
function shiftGoldenDate(isoDate, days) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) + days * 864e5).toISOString().slice(0, 10);
}
__name(shiftGoldenDate, "shiftGoldenDate");
function goldenMonthsForWeek(weekStart) {
  if (!WEEK_RE.test(weekStart)) return [];
  return [.../* @__PURE__ */ new Set([weekStart.slice(0, 7), shiftGoldenDate(weekStart, 6).slice(0, 7)])];
}
__name(goldenMonthsForWeek, "goldenMonthsForWeek");
async function readGoldenMonthRev(env, monthKey, restaurant = DEFAULT_RESTAURANT) {
  try {
    const raw = await env.SCHEDULES.get(goldenMonthRevKey(monthKey, restaurant));
    const rev = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isInteger(rev) && rev > 0 ? rev : 0;
  } catch {
    return 0;
  }
}
__name(readGoldenMonthRev, "readGoldenMonthRev");
async function bumpGoldenMonthRevs(env, weekStart, restaurant = DEFAULT_RESTAURANT) {
  for (const month of goldenMonthsForWeek(weekStart)) {
    const rev = await readGoldenMonthRev(env, month, restaurant);
    try {
      await env.SCHEDULES.put(goldenMonthRevKey(month, restaurant), String(rev + 1), { expirationTtl: DOC_TTL_SECONDS });
    } catch {
      return;
    }
  }
}
__name(bumpGoldenMonthRevs, "bumpGoldenMonthRevs");
async function readGoldenDoc(env, restaurant, weekStart) {
  const raw = await env.SCHEDULES.get(goldenKey(weekStart, restaurant));
  if (raw) return raw;
  if (restaurant === DEFAULT_RESTAURANT) {
    return await env.SCHEDULES.get(legacyGoldenKey(weekStart));
  }
  return null;
}
__name(readGoldenDoc, "readGoldenDoc");
function validateGoldenWeekBody(body) {
  if (!body || typeof body !== "object") return null;
  const { week, visible, baseRev } = body;
  if (typeof baseRev !== "number" || !Number.isInteger(baseRev) || baseRev < 0) return null;
  if (!week || typeof week !== "object") return null;
  const candidate = week;
  if (candidate.version !== GOLDEN_VERSION) return null;
  if (typeof candidate.weekStart !== "string" || !WEEK_RE.test(candidate.weekStart)) return null;
  if (typeof candidate.name !== "string" || candidate.name.length > MAX_TITLE_CHARS) return null;
  const people = candidate.people;
  if (!Array.isArray(people) || people.length > MAX_PEOPLE) return null;
  if (!people.every(
    (person) => typeof person === "string" && person.length > 0 && person.length <= MAX_NAME_CHARS
  )) {
    return null;
  }
  const slotPeople = candidate.slotPeople;
  if (!Array.isArray(slotPeople) || slotPeople.length > MAX_SLOTS) return null;
  const personCount = people.length;
  if (!slotPeople.every(
    (index) => typeof index === "number" && Number.isInteger(index) && index >= -1 && index < personCount
  )) {
    return null;
  }
  if (visible !== void 0 && typeof visible !== "boolean") return null;
  const nextVisible = visible === void 0 ? true : visible;
  return {
    week: {
      version: GOLDEN_VERSION,
      weekStart: candidate.weekStart,
      name: candidate.name,
      people: [...people],
      slotPeople: [...slotPeople]
    },
    visible: nextVisible,
    baseRev
  };
}
__name(validateGoldenWeekBody, "validateGoldenWeekBody");
function normalizeGoldenDoc(raw) {
  if (!raw || typeof raw !== "object") return null;
  const doc = raw;
  if (doc.v !== 3) return null;
  if (typeof doc.weekStart !== "string" || !WEEK_RE.test(doc.weekStart)) return null;
  if (typeof doc.rev !== "number" || !Number.isInteger(doc.rev) || doc.rev < 1) return null;
  if (typeof doc.templateHash !== "string" || !HASH_RE.test(doc.templateHash)) return null;
  if (typeof doc.updatedAt !== "string") return null;
  const week = validateGoldenWeekBody({ week: doc.week, baseRev: doc.rev });
  if (!week) return null;
  if (week.week.weekStart !== doc.weekStart) return null;
  return {
    v: 3,
    weekStart: doc.weekStart,
    rev: doc.rev,
    week: week.week,
    visible: doc.visible !== false,
    templateHash: doc.templateHash,
    updatedAt: doc.updatedAt
  };
}
__name(normalizeGoldenDoc, "normalizeGoldenDoc");
var GOLDEN_DAY_MS = 24 * 60 * 60 * 1e3;
function goldenWeeksForMonth(monthKey) {
  if (!MONTH_RE.test(monthKey)) return [];
  const [year, month] = monthKey.split("-").map(Number);
  const firstMs = Date.UTC(year, month - 1, 1);
  const lastMs = Date.UTC(year, month, 0);
  const firstSundayMs = firstMs - new Date(firstMs).getUTCDay() * GOLDEN_DAY_MS;
  const weeks = [];
  for (let cursor = firstSundayMs; cursor <= lastMs; cursor += 7 * GOLDEN_DAY_MS) {
    weeks.push(new Date(cursor).toISOString().slice(0, 10));
  }
  return weeks;
}
__name(goldenWeeksForMonth, "goldenWeeksForMonth");
var LEGACY_ROSTER_KEY = "roster:current";
function rosterKey(restaurant = DEFAULT_RESTAURANT) {
  return `r:${restaurant}:roster:current`;
}
__name(rosterKey, "rosterKey");
function rosterKeyForWeek(restaurant, weekStart) {
  return `r:${restaurant}:roster:${weekStart}`;
}
__name(rosterKeyForWeek, "rosterKeyForWeek");
function parseWeekStartParam(url) {
  const raw = url.searchParams.get("weekStart");
  if (raw === null || raw === "") return { present: false };
  if (!WEEK_RE.test(raw)) return { present: true, valid: false, value: raw };
  return { present: true, valid: true, value: raw };
}
__name(parseWeekStartParam, "parseWeekStartParam");
async function readRosterRaw(env, restaurant) {
  const raw = await env.SCHEDULES.get(rosterKey(restaurant));
  if (raw) return raw;
  if (restaurant === DEFAULT_RESTAURANT) {
    return await env.SCHEDULES.get(LEGACY_ROSTER_KEY);
  }
  return null;
}
__name(readRosterRaw, "readRosterRaw");
var ROSTER_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
var ROLE_SLUG_RE = /^[a-z0-9-]{1,40}$/;
function isValidRole(value) {
  return typeof value === "string" && ROLE_SLUG_RE.test(value);
}
__name(isValidRole, "isValidRole");
var MAX_EMPLOYEES = 100;
var MAX_RANGES_PER_DAY = 6;
var MAX_MINUTES_PER_DAY = 24 * 60;
var MAX_EMPLOYEE_ID_CHARS = 64;
var MAX_INCOMPATIBLE_IDS = 20;
function isValidStoredTimeRange(value) {
  if (!value || typeof value !== "object") return false;
  const { start, end } = value;
  return typeof start === "number" && typeof end === "number" && Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end <= MAX_MINUTES_PER_DAY && start < end;
}
__name(isValidStoredTimeRange, "isValidStoredTimeRange");
function isValidStoredEmployee(value) {
  if (!value || typeof value !== "object") return false;
  const employee = value;
  if (typeof employee.id !== "string" || employee.id.length === 0 || employee.id.length > MAX_EMPLOYEE_ID_CHARS || !/^[a-z0-9-]+$/.test(employee.id)) {
    return false;
  }
  if (typeof employee.name !== "string" || employee.name.length === 0 || employee.name.length > MAX_NAME_CHARS) return false;
  if (!Array.isArray(employee.roles) || !employee.roles.every(isValidRole)) {
    return false;
  }
  if (!employee.recurringAvailability || typeof employee.recurringAvailability !== "object") return false;
  const availability = employee.recurringAvailability;
  for (const [day, ranges] of Object.entries(availability)) {
    if (!ROSTER_DAYS.includes(day)) return false;
    if (!Array.isArray(ranges) || ranges.length > MAX_RANGES_PER_DAY || !ranges.every(isValidStoredTimeRange)) return false;
  }
  if (employee.maxDaysPerWeek !== void 0) {
    if (typeof employee.maxDaysPerWeek !== "number" || !Number.isInteger(employee.maxDaysPerWeek) || employee.maxDaysPerWeek < 1 || employee.maxDaysPerWeek > 7) {
      return false;
    }
  }
  if (employee.maxShiftsPerWeek !== void 0) {
    if (typeof employee.maxShiftsPerWeek !== "number" || !Number.isInteger(employee.maxShiftsPerWeek) || employee.maxShiftsPerWeek < 1 || employee.maxShiftsPerWeek > 21) {
      return false;
    }
  }
  if (employee.maxHoursPerWeek !== void 0) {
    if (typeof employee.maxHoursPerWeek !== "number" || !Number.isInteger(employee.maxHoursPerWeek) || employee.maxHoursPerWeek < 1 || employee.maxHoursPerWeek > 80) {
      return false;
    }
  }
  if (typeof employee.allowDoubles !== "boolean") return false;
  if (employee.maxDoublesPerWeek !== void 0) {
    if (typeof employee.maxDoublesPerWeek !== "number" || !Number.isInteger(employee.maxDoublesPerWeek) || employee.maxDoublesPerWeek < 0 || employee.maxDoublesPerWeek > 7) {
      return false;
    }
  }
  if (!Array.isArray(employee.incompatibleEmployeeIds) || employee.incompatibleEmployeeIds.length > MAX_INCOMPATIBLE_IDS || !employee.incompatibleEmployeeIds.every((id) => typeof id === "string")) {
    return false;
  }
  if (typeof employee.active !== "boolean") return false;
  if (employee.newHire !== void 0 && typeof employee.newHire !== "boolean") return false;
  for (const date of [employee.suspendedFrom, employee.suspendedUntil]) {
    if (date !== void 0 && (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))) return false;
  }
  if (employee.suspendedUntil !== void 0 && employee.suspendedFrom === void 0) return false;
  if (employee.suspendedFrom !== void 0 && employee.suspendedUntil !== void 0 && employee.suspendedUntil < employee.suspendedFrom) {
    return false;
  }
  if (employee.priority !== void 0) {
    if (typeof employee.priority !== "number" || !Number.isInteger(employee.priority) || employee.priority < 1 || employee.priority > 5) return false;
  }
  if (employee.shiftRoles !== void 0) {
    if (!Array.isArray(employee.shiftRoles) || employee.shiftRoles.length > ROSTER_DAYS.length * 2) return false;
    const seen = /* @__PURE__ */ new Set();
    for (const entry of employee.shiftRoles) {
      if (!entry || typeof entry !== "object") return false;
      const { day, period, role } = entry;
      if (typeof day !== "string" || !ROSTER_DAYS.includes(day) || period !== "AM" && period !== "PM" || !isValidRole(role)) return false;
      if (seen.has(`${day}:${period}`)) return false;
      seen.add(`${day}:${period}`);
    }
  }
  return true;
}
__name(isValidStoredEmployee, "isValidStoredEmployee");
function validateRosterBody(body) {
  if (!body || typeof body !== "object") return null;
  const { employees, baseRev } = body;
  if (typeof baseRev !== "number" || !Number.isInteger(baseRev) || baseRev < 0) return null;
  if (!Array.isArray(employees) || employees.length > MAX_EMPLOYEES) return null;
  if (!employees.every(isValidStoredEmployee)) return null;
  const ids = new Set(employees.map((employee) => employee.id));
  if (ids.size !== employees.length) return null;
  return {
    employees: employees.map((employee) => ({ ...employee, newHire: employee.newHire ?? false })),
    baseRev
  };
}
__name(validateRosterBody, "validateRosterBody");
function normalizeRosterDoc(raw) {
  if (!raw || typeof raw !== "object") return null;
  const doc = raw;
  if (doc.v !== 1) return null;
  if (typeof doc.rev !== "number" || !Number.isInteger(doc.rev) || doc.rev < 1) return null;
  if (typeof doc.updatedAt !== "string") return null;
  const valid = validateRosterBody({ employees: doc.employees, baseRev: doc.rev });
  if (!valid) return null;
  return { v: 1, rev: doc.rev, employees: valid.employees, updatedAt: doc.updatedAt };
}
__name(normalizeRosterDoc, "normalizeRosterDoc");
var STAFF_HISTORY_LIMIT = 10;
function staffKey(restaurant) {
  return `r:${restaurant}:staff:current`;
}
__name(staffKey, "staffKey");
function normalizeStaffEmployees(value) {
  if (value === null) return null;
  const valid = validateRosterBody({ employees: value, baseRev: 0 });
  return valid ? valid.employees : void 0;
}
__name(normalizeStaffEmployees, "normalizeStaffEmployees");
function normalizeStaffDoc(raw) {
  if (!raw || typeof raw !== "object") return null;
  const doc = raw;
  if (doc.v !== 1) return null;
  if (typeof doc.rev !== "number" || !Number.isInteger(doc.rev) || doc.rev < 1) return null;
  if (typeof doc.updatedAt !== "string") return null;
  const employees = normalizeStaffEmployees(doc.employees);
  if (employees === void 0) return null;
  if (!Array.isArray(doc.history)) return null;
  const history = [];
  for (const entry of doc.history.slice(0, STAFF_HISTORY_LIMIT)) {
    if (!entry || typeof entry !== "object") return null;
    const { employees: entryEmployees, updatedAt } = entry;
    const normalized = normalizeStaffEmployees(entryEmployees);
    if (normalized === void 0) return null;
    if (updatedAt !== null && typeof updatedAt !== "string") return null;
    history.push({ employees: normalized, updatedAt: updatedAt ?? null });
  }
  return { v: 1, rev: doc.rev, employees, updatedAt: doc.updatedAt, history };
}
__name(normalizeStaffDoc, "normalizeStaffDoc");
function validateStaffUndoBody(body) {
  if (!body || typeof body !== "object") return null;
  const { baseRev } = body;
  if (typeof baseRev !== "number" || !Number.isInteger(baseRev) || baseRev < 1) return null;
  return { baseRev };
}
__name(validateStaffUndoBody, "validateStaffUndoBody");
async function readStaffDoc(env, restaurant) {
  const raw = await env.SCHEDULES.get(staffKey(restaurant));
  return raw ? normalizeStaffDoc(safeParse(raw)) : null;
}
__name(readStaffDoc, "readStaffDoc");
function staffResponse(doc) {
  return {
    employees: doc?.employees ?? null,
    rev: doc?.rev ?? 0,
    updatedAt: doc?.updatedAt ?? null,
    canUndo: (doc?.history.length ?? 0) > 0
  };
}
__name(staffResponse, "staffResponse");
var LEGACY_TEMPLATE_KEY = "template:current";
function templateKey(restaurant = DEFAULT_RESTAURANT) {
  return `r:${restaurant}:template:current`;
}
__name(templateKey, "templateKey");
function templateKeyForWeek(restaurant, weekStart) {
  return `r:${restaurant}:template:${weekStart}`;
}
__name(templateKeyForWeek, "templateKeyForWeek");
async function readTemplateRaw(env, restaurant) {
  const raw = await env.SCHEDULES.get(templateKey(restaurant));
  if (raw) return raw;
  if (restaurant === DEFAULT_RESTAURANT) {
    return await env.SCHEDULES.get(LEGACY_TEMPLATE_KEY);
  }
  return null;
}
__name(readTemplateRaw, "readTemplateRaw");
var MAX_SLOTS_PER_DAY = 20;
var MAX_LABEL_CHARS = 60;
function isValidStoredTemplateSlot(value) {
  if (!value || typeof value !== "object") return false;
  const slot = value;
  if (slot.period !== "AM" && slot.period !== "PM") return false;
  if (!isValidRole(slot.role)) return false;
  if (typeof slot.label !== "string" || slot.label.length === 0 || slot.label.length > MAX_LABEL_CHARS) return false;
  if (typeof slot.start !== "number" || !Number.isInteger(slot.start) || slot.start < 0 || slot.start >= MAX_MINUTES_PER_DAY) return false;
  if (typeof slot.end !== "number" || !Number.isInteger(slot.end) || slot.end <= slot.start || slot.end > MAX_MINUTES_PER_DAY) return false;
  if (typeof slot.required !== "boolean") return false;
  return true;
}
__name(isValidStoredTemplateSlot, "isValidStoredTemplateSlot");
function validateTemplateBody(body) {
  if (!body || typeof body !== "object") return null;
  const { template, baseRev } = body;
  if (typeof baseRev !== "number" || !Number.isInteger(baseRev) || baseRev < 0) return null;
  if (!template || typeof template !== "object") return null;
  const candidate = template;
  if (Object.keys(candidate).some((key2) => !ROSTER_DAYS.includes(key2))) return null;
  const result = {};
  for (const day of ROSTER_DAYS) {
    const slots = candidate[day] ?? [];
    if (!Array.isArray(slots) || slots.length > MAX_SLOTS_PER_DAY || !slots.every(isValidStoredTemplateSlot)) return null;
    result[day] = slots;
  }
  return { template: result, baseRev };
}
__name(validateTemplateBody, "validateTemplateBody");
function normalizeTemplateDoc(raw) {
  if (!raw || typeof raw !== "object") return null;
  const doc = raw;
  if (doc.v !== 1) return null;
  if (typeof doc.rev !== "number" || !Number.isInteger(doc.rev) || doc.rev < 1) return null;
  if (typeof doc.updatedAt !== "string") return null;
  const valid = validateTemplateBody({ template: doc.template, baseRev: doc.rev });
  if (!valid) return null;
  return { v: 1, rev: doc.rev, template: valid.template, updatedAt: doc.updatedAt };
}
__name(normalizeTemplateDoc, "normalizeTemplateDoc");
function validateCashier(raw) {
  if (!raw || typeof raw !== "object") return null;
  const c = raw;
  if (typeof c.name !== "string" || c.name.length > 60) return null;
  if (typeof c.toast !== "string" || !MONEY_INPUT_RE.test(c.toast)) return null;
  if (!Array.isArray(c.counts) || c.counts.length !== CASHOUT_DENOMINATION_CENTS.length) return null;
  if (!c.counts.every((n) => Number.isInteger(n) && n >= 0 && n <= 1e5)) return null;
  return { name: c.name, counts: c.counts, toast: c.toast };
}
__name(validateCashier, "validateCashier");
var moneyCents = /* @__PURE__ */ __name((text4) => {
  const n = parseFloat(text4);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}, "moneyCents");
var addOrNull = /* @__PURE__ */ __name((a, b) => a === null || b === null ? null : a + b, "addOrNull");
function shiftCashoutTotals(cashiers) {
  return cashiers.reduce((t, c) => {
    const turnIn = c.counts.reduce((sum, n, i) => sum + CASHOUT_DENOMINATION_CENTS[i] * n, 0) - CASHOUT_FLOAT_CENTS;
    const overShort = c.toast.trim() === "" ? null : turnIn - moneyCents(c.toast);
    return { deposit: t.deposit + turnIn, overShort: addOrNull(t.overShort, overShort) };
  }, { deposit: 0, overShort: 0 });
}
__name(shiftCashoutTotals, "shiftCashoutTotals");
function cashoutTotals(sheet) {
  const am = shiftCashoutTotals(sheet.am);
  const pm = shiftCashoutTotals(sheet.pm);
  const deposit = am.deposit + pm.deposit;
  return {
    amDeposit: am.deposit,
    pmDeposit: pm.deposit,
    amOverShort: am.overShort,
    pmOverShort: pm.overShort,
    deposit,
    overShort: addOrNull(am.overShort, pm.overShort),
    zOverShort: sheet.zReport.trim() === "" ? null : deposit - moneyCents(sheet.zReport)
  };
}
__name(cashoutTotals, "cashoutTotals");
function validateCashoutBody(raw) {
  if (!raw || typeof raw !== "object") return null;
  const sheet = raw.sheet;
  if (!sheet || typeof sheet !== "object") return null;
  if (typeof sheet.zReport !== "string" || !MONEY_INPUT_RE.test(sheet.zReport)) return null;
  const shifts = [sheet.am, sheet.pm].map(
    (shift) => Array.isArray(shift) && shift.length <= MAX_CASHIERS_PER_SHIFT ? shift.map(validateCashier) : null
  );
  if (shifts.some((shift) => !shift || shift.some((c) => !c))) return null;
  const valid = { am: shifts[0], pm: shifts[1], zReport: sheet.zReport };
  return { sheet: valid, totals: cashoutTotals(valid) };
}
__name(validateCashoutBody, "validateCashoutBody");
function cashoutKey(store, date) {
  return `cashout:${store}:${date}`;
}
__name(cashoutKey, "cashoutKey");
function cashoutHistoryDates(to) {
  const end = Date.parse(`${to}T00:00:00Z`);
  return Array.from({ length: CASHOUT_HISTORY_DAYS }, (_, i) => new Date(end - i * 864e5).toISOString().slice(0, 10));
}
__name(cashoutHistoryDates, "cashoutHistoryDates");
var INVENTORY_TTL_SECONDS = 366 * 86400;
var INVENTORY_HISTORY_DAYS = 14;
var MAX_INVENTORY_ITEMS = 300;
var INVENTORY_ITEM_RE = /^[a-z0-9-]{1,60}$/;
var INVENTORY_CELL_RE = /^[A-Za-z0-9./ ✓]{0,12}$/;
function validateInventoryBody(raw) {
  const counts = raw?.counts;
  if (!counts || typeof counts !== "object" || Array.isArray(counts)) return null;
  const entries = Object.entries(counts);
  if (entries.length > MAX_INVENTORY_ITEMS) return null;
  const out = {};
  for (const [id, cell] of entries) {
    const { inv, order, done } = cell ?? {};
    if (!INVENTORY_ITEM_RE.test(id) || typeof inv !== "string" || typeof order !== "string") return null;
    if (!INVENTORY_CELL_RE.test(inv) || !INVENTORY_CELL_RE.test(order) || done !== void 0 && typeof done !== "boolean") return null;
    out[id] = done ? { inv, order, done } : { inv, order };
  }
  return { counts: out };
}
__name(validateInventoryBody, "validateInventoryBody");
function inventoryKey(store, date) {
  return `inventory:${store}:${date}`;
}
__name(inventoryKey, "inventoryKey");
var MAX_INVENTORY_SHEETS = 20;
var MAX_INVENTORY_LIST_CHARS = 64e3;
var optionalText = /* @__PURE__ */ __name((v, max) => v === void 0 || isText(v, max), "optionalText");
function validateInventoryListBody(raw) {
  const { sheets, baseRev } = raw ?? {};
  if (!Number.isInteger(baseRev) || baseRev < 0) return null;
  if (!Array.isArray(sheets) || sheets.length < 1 || sheets.length > MAX_INVENTORY_SHEETS) return null;
  const ids = /* @__PURE__ */ new Set();
  const out = [];
  for (const sheet of sheets) {
    const s = sheet ?? {};
    if (!INVENTORY_ITEM_RE.test(String(s.id)) || !isText(s.useLabel, 20) || typeof s.showSup !== "boolean") return null;
    if (!optionalText(s.title, 60) || !optionalText(s.account, 30) || !Array.isArray(s.items)) return null;
    const items = [];
    for (const item of s.items) {
      const i = item ?? {};
      if (typeof i.id !== "string" || !INVENTORY_ITEM_RE.test(i.id) || ids.has(i.id)) return null;
      if (!isText(i.name, 60) || !i.name.trim() || !isText(i.sup, 10) || typeof i.gray !== "boolean") return null;
      if (typeof i.use !== "string" || !INVENTORY_CELL_RE.test(i.use) || i.use.includes("\u2713") || !optionalText(i.note, 20)) return null;
      ids.add(i.id);
      items.push({ id: i.id, name: i.name, sup: i.sup, use: i.use, gray: i.gray, ...i.note ? { note: i.note } : {} });
    }
    const { title, account } = s;
    out.push({ id: String(s.id), ...title ? { title } : {}, ...account ? { account } : {}, useLabel: s.useLabel, showSup: s.showSup, items });
  }
  if (ids.size > MAX_INVENTORY_ITEMS) return null;
  return { sheets: out, baseRev };
}
__name(validateInventoryListBody, "validateInventoryListBody");
function inventoryListKey(store) {
  return `inventory-list:${store}`;
}
__name(inventoryListKey, "inventoryListKey");
var WRITEUP_VIOLATIONS = ["attendance", "job-performance", "conduct", "company-policy", "others"];
var WRITEUP_ACTIONS = ["verbal", "written", "suspension", "termination"];
var WRITEUP_SHORT_CHARS = 60;
var WRITEUP_LONG_CHARS = 3e3;
var WRITEUP_LABEL_CHARS = 120;
var isDate = /* @__PURE__ */ __name((v) => typeof v === "string" && WEEK_RE.test(v) && !Number.isNaN(Date.parse(v)), "isDate");
var isText = /* @__PURE__ */ __name((v, max) => typeof v === "string" && v.length <= max, "isText");
var isSubset = /* @__PURE__ */ __name((v, allowed) => Array.isArray(v) && v.length <= allowed.length && new Set(v).size === v.length && v.every((x) => allowed.includes(x)), "isSubset");
function validateWriteUpForm(raw) {
  if (!raw || typeof raw !== "object") return null;
  const f2 = raw;
  if (!isDate(f2.date)) return null;
  if (!isText(f2.employee, WRITEUP_SHORT_CHARS) || !f2.employee.trim()) return null;
  if (!isSubset(f2.violations, WRITEUP_VIOLATIONS) || !isSubset(f2.actions, WRITEUP_ACTIONS)) return null;
  const short = ["manager", "otherSpecify", "employeeSignature", "managerSignature"];
  const long = ["incident", "incidentCont", "expected", "employeeComments"];
  if (!short.every((k) => isText(f2[k], WRITEUP_SHORT_CHARS))) return null;
  if (!long.every((k) => isText(f2[k], WRITEUP_LONG_CHARS))) return null;
  if (![f2.employeeSignedDate, f2.managerSignedDate].every((d) => d === "" || isDate(d))) return null;
  const form = Object.fromEntries(
    [...short, ...long, "employeeSignedDate", "managerSignedDate"].map((k) => [k, f2[k]])
  );
  return { date: f2.date, employee: f2.employee.trim(), violations: f2.violations, actions: f2.actions, ...form };
}
__name(validateWriteUpForm, "validateWriteUpForm");
function validateWriteUpLabel(raw) {
  const label2 = raw && typeof raw === "object" ? raw.label : void 0;
  return isText(label2, WRITEUP_LABEL_CHARS) ? label2.trim() : null;
}
__name(validateWriteUpLabel, "validateWriteUpLabel");
function writeUpKey(id) {
  return `writeup:${id}`;
}
__name(writeUpKey, "writeUpKey");
async function putWriteUp(env, doc) {
  const metadata = { date: doc.form.date, employee: doc.form.employee, label: doc.label };
  await env.SCHEDULES.put(writeUpKey(doc.id), JSON.stringify(doc), { metadata });
}
__name(putWriteUp, "putWriteUp");
async function listWriteUps(env) {
  const out = [];
  let cursor;
  do {
    const page = await env.SCHEDULES.list({ prefix: "writeup:", cursor });
    for (const key2 of page.keys) {
      const meta = key2.metadata;
      if (meta) out.push({ id: key2.name.slice("writeup:".length), ...meta });
    }
    cursor = page.list_complete ? void 0 : page.cursor;
  } while (cursor);
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.employee.localeCompare(b.employee));
}
__name(listWriteUps, "listWriteUps");
function goldenWriteError(env) {
  return env.SCHEDULE_WRITE_TOKEN ? null : "write_not_configured";
}
__name(goldenWriteError, "goldenWriteError");
function isGoldenWriteAuthorized(request, env) {
  const token = env.SCHEDULE_WRITE_TOKEN ?? "";
  if (!token) return false;
  return request.headers.get("Authorization") === `Bearer ${token}`;
}
__name(isGoldenWriteAuthorized, "isGoldenWriteAuthorized");
var DEFAULT_STAFF_EDIT_PASSWORD = "test";
function staffPassword(env) {
  return env.STAFF_EDIT_PASSWORD || DEFAULT_STAFF_EDIT_PASSWORD;
}
__name(staffPassword, "staffPassword");
function isStaffEditAuthorized(request, env) {
  if (request.headers.get("Authorization") === `Bearer ${staffPassword(env)}`) return true;
  return isGoldenWriteAuthorized(request, env);
}
__name(isStaffEditAuthorized, "isStaffEditAuthorized");
async function managerAuthError(request, env) {
  if (goldenWriteError(env)) return json({ error: "write_not_configured" }, 503, request, env);
  if (isGoldenWriteAuthorized(request, env)) return null;
  if (!await checkVerifyThrottle(env, clientIp(request))) {
    return json({ error: "rate_limited" }, 429, request, env, { "Retry-After": "3600" });
  }
  return json({ error: "unauthorized" }, 401, request, env);
}
__name(managerAuthError, "managerAuthError");
function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") ?? request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ?? "unknown";
}
__name(clientIp, "clientIp");
function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") ?? "";
  const configured = (env.ALLOWED_ORIGIN ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
  const defaultOk = origin.startsWith("https://chinarose") || origin.endsWith(".github.io") || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");
  const allow = configured.length > 0 ? configured.includes(origin) : origin === "" || origin.startsWith("https://") || defaultOk;
  return allow && origin !== "" ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : { "Access-Control-Allow-Origin": "*" };
}
__name(corsHeaders, "corsHeaders");
function json(data, status, request, env, extra) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(request, env), ...extra }
  });
}
__name(json, "json");
async function checkWriteThrottle(env, ip) {
  try {
    const key2 = `rl:${ip}:${(/* @__PURE__ */ new Date()).toISOString().slice(0, 13)}`;
    const raw = await env.SCHEDULES.get(key2);
    const count = raw ? Number.parseInt(raw, 10) || 0 : 0;
    if (count >= WRITE_LIMIT_PER_HOUR) return false;
    await env.SCHEDULES.put(key2, String(count + 1), { expirationTtl: 3600 });
    return true;
  } catch {
    return true;
  }
}
__name(checkWriteThrottle, "checkWriteThrottle");
async function checkVerifyThrottle(env, ip) {
  try {
    const key2 = `rlv:${ip}:${(/* @__PURE__ */ new Date()).toISOString().slice(0, 13)}`;
    const raw = await env.SCHEDULES.get(key2);
    const count = raw ? Number.parseInt(raw, 10) || 0 : 0;
    if (count >= VERIFY_LIMIT_PER_HOUR) return false;
    await env.SCHEDULES.put(key2, String(count + 1), { expirationTtl: 3600 });
    return true;
  } catch {
    return true;
  }
}
__name(checkVerifyThrottle, "checkVerifyThrottle");
async function readBody(request, maxChars = MAX_BODY_CHARS) {
  const text4 = await request.text();
  if (text4.length > maxChars) throw new Error("body_too_large");
  try {
    return JSON.parse(text4);
  } catch {
    return null;
  }
}
__name(readBody, "readBody");
function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
__name(safeParse, "safeParse");
function monthIndexKey(monthKey) {
  return `month:${monthKey}`;
}
__name(monthIndexKey, "monthIndexKey");
async function readMonthIndex(env, monthKey) {
  try {
    const raw = await env.SCHEDULES.get(monthIndexKey(monthKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id) => typeof id === "string" && isValidId(id));
  } catch {
    return [];
  }
}
__name(readMonthIndex, "readMonthIndex");
async function addToMonthIndex(env, monthKey, id) {
  const existing = await readMonthIndex(env, monthKey);
  if (existing.includes(id)) return;
  const next = [...existing, id].sort().slice(0, 60);
  try {
    await env.SCHEDULES.put(monthIndexKey(monthKey), JSON.stringify(next), { expirationTtl: DOC_TTL_SECONDS });
  } catch {
    return;
  }
}
__name(addToMonthIndex, "addToMonthIndex");
var index_default = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders(request, env),
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400"
        }
      });
    }
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (request.method === "GET" && (path === "/" || path === "/api/health")) {
      return json({ ok: true }, 200, request, env);
    }
    if (request.method === "GET" && path === "/api/auth/verify") {
      if (goldenWriteError(env)) return json({ error: "write_not_configured" }, 503, request, env);
      if (!await checkVerifyThrottle(env, clientIp(request))) {
        return json({ error: "rate_limited" }, 429, request, env, { "Retry-After": "3600" });
      }
      if (!isGoldenWriteAuthorized(request, env)) return json({ error: "unauthorized" }, 401, request, env);
      return json({ ok: true }, 200, request, env);
    }
    const requestsMatch = path.match(/^\/api\/internal\/schedule-requests\/([^/]+)$/);
    if (requestsMatch && (request.method === "GET" || request.method === "PUT")) {
      const denied = await managerAuthError(request, env);
      if (denied) return denied;
      const noStore = { "Cache-Control": "no-store" };
      const station = requestsMatch[1];
      if (!isStationId(station)) return json({ schemaVersion: 1, error: { code: "validation_failed" } }, 400, request, env, noStore);
      if (!env.INTERNAL_DB) return json({ schemaVersion: 1, error: { code: "backend_unconfigured" } }, 503, request, env, noStore);
      try {
        if (request.method === "GET") return json({ record: await requestRecord(env.INTERNAL_DB, station) }, 200, request, env, noStore);
        if (!await checkWriteThrottle(env, clientIp(request))) return json({ error: "rate_limited" }, 429, request, env, noStore);
        const result = await saveRequests(env.INTERNAL_DB, station, await readRequestMutation(request));
        return json(result.ok ? { record: result.record, replayed: result.replayed } : result.body, result.ok ? 200 : result.status, request, env, noStore);
      } catch {
        return json({ schemaVersion: 1, error: { code: "unavailable" } }, 503, request, env, noStore);
      }
    }
    const importSchedulesMatch = path.match(/^\/api\/internal\/import-schedules\/(CR2|CR3)$/);
    if (importSchedulesMatch && request.method === "GET") {
      const denied = await managerAuthError(request, env);
      if (denied) return denied;
      const store = importSchedulesMatch[1], start = url.searchParams.get("start") ?? "", end = url.searchParams.get("end") ?? "";
      let weeks;
      try {
        weeks = weeksInPeriod(start, end);
      } catch {
        return json({ error: "invalid_period" }, 400, request, env);
      }
      try {
        const stations = RESTAURANTS.filter((station) => station.startsWith(store + "-"));
        const publications = await Promise.all(stations.flatMap((station) => weeks.map(async (week) => {
          const [raw, weekRaw, globalRaw] = await Promise.all([readGoldenDoc(env, station, week), env.SCHEDULES.get(templateKeyForWeek(station, week)), readTemplateRaw(env, station)]);
          const weekDoc = weekRaw ? normalizeTemplateDoc(safeParse(weekRaw)) : null;
          const globalDoc = globalRaw ? normalizeTemplateDoc(safeParse(globalRaw)) : null;
          return publishedHours(station, week, raw ? safeParse(raw) ?? {} : null, weekDoc?.template ?? null, globalDoc?.template ?? null);
        })));
        return json({ version: 1, storeId: store, start, end, publications }, 200, request, env, { "Cache-Control": "no-store" });
      } catch {
        return json({ schemaVersion: 1, error: { code: "unavailable" } }, 503, request, env, { "Cache-Control": "no-store" });
      }
    }
    const importHistoryMatch = path.match(/^\/api\/internal\/import-history\/(CR2|CR3)(?:\/([A-Za-z0-9_-]{1,128}))?$/);
    if (importHistoryMatch && (request.method === "GET" || request.method === "POST")) {
      const denied = await managerAuthError(request, env);
      if (denied) return denied;
      const noStore = { "Cache-Control": "no-store" };
      if (!env.INTERNAL_DB) return json({ schemaVersion: 1, error: { code: "backend_unconfigured" } }, 503, request, env, noStore);
      const store = importHistoryMatch[1];
      try {
        if (request.method === "GET") {
          if (importHistoryMatch[2]) return json({ record: await historyRecord(env.INTERNAL_DB, store, importHistoryMatch[2]) }, 200, request, env, noStore);
          const page = await historyPage(env.INTERNAL_DB, store, url.searchParams.get("kind") ?? "", url.searchParams.get("start") ?? "", url.searchParams.get("end") ?? "", url.searchParams.get("cursor") ?? "");
          return json(page, 200, request, env, noStore);
        }
        if (importHistoryMatch[2]) return json({ error: "not_found" }, 404, request, env, noStore);
        if (!await checkWriteThrottle(env, clientIp(request))) return json({ error: "rate_limited" }, 429, request, env);
        const result = await saveHistory(env.INTERNAL_DB, store, await readBody(request, 1e6));
        return json(result.ok ? { record: result.record, replayed: result.replayed } : result.body, result.ok ? 200 : result.status, request, env, noStore);
      } catch {
        return json({ schemaVersion: 1, error: { code: "unavailable" } }, 503, request, env, noStore);
      }
    }
    const directoryMatch = path.match(/^\/api\/internal\/import-directory\/(CR2|CR3)$/);
    if (directoryMatch && (request.method === "GET" || request.method === "PUT")) {
      const denied = await managerAuthError(request, env);
      if (denied) return denied;
      const noStore = { "Cache-Control": "no-store" };
      if (!env.INTERNAL_DB) return json({ schemaVersion: 1, error: { code: "backend_unconfigured" } }, 503, request, env, noStore);
      const store = directoryMatch[1];
      try {
        if (request.method === "GET") return json({ record: await directoryRecord(env.INTERNAL_DB, store) }, 200, request, env, noStore);
        if (!await checkWriteThrottle(env, clientIp(request))) return json({ error: "rate_limited" }, 429, request, env);
        const result = await saveDirectory(env.INTERNAL_DB, store, await readBody(request, 3e5));
        return json(result.ok ? { record: result.record, replayed: result.replayed } : result.body, result.ok ? 200 : result.status, request, env, noStore);
      } catch {
        return json({ schemaVersion: 1, error: { code: "unavailable" } }, 503, request, env, noStore);
      }
    }
    const cashoutMatch = path.match(/^\/api\/cashout\/(CR3|CR2)(?:\/(\d{4}-\d{2}-\d{2}))?$/);
    if (cashoutMatch && (request.method === "GET" || request.method === "PUT")) {
      const store = cashoutMatch[1];
      const date = cashoutMatch[2];
      const denied = await managerAuthError(request, env);
      if (denied) return denied;
      const noStore = { "Cache-Control": "no-store" };
      if (request.method === "GET" && !date) {
        const to = url.searchParams.get("to") ?? "";
        if (!WEEK_RE.test(to) || Number.isNaN(Date.parse(to))) return json({ error: "invalid_to" }, 400, request, env);
        const raws = await Promise.all(cashoutHistoryDates(to).map((d) => env.SCHEDULES.get(cashoutKey(store, d))));
        const days = raws.flatMap((raw) => {
          const doc2 = raw ? safeParse(raw) : null;
          return doc2 ? [{ date: doc2.date, totals: doc2.totals, updatedAt: doc2.updatedAt }] : [];
        });
        return json({ days }, 200, request, env, noStore);
      }
      if (!date || Number.isNaN(Date.parse(date))) return json({ error: "not_found" }, 404, request, env);
      if (request.method === "GET") {
        const raw = await env.SCHEDULES.get(cashoutKey(store, date));
        const doc2 = raw ? safeParse(raw) : null;
        if (!doc2) return json({ error: "not_found" }, 404, request, env);
        return json(doc2, 200, request, env, noStore);
      }
      if (!await checkWriteThrottle(env, clientIp(request))) {
        return json({ error: "rate_limited" }, 429, request, env, { "Retry-After": "3600" });
      }
      let body;
      try {
        body = await readBody(request);
      } catch {
        return json({ error: "body_too_large" }, 413, request, env);
      }
      const valid = validateCashoutBody(body);
      if (!valid) return json({ error: "invalid_body" }, 400, request, env);
      const doc = { v: 1, store, date, ...valid, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      await env.SCHEDULES.put(cashoutKey(store, date), JSON.stringify(doc), { expirationTtl: CASHOUT_TTL_SECONDS });
      return json({ updatedAt: doc.updatedAt }, 200, request, env);
    }
    const inventoryListMatch = path.match(/^\/api\/inventory\/(CR3)\/list$/);
    if (inventoryListMatch && (request.method === "GET" || request.method === "PUT")) {
      const store = inventoryListMatch[1];
      const denied = await managerAuthError(request, env);
      if (denied) return denied;
      const current = safeParse(await env.SCHEDULES.get(inventoryListKey(store)) ?? "");
      if (request.method === "GET") {
        const body2 = current ?? { v: 1, rev: 0, sheets: null, updatedAt: null };
        return json(body2, 200, request, env, { "Cache-Control": "no-store" });
      }
      if (!await checkWriteThrottle(env, clientIp(request))) {
        return json({ error: "rate_limited" }, 429, request, env, { "Retry-After": "3600" });
      }
      let body;
      try {
        body = await readBody(request, MAX_INVENTORY_LIST_CHARS);
      } catch {
        return json({ error: "body_too_large" }, 413, request, env);
      }
      const valid = validateInventoryListBody(body);
      if (!valid) return json({ error: "invalid_body" }, 400, request, env);
      const rev = current?.rev ?? 0;
      if (valid.baseRev !== rev) return json({ error: "conflict", rev, updatedAt: current?.updatedAt }, 409, request, env);
      const doc = { v: 1, rev: rev + 1, sheets: valid.sheets, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      await env.SCHEDULES.put(inventoryListKey(store), JSON.stringify(doc));
      return json({ rev: doc.rev, updatedAt: doc.updatedAt }, 200, request, env);
    }
    const inventoryMatch = path.match(/^\/api\/inventory\/(CR3)(?:\/(\d{4}-\d{2}-\d{2}))?$/);
    if (inventoryMatch && (request.method === "GET" && !inventoryMatch[2] || request.method === "PUT" && inventoryMatch[2])) {
      const store = inventoryMatch[1];
      const date = inventoryMatch[2];
      const denied = await managerAuthError(request, env);
      if (denied) return denied;
      if (request.method === "GET") {
        const to = url.searchParams.get("to") ?? "";
        if (!WEEK_RE.test(to) || Number.isNaN(Date.parse(to))) return json({ error: "invalid_to" }, 400, request, env);
        const dates = cashoutHistoryDates(to).slice(0, INVENTORY_HISTORY_DAYS);
        const raws = await Promise.all(dates.map((d) => env.SCHEDULES.get(inventoryKey(store, d))));
        const days = raws.flatMap((raw) => {
          const doc2 = raw ? safeParse(raw) : null;
          return doc2 ? [{ date: doc2.date, counts: doc2.counts, updatedAt: doc2.updatedAt }] : [];
        });
        return json({ days }, 200, request, env, { "Cache-Control": "no-store" });
      }
      if (Number.isNaN(Date.parse(date))) return json({ error: "not_found" }, 404, request, env);
      if (!await checkWriteThrottle(env, clientIp(request))) {
        return json({ error: "rate_limited" }, 429, request, env, { "Retry-After": "3600" });
      }
      let body;
      try {
        body = await readBody(request);
      } catch {
        return json({ error: "body_too_large" }, 413, request, env);
      }
      const valid = validateInventoryBody(body);
      if (!valid) return json({ error: "invalid_body" }, 400, request, env);
      const doc = { v: 1, store, date, ...valid, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      await env.SCHEDULES.put(inventoryKey(store, date), JSON.stringify(doc), { expirationTtl: INVENTORY_TTL_SECONDS });
      return json({ updatedAt: doc.updatedAt }, 200, request, env);
    }
    const formsMatch = path.match(/^\/api\/forms(?:\/([A-Za-z0-9_-]{10})(\/label)?)?$/);
    if (formsMatch) {
      const [, id, labelPath] = formsMatch;
      const route = !id ? `${request.method} list` : labelPath ? `${request.method} label` : `${request.method} one`;
      if (!["GET list", "POST list", "GET one", "PUT label", "DELETE one"].includes(route)) return json({ error: "not_found" }, 404, request, env);
      const denied = await managerAuthError(request, env);
      if (denied) return denied;
      const noStore = { "Cache-Control": "no-store" };
      if (route === "GET list") {
        const forms = [];
        let cursor;
        do {
          const page = await env.SCHEDULES.list({ prefix: "form:", cursor });
          for (const key3 of page.keys) {
            const meta = key3.metadata;
            if (meta && isDigitalFormType(meta.type)) forms.push({ ...meta, id: key3.name.slice("form:".length) });
          }
          cursor = page.list_complete ? void 0 : page.cursor;
        } while (cursor);
        forms.sort((a, b) => b.date.localeCompare(a.date) || a.employee.localeCompare(b.employee));
        return json({ forms }, 200, request, env, noStore);
      }
      const key2 = id ? `form:${id}` : "";
      const existing = id ? safeParse(await env.SCHEDULES.get(key2) ?? "") : null;
      if (id && !existing) return json({ error: "not_found" }, 404, request, env, noStore);
      if (route === "GET one") return json(existing, 200, request, env, noStore);
      if (!await checkWriteThrottle(env, clientIp(request))) return json({ error: "rate_limited" }, 429, request, env, { "Retry-After": "3600" });
      if (route === "DELETE one") {
        await env.SCHEDULES.delete(key2);
        return json({ deleted: true }, 200, request, env, noStore);
      }
      let body;
      try {
        body = await readBody(request);
      } catch {
        return json({ error: "body_too_large" }, 413, request, env);
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      let doc;
      if (route === "POST list") {
        const input = body;
        if (!input || !isDigitalFormType(input.type) || !isDigitalForm(input.form, input.type, true)) return json({ error: "invalid_body" }, 400, request, env);
        doc = { v: 1, id: newShareId(), type: input.type, form: input.form, label: "", createdAt: now, labelUpdatedAt: null };
      } else {
        const label2 = validateWriteUpLabel(body);
        if (label2 === null) return json({ error: "invalid_body" }, 400, request, env);
        doc = { ...existing, label: label2, labelUpdatedAt: now };
      }
      const metadata = { type: doc.type, date: doc.form.date, employee: digitalFormPerson(doc.type, doc.form), label: doc.label, store: doc.form.store };
      await env.SCHEDULES.put(`form:${doc.id}`, JSON.stringify(doc), { metadata });
      return json(doc, route === "POST list" ? 201 : 200, request, env, noStore);
    }
    const writeUpMatch = path.match(/^\/api\/writeups(?:\/([A-Za-z0-9_-]{10})(\/label)?)?$/);
    if (writeUpMatch) {
      const [, id, labelPath] = writeUpMatch;
      const route = !id ? `${request.method} list` : labelPath ? `${request.method} label` : `${request.method} one`;
      if (!["GET list", "POST list", "GET one", "PUT label", "DELETE one"].includes(route)) return json({ error: "not_found" }, 404, request, env);
      const denied = await managerAuthError(request, env);
      if (denied) return denied;
      const noStore = { "Cache-Control": "no-store" };
      if (route === "GET list") return json({ writeUps: await listWriteUps(env) }, 200, request, env, noStore);
      const existing = id ? safeParse(await env.SCHEDULES.get(writeUpKey(id)) ?? "") : null;
      if (route === "GET one") {
        return existing ? json(existing, 200, request, env, noStore) : json({ error: "not_found" }, 404, request, env);
      }
      if (!await checkWriteThrottle(env, clientIp(request))) {
        return json({ error: "rate_limited" }, 429, request, env, { "Retry-After": "3600" });
      }
      if (route === "DELETE one") {
        if (!existing) return json({ error: "not_found" }, 404, request, env, noStore);
        await env.SCHEDULES.delete(writeUpKey(id));
        return json({ deleted: true }, 200, request, env, noStore);
      }
      let body;
      try {
        body = await readBody(request);
      } catch {
        return json({ error: "body_too_large" }, 413, request, env);
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      if (route === "POST list") {
        const form = validateWriteUpForm(body);
        if (!form) return json({ error: "invalid_body" }, 400, request, env);
        const doc = { v: 1, id: newShareId(), form, label: "", createdAt: now, labelUpdatedAt: null };
        await putWriteUp(env, doc);
        return json({ id: doc.id, createdAt: doc.createdAt }, 201, request, env);
      }
      if (!existing) return json({ error: "not_found" }, 404, request, env);
      const label2 = validateWriteUpLabel(body);
      if (label2 === null) return json({ error: "invalid_body" }, 400, request, env);
      await putWriteUp(env, { ...existing, label: label2, labelUpdatedAt: now });
      return json({ label: label2, labelUpdatedAt: now }, 200, request, env);
    }
    if (request.method === "POST" && path === "/api/weeks") {
      if (!await checkWriteThrottle(env, clientIp(request))) {
        return json({ error: "rate_limited" }, 429, request, env, { "Retry-After": "3600" });
      }
      let body;
      try {
        body = await readBody(request);
      } catch {
        return json({ error: "body_too_large" }, 413, request, env);
      }
      const valid = validatePublishBody(body);
      if (!valid) return json({ error: "invalid_body" }, 400, request, env);
      const monthKey = monthKeyForWeekStart(valid.weekStart);
      const doc = {
        v: 2,
        id: newShareId(),
        rev: 1,
        ciphertext: valid.ciphertext,
        templateHash: valid.templateHash,
        weekStart: valid.weekStart,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        visible: valid.visible,
        monthKey
      };
      await env.SCHEDULES.put(`week:${doc.id}`, JSON.stringify(doc), { expirationTtl: DOC_TTL_SECONDS });
      await addToMonthIndex(env, monthKey, doc.id);
      return json({ id: doc.id, rev: doc.rev }, 201, request, env);
    }
    if (request.method === "GET" && path === "/api/weeks") {
      const month = url.searchParams.get("month") ?? "";
      if (!MONTH_RE.test(month)) return json({ error: "invalid_month" }, 400, request, env);
      const ids = await readMonthIndex(env, month);
      const weeks = [];
      for (const id of ids) {
        const raw = await env.SCHEDULES.get(`week:${id}`);
        if (!raw) continue;
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          continue;
        }
        const doc = normalizeStoredWeek(parsed);
        if (!doc || !doc.visible) continue;
        if (doc.monthKey !== month && monthKeyForWeekStart(doc.weekStart) !== month) continue;
        weeks.push({
          id: doc.id,
          weekStart: doc.weekStart,
          rev: doc.rev,
          updatedAt: doc.updatedAt,
          templateHash: doc.templateHash
        });
      }
      weeks.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
      return json({ weeks }, 200, request, env);
    }
    if (request.method === "GET" && path === "/api/schedule") {
      const restaurant = restaurantFromUrl(url);
      if (!restaurant) return json({ error: "invalid_restaurant" }, 400, request, env);
      const month = url.searchParams.get("month") ?? "";
      if (!MONTH_RE.test(month)) return json({ error: "invalid_month" }, 400, request, env);
      const knownRaw = url.searchParams.get("knownRev") ?? "";
      const knownRev = /^\d+$/.test(knownRaw) ? Number.parseInt(knownRaw, 10) : 0;
      const rev = await readGoldenMonthRev(env, month, restaurant);
      if (knownRev > 0 && rev > 0 && rev === knownRev) {
        return json({ weeks: [], rev, notModified: true }, 200, request, env, { "Cache-Control": "no-store" });
      }
      const weeks = [];
      for (const weekStart of goldenWeeksForMonth(month)) {
        const raw = await readGoldenDoc(env, restaurant, weekStart);
        if (!raw) continue;
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          continue;
        }
        const doc = normalizeGoldenDoc(parsed);
        if (!doc || !doc.visible) continue;
        weeks.push(doc);
      }
      weeks.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
      return json({ weeks, rev, notModified: false }, 200, request, env, { "Cache-Control": "no-store" });
    }
    const goldenMatch = path.match(/^\/api\/schedule\/(\d{4}-\d{2}-\d{2})$/);
    if (goldenMatch) {
      const weekStart = goldenMatch[1];
      const restaurant = restaurantFromUrl(url);
      if (!restaurant) return json({ error: "invalid_restaurant" }, 400, request, env);
      const key2 = goldenKey(weekStart, restaurant);
      if (request.method === "GET") {
        const raw = await readGoldenDoc(env, restaurant, weekStart);
        if (!raw) return json({ error: "not_found" }, 404, request, env);
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          return json({ error: "not_found" }, 404, request, env);
        }
        const doc = normalizeGoldenDoc(parsed);
        if (!doc) return json({ error: "not_found" }, 404, request, env);
        return new Response(JSON.stringify(doc), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders(request, env) }
        });
      }
      if (request.method === "PUT") {
        if (goldenWriteError(env)) return json({ error: "write_not_configured" }, 503, request, env);
        if (!isGoldenWriteAuthorized(request, env)) return json({ error: "unauthorized" }, 401, request, env);
        if (!await checkWriteThrottle(env, clientIp(request))) {
          return json({ error: "rate_limited" }, 429, request, env, { "Retry-After": "3600" });
        }
        let templateHash = null;
        let body;
        try {
          body = await readBody(request);
        } catch {
          return json({ error: "body_too_large" }, 413, request, env);
        }
        const rawBody = body && typeof body === "object" ? body : null;
        if (rawBody && typeof rawBody.templateHash === "string" && HASH_RE.test(rawBody.templateHash)) {
          templateHash = rawBody.templateHash;
        }
        const valid = validateGoldenWeekBody(body);
        if (!valid || !templateHash || valid.week.weekStart !== weekStart) {
          return json({ error: "invalid_body" }, 400, request, env);
        }
        const existing = await readGoldenDoc(env, restaurant, weekStart);
        if (!existing) {
          if (valid.baseRev !== 0) return json({ error: "conflict", rev: 0 }, 409, request, env);
          const next2 = {
            v: 3,
            weekStart,
            rev: 1,
            week: valid.week,
            visible: valid.visible,
            templateHash,
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          };
          await env.SCHEDULES.put(key2, JSON.stringify(next2), { expirationTtl: DOC_TTL_SECONDS });
          await bumpGoldenMonthRevs(env, weekStart, restaurant);
          return json({ rev: next2.rev, updatedAt: next2.updatedAt }, 201, request, env);
        }
        let parsed;
        try {
          parsed = JSON.parse(existing);
        } catch {
          return json({ error: "not_found" }, 404, request, env);
        }
        const current = normalizeGoldenDoc(parsed);
        if (!current) return json({ error: "not_found" }, 404, request, env);
        if (valid.baseRev !== current.rev) {
          return json({ error: "conflict", rev: current.rev, updatedAt: current.updatedAt }, 409, request, env);
        }
        const next = {
          ...current,
          week: valid.week,
          visible: valid.visible,
          templateHash,
          rev: current.rev + 1,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        await env.SCHEDULES.put(key2, JSON.stringify(next), { expirationTtl: DOC_TTL_SECONDS });
        await bumpGoldenMonthRevs(env, weekStart, restaurant);
        return json({ rev: next.rev, updatedAt: next.updatedAt }, 200, request, env);
      }
    }
    if (path === "/api/employees") {
      const restaurant = restaurantFromUrl(url);
      if (!restaurant) return json({ error: "invalid_restaurant" }, 400, request, env);
      const weekParam = parseWeekStartParam(url);
      if (weekParam.present && !weekParam.valid) return json({ error: "invalid_weekStart" }, 400, request, env);
      const weekStart = weekParam.present && weekParam.valid ? weekParam.value : void 0;
      if (request.method === "GET") {
        const denied = await managerAuthError(request, env);
        if (denied) return denied;
        if (weekStart) {
          const weekRaw = await env.SCHEDULES.get(rosterKeyForWeek(restaurant, weekStart));
          const weekDoc = weekRaw ? normalizeRosterDoc(safeParse(weekRaw)) : null;
          if (weekDoc) {
            return json(
              { employees: weekDoc.employees, rev: weekDoc.rev, updatedAt: weekDoc.updatedAt, weekStart, inherited: false },
              200,
              request,
              env,
              { "Cache-Control": "no-store" }
            );
          }
          const globalRaw = await readRosterRaw(env, restaurant);
          const globalDoc = globalRaw ? normalizeRosterDoc(safeParse(globalRaw)) : null;
          return json(
            {
              employees: globalDoc?.employees ?? [],
              rev: 0,
              updatedAt: null,
              weekStart,
              inherited: true,
              fallbackRev: globalDoc?.rev ?? 0
            },
            200,
            request,
            env,
            { "Cache-Control": "no-store" }
          );
        }
        const raw = await readRosterRaw(env, restaurant);
        const doc = raw ? normalizeRosterDoc(safeParse(raw)) : null;
        return json(
          { employees: doc?.employees ?? [], rev: doc?.rev ?? 0, updatedAt: doc?.updatedAt ?? null },
          200,
          request,
          env,
          { "Cache-Control": "no-store" }
        );
      }
      if (request.method === "PUT") {
        if (goldenWriteError(env)) return json({ error: "write_not_configured" }, 503, request, env);
        if (!isGoldenWriteAuthorized(request, env)) return json({ error: "unauthorized" }, 401, request, env);
        if (isScheduleOnlyRestaurant(restaurant)) return json({ error: "station_locked" }, 403, request, env);
        if (!await checkWriteThrottle(env, clientIp(request))) {
          return json({ error: "rate_limited" }, 429, request, env, { "Retry-After": "3600" });
        }
        let body;
        try {
          body = await readBody(request);
        } catch {
          return json({ error: "body_too_large" }, 413, request, env);
        }
        const valid = validateRosterBody(body);
        if (!valid) return json({ error: "invalid_body" }, 400, request, env);
        const targetKey = weekStart ? rosterKeyForWeek(restaurant, weekStart) : rosterKey(restaurant);
        const existingRaw = weekStart ? await env.SCHEDULES.get(targetKey) : await readRosterRaw(env, restaurant);
        let currentRev = 0;
        let currentUpdatedAt;
        if (existingRaw) {
          const current = normalizeRosterDoc(safeParse(existingRaw));
          currentRev = current?.rev ?? 0;
          currentUpdatedAt = current?.updatedAt;
        }
        if (valid.baseRev !== currentRev) {
          return json({ error: "conflict", rev: currentRev, updatedAt: currentUpdatedAt }, 409, request, env);
        }
        const next = {
          v: 1,
          rev: currentRev + 1,
          employees: valid.employees,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        await env.SCHEDULES.put(targetKey, JSON.stringify(next), { expirationTtl: DOC_TTL_SECONDS });
        return json({ rev: next.rev, updatedAt: next.updatedAt }, currentRev === 0 ? 201 : 200, request, env);
      }
    }
    if (path === "/api/staff" || path === "/api/staff/undo" || path === "/api/staff/verify") {
      const restaurant = restaurantFromUrl(url);
      if (!restaurant) return json({ error: "invalid_restaurant" }, 400, request, env);
      if (!isStaffEditableRestaurant(restaurant)) return json({ error: "staff_editing_not_enabled" }, 403, request, env);
      if (request.method === "GET" && path === "/api/staff") {
        const denied = await managerAuthError(request, env);
        if (denied) return denied;
        return json(staffResponse(await readStaffDoc(env, restaurant)), 200, request, env, { "Cache-Control": "no-store" });
      }
      if (request.method === "GET" && path === "/api/staff/verify") {
        if (!await checkVerifyThrottle(env, clientIp(request))) {
          return json({ error: "rate_limited" }, 429, request, env, { "Retry-After": "3600" });
        }
        if (!isStaffEditAuthorized(request, env)) return json({ error: "unauthorized" }, 401, request, env);
        return json({ ok: true }, 200, request, env);
      }
      const isSave = request.method === "PUT" && path === "/api/staff";
      const isUndo = request.method === "POST" && path === "/api/staff/undo";
      if (isSave || isUndo) {
        if (!isStaffEditAuthorized(request, env)) return json({ error: "unauthorized" }, 401, request, env);
        if (!await checkWriteThrottle(env, clientIp(request))) {
          return json({ error: "rate_limited" }, 429, request, env, { "Retry-After": "3600" });
        }
        let body;
        try {
          body = await readBody(request);
        } catch {
          return json({ error: "body_too_large" }, 413, request, env);
        }
        const current = await readStaffDoc(env, restaurant);
        const currentRev = current?.rev ?? 0;
        const updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        let next;
        if (isSave) {
          const valid = validateRosterBody(body);
          if (!valid) return json({ error: "invalid_body" }, 400, request, env);
          if (valid.baseRev !== currentRev) {
            return json({ error: "conflict", rev: currentRev, updatedAt: current?.updatedAt }, 409, request, env);
          }
          const replaced = { employees: current?.employees ?? null, updatedAt: current?.updatedAt ?? null };
          next = {
            v: 1,
            rev: currentRev + 1,
            employees: valid.employees,
            updatedAt,
            history: [replaced, ...current?.history ?? []].slice(0, STAFF_HISTORY_LIMIT)
          };
        } else {
          const valid = validateStaffUndoBody(body);
          if (!valid) return json({ error: "invalid_body" }, 400, request, env);
          if (valid.baseRev !== currentRev) {
            return json({ error: "conflict", rev: currentRev, updatedAt: current?.updatedAt }, 409, request, env);
          }
          const [previous, ...older] = current?.history ?? [];
          if (!current || !previous) return json({ error: "nothing_to_undo", rev: currentRev }, 409, request, env);
          next = { v: 1, rev: currentRev + 1, employees: previous.employees, updatedAt, history: older };
        }
        await env.SCHEDULES.put(staffKey(restaurant), JSON.stringify(next), { expirationTtl: DOC_TTL_SECONDS });
        return json(staffResponse(next), currentRev === 0 ? 201 : 200, request, env);
      }
    }
    if (path === "/api/template") {
      const restaurant = restaurantFromUrl(url);
      if (!restaurant) return json({ error: "invalid_restaurant" }, 400, request, env);
      const weekParam = parseWeekStartParam(url);
      if (weekParam.present && !weekParam.valid) return json({ error: "invalid_weekStart" }, 400, request, env);
      const weekStart = weekParam.present && weekParam.valid ? weekParam.value : void 0;
      if (request.method === "GET") {
        if (weekStart) {
          const weekRaw = await env.SCHEDULES.get(templateKeyForWeek(restaurant, weekStart));
          const weekDoc = weekRaw ? normalizeTemplateDoc(safeParse(weekRaw)) : null;
          if (weekDoc) {
            return json(
              { template: weekDoc.template, rev: weekDoc.rev, updatedAt: weekDoc.updatedAt, weekStart, inherited: false },
              200,
              request,
              env,
              { "Cache-Control": "no-store" }
            );
          }
          const globalRaw = await readTemplateRaw(env, restaurant);
          const globalDoc = globalRaw ? normalizeTemplateDoc(safeParse(globalRaw)) : null;
          return json(
            {
              template: globalDoc?.template ?? null,
              rev: 0,
              updatedAt: null,
              weekStart,
              inherited: true,
              fallbackRev: globalDoc?.rev ?? 0
            },
            200,
            request,
            env,
            { "Cache-Control": "no-store" }
          );
        }
        const raw = await readTemplateRaw(env, restaurant);
        const doc = raw ? normalizeTemplateDoc(safeParse(raw)) : null;
        return json(
          { template: doc?.template ?? null, rev: doc?.rev ?? 0, updatedAt: doc?.updatedAt ?? null },
          200,
          request,
          env,
          { "Cache-Control": "no-store" }
        );
      }
      if (request.method === "PUT") {
        if (isScheduleOnlyRestaurant(restaurant)) {
          if (!weekStart) return json({ error: "station_locked" }, 403, request, env);
          if (!isStaffEditAuthorized(request, env)) return json({ error: "unauthorized" }, 401, request, env);
        } else {
          if (goldenWriteError(env)) return json({ error: "write_not_configured" }, 503, request, env);
          if (!isGoldenWriteAuthorized(request, env)) return json({ error: "unauthorized" }, 401, request, env);
        }
        if (!await checkWriteThrottle(env, clientIp(request))) {
          return json({ error: "rate_limited" }, 429, request, env, { "Retry-After": "3600" });
        }
        let body;
        try {
          body = await readBody(request);
        } catch {
          return json({ error: "body_too_large" }, 413, request, env);
        }
        const valid = validateTemplateBody(body);
        if (!valid) return json({ error: "invalid_body" }, 400, request, env);
        const targetKey = weekStart ? templateKeyForWeek(restaurant, weekStart) : templateKey(restaurant);
        const existingRaw = weekStart ? await env.SCHEDULES.get(targetKey) : await readTemplateRaw(env, restaurant);
        let currentRev = 0;
        let currentUpdatedAt;
        if (existingRaw) {
          const current = normalizeTemplateDoc(safeParse(existingRaw));
          currentRev = current?.rev ?? 0;
          currentUpdatedAt = current?.updatedAt;
        }
        if (valid.baseRev !== currentRev) {
          return json({ error: "conflict", rev: currentRev, updatedAt: currentUpdatedAt }, 409, request, env);
        }
        const next = {
          v: 1,
          rev: currentRev + 1,
          template: valid.template,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        await env.SCHEDULES.put(targetKey, JSON.stringify(next), { expirationTtl: DOC_TTL_SECONDS });
        return json({ rev: next.rev, updatedAt: next.updatedAt }, currentRev === 0 ? 201 : 200, request, env);
      }
    }
    const weekMatch = path.match(/^\/api\/weeks\/([A-Za-z0-9_-]+)$/);
    if (weekMatch) {
      const id = weekMatch[1];
      if (!isValidId(id)) return json({ error: "not_found" }, 404, request, env);
      const key2 = `week:${id}`;
      if (request.method === "GET") {
        const raw = await env.SCHEDULES.get(key2);
        if (!raw) return json({ error: "not_found" }, 404, request, env);
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          return json({ error: "not_found" }, 404, request, env);
        }
        const doc = normalizeStoredWeek(parsed);
        if (!doc) return json({ error: "not_found" }, 404, request, env);
        await addToMonthIndex(env, doc.monthKey, doc.id);
        return new Response(JSON.stringify(doc), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders(request, env) }
        });
      }
      if (request.method === "PUT") {
        if (!await checkWriteThrottle(env, clientIp(request))) {
          return json({ error: "rate_limited" }, 429, request, env, { "Retry-After": "3600" });
        }
        let body;
        try {
          body = await readBody(request);
        } catch {
          return json({ error: "body_too_large" }, 413, request, env);
        }
        const valid = validateUpdateBody(body);
        if (!valid) return json({ error: "invalid_body" }, 400, request, env);
        const raw = await env.SCHEDULES.get(key2);
        if (!raw) return json({ error: "not_found" }, 404, request, env);
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          return json({ error: "not_found" }, 404, request, env);
        }
        const current = normalizeStoredWeek(parsed);
        if (!current) return json({ error: "not_found" }, 404, request, env);
        if (valid.baseRev !== current.rev) {
          return json({ error: "conflict", rev: current.rev, updatedAt: current.updatedAt }, 409, request, env);
        }
        const next = {
          ...current,
          v: 2,
          ciphertext: valid.ciphertext ?? current.ciphertext,
          visible: valid.visible ?? current.visible,
          rev: current.rev + 1,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        await env.SCHEDULES.put(key2, JSON.stringify(next), { expirationTtl: DOC_TTL_SECONDS });
        await addToMonthIndex(env, next.monthKey, next.id);
        return json({ rev: next.rev, updatedAt: next.updatedAt }, 200, request, env);
      }
    }
    return json({ error: "not_found" }, 404, request, env);
  }
};
export {
  index_default as default
};
