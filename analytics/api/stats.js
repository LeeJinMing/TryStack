import { kv } from "@vercel/kv";

const EVENT_KEYS = [
  "page_view",
  "copy_command",
  "download_script",
  "open_one_click_up",
  "open_one_click_doctor",
  "view_readme",
  "repo_lookup_found",
  "repo_lookup_not_found",
  "repo_lookup_invalid_input",
];

function getAllowedOrigins() {
  const raw = String(process.env.ALLOWED_ORIGINS || "").trim();
  // If not set, default to Portal + local dev.
  if (!raw) return ["https://leejinming.github.io", "http://localhost:4173"];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function setCors(res, origin) {
  res.setHeader("Access-Control-Allow-Origin", origin || "null");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "600");
}

function isAllowedOrigin(origin, allowlist) {
  if (!origin) return false;
  return allowlist.includes(origin);
}

function getAdminToken() {
  return String(process.env.ADMIN_TOKEN || "").trim();
}

function getProvidedToken(req, url) {
  const q = String(url.searchParams.get("token") || "").trim();
  if (q) return q;
  const h = req.headers["x-admin-token"];
  return Array.isArray(h) ? String(h[0] || "").trim() : String(h || "").trim();
}

function isAuthorized(req, url) {
  const token = getAdminToken();
  // If token is set, require it. If not set, leave stats open (not recommended for production).
  if (!token) return true;
  const provided = getProvidedToken(req, url);
  return Boolean(provided) && provided === token;
}

function clampDays(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 7;
  return Math.max(1, Math.min(30, Math.floor(n)));
}

function dayKeyOffset(daysAgo) {
  const d = new Date(Date.now() - Number(daysAgo) * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function sumMapToArray(map) {
  return Array.from(map.entries())
    .map(([repo, count]) => ({ repo, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

async function zrangeWithScores(key, limit) {
  // @vercel/kv returns alternating [member, score, member, score, ...] when withScores=true
  const raw = await kv.zrange(key, 0, limit - 1, { rev: true, withScores: true });
  const out = [];
  for (let i = 0; i < raw.length; i += 2) {
    out.push({ member: String(raw[i]), score: Number(raw[i + 1]) });
  }
  return out;
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

  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }

  const url = new URL(req.url, "http://localhost");
  if (!isAuthorized(req, url)) {
    res.statusCode = 401;
    res.end("Unauthorized");
    return;
  }

  // NOTE:
  // Some browsers may omit the Origin header for same-origin GET requests (e.g. calling /api/stats from /admin
  // on the same domain). In that case, token auth is the primary protection.
  // If Origin is present, still enforce allowlist to prevent cross-site reads.
  if (origin && !isAllowedOrigin(origin, allowlist)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }
  const days = clampDays(url.searchParams.get("days") || "7");

  const daysList = [];
  for (let i = days - 1; i >= 0; i--) daysList.push(dayKeyOffset(i));

  // Fetch counters
  const dayRows = [];
  const totals = Object.fromEntries(EVENT_KEYS.map((k) => [k, 0]));

  for (const day of daysList) {
    const keys = EVENT_KEYS.map((k) => `d:${day}:e:${k}`);
    const vals = await kv.mget(...keys);
    const events = {};
    for (let i = 0; i < EVENT_KEYS.length; i++) {
      const k = EVENT_KEYS[i];
      const v = Number(vals?.[i] || 0);
      events[k] = v;
      totals[k] += v;
    }
    dayRows.push({ day, events });
  }

  // Aggregate top repos across range
  const repoAgg = new Map();
  const notFoundAgg = new Map();

  for (const day of daysList) {
    try {
      const top = await zrangeWithScores(`z:${day}:top_repo`, 50);
      for (const it of top) {
        repoAgg.set(it.member, (repoAgg.get(it.member) || 0) + it.score);
      }
    } catch {
      // ignore
    }
    try {
      const topNF = await zrangeWithScores(`z:${day}:repo_not_found`, 50);
      for (const it of topNF) {
        notFoundAgg.set(it.member, (notFoundAgg.get(it.member) || 0) + it.score);
      }
    } catch {
      // ignore
    }
  }

  const payload = {
    rangeDays: days,
    days: dayRows,
    totals,
    topRepos: sumMapToArray(repoAgg),
    topNotFound: sumMapToArray(notFoundAgg),
  };

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.statusCode = 200;
  res.end(JSON.stringify(payload));
}

