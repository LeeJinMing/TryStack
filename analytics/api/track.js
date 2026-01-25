import { kv } from "@vercel/kv";

const DEFAULT_ALLOWED_ORIGINS = ["https://leejinming.github.io", "http://localhost:4173"];

function getAllowedOrigins() {
  const raw = String(process.env.ALLOWED_ORIGINS || "").trim();
  if (!raw) return DEFAULT_ALLOWED_ORIGINS;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  const ip = Array.isArray(xf) ? xf[0] : String(xf || "");
  return (ip.split(",")[0] || "").trim() || req.socket?.remoteAddress || "unknown";
}

function dayKey(tsMs) {
  const d = new Date(Number(tsMs) || Date.now());
  return d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

function setCors(res, origin) {
  res.setHeader("Access-Control-Allow-Origin", origin || "null");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "600");
}

function isAllowedOrigin(origin, allowlist) {
  if (!origin) return false;
  return allowlist.includes(origin);
}

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === "string" ? Buffer.from(c) : c);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const EVENT_WHITELIST = new Set([
  "page_view",
  "copy_command",
  "download_script",
  "open_one_click",
  "view_readme",
  "repo_lookup",
]);

function pickProps(input) {
  const p = input && typeof input === "object" ? input : {};
  const out = {};

  // keep only small, useful fields
  if (typeof p.source === "string") out.source = p.source.slice(0, 60);
  if (typeof p.repo === "string") out.repo = p.repo.slice(0, 120);
  if (typeof p.recipeId === "string") out.recipeId = p.recipeId.slice(0, 60);
  if (typeof p.action === "string") out.action = p.action.slice(0, 30);
  if (typeof p.result === "string") out.result = p.result.slice(0, 30);
  if (typeof p.recipes === "number" && Number.isFinite(p.recipes)) out.recipes = Number(p.recipes);

  // common web context (optional)
  if (typeof p.path === "string") out.path = p.path.slice(0, 200);
  if (typeof p.href === "string") out.href = p.href.slice(0, 500);
  if (typeof p.referrer === "string") out.referrer = p.referrer.slice(0, 500);

  return out;
}

function mapCounters({ name, props }) {
  // Expand some events into more specific counters.
  if (name === "open_one_click") {
    const a = String(props.action || "").toLowerCase();
    if (a === "doctor") return ["open_one_click_doctor"];
    if (a === "up") return ["open_one_click_up"];
    return ["open_one_click"];
  }
  if (name === "repo_lookup") {
    const r = String(props.result || "").toLowerCase();
    if (r === "found") return ["repo_lookup_found"];
    if (r === "not_found") return ["repo_lookup_not_found"];
    if (r === "invalid_input") return ["repo_lookup_invalid_input"];
    return ["repo_lookup"];
  }
  return [name];
}

async function rateLimit({ ip }) {
  const limit = Number(process.env.RATE_LIMIT_PER_MIN || 120);
  if (!Number.isFinite(limit) || limit <= 0) return { ok: true };

  const now = new Date();
  const bucket = now.toISOString().slice(0, 16).replace(/[-:T]/g, ""); // YYYYMMDDHHmm
  const key = `rl:${ip}:${bucket}`;
  const n = await kv.incr(key);
  if (n === 1) {
    // 90s is enough to cover minute boundary without a second key
    await kv.expire(key, 90);
  }
  return n > limit ? { ok: false } : { ok: true };
}

export default async function handler(req, res) {
  const allowlist = getAllowedOrigins();
  const origin = String(req.headers.origin || "");

  setCors(res, origin);

  if (req.method === "OPTIONS") {
    if (!isAllowedOrigin(origin, allowlist)) {
      res.statusCode = 403;
      res.end("Forbidden");
      return;
    }
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }

  if (!isAllowedOrigin(origin, allowlist)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }

  const ip = getClientIp(req);
  const rl = await rateLimit({ ip });
  if (!rl.ok) {
    res.statusCode = 429;
    res.end("Too Many Requests");
    return;
  }

  const body = await readJson(req);
  const name = String(body?.name || "").trim();
  if (!EVENT_WHITELIST.has(name)) {
    res.statusCode = 400;
    res.end("Bad Request");
    return;
  }

  const ts = Number(body?.ts) || Date.now();
  const day = dayKey(ts);
  const props = pickProps(body?.props);
  const counters = mapCounters({ name, props });

  const ops = [];
  for (const c of counters) {
    ops.push(kv.incr(`d:${day}:e:${c}`));
  }

  // Interest ranking for repos (best-effort).
  const repo = typeof props.repo === "string" ? props.repo : "";
  if (repo) {
    const interestEvents = new Set(["copy_command", "download_script", "open_one_click_up", "view_readme"]);
    for (const c of counters) {
      if (interestEvents.has(c)) {
        ops.push(kv.zincrby(`z:${day}:top_repo`, 1, repo));
        break;
      }
    }
  }

  // Track missing recipes.
  if (name === "repo_lookup" && String(props.result || "").toLowerCase() === "not_found" && repo) {
    ops.push(kv.zincrby(`z:${day}:repo_not_found`, 1, repo));
  }

  try {
    await Promise.all(ops);
  } catch {
    // ignore storage failures
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true }));
}

