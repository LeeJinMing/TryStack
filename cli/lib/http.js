const http = require("node:http");
const https = require("node:https");
const zlib = require("node:zlib");

function isRedirectStatus(status) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function httpGet(url, extraHeaders = null) {
  const doRequest = (u, overrideHostname) =>
    new Promise((resolve) => {
      const hostname = overrideHostname || u.hostname;
      const lib = u.protocol === "https:" ? https : http;
      const req = lib.request(
        {
          protocol: u.protocol,
          hostname,
          port: u.port,
          path: u.pathname + u.search,
          method: "GET",
          timeout: 5000,
          family: hostname === "localhost" ? 4 : undefined,
          headers: {
            "User-Agent": "trystack",
            "Accept-Encoding": "identity",
            ...(extraHeaders && typeof extraHeaders === "object" ? extraHeaders : {}),
          },
        },
        (res) => {
          const chunks = [];
          let total = 0;
          const location = (res.headers.location || "").toString();

          res.on("data", (chunk) => {
            const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            chunks.push(b);
            total += b.length;
            if (total > 1024 * 1024) {
              res.destroy();
            }
          });

          res.on("end", () => {
            const status = res.statusCode || 0;
            const encoding = (res.headers["content-encoding"] || "").toString().toLowerCase();
            const buf = Buffer.concat(chunks);

            try {
              let decoded = buf;
              if (encoding === "gzip") decoded = zlib.gunzipSync(buf);
              else if (encoding === "deflate") decoded = zlib.inflateSync(buf);
              else if (encoding === "br") decoded = zlib.brotliDecompressSync(buf);

              const body = decoded.toString("utf8");
              resolve({ status, body, location, headers: res.headers });
            } catch {
              resolve({ status, body: buf.toString("utf8"), location, headers: res.headers });
            }
          });
        },
      );
      req.on("timeout", () => {
        req.destroy();
        resolve({ status: 0, body: "" });
      });
      req.on("error", () => resolve({ status: 0, body: "" }));
      req.end();
    });

  const u = new URL(url);
  const getOnce = async () => {
    const res = await doRequest(u);
    if (res.status !== 0) return res;
    if (u.hostname === "localhost") return doRequest(u, "127.0.0.1");
    return res;
  };

  const getWithRedirects = async (maxRedirects = 5) => {
    let currentUrl = u.toString();
    for (let i = 0; i <= maxRedirects; i += 1) {
      const cur = new URL(currentUrl);
      const r = await doRequest(cur);
      if (r.status === 0 && cur.hostname === "localhost") {
        const r2 = await doRequest(cur, "127.0.0.1");
        if (!isRedirectStatus(r2.status)) return r2;
        if (!r2.location) return r2;
        currentUrl = new URL(r2.location, cur).toString();
        continue;
      }

      if (!isRedirectStatus(r.status)) return r;
      if (!r.location) return r;
      currentUrl = new URL(r.location, cur).toString();
    }
    return getOnce();
  };

  return getWithRedirects();
}

async function waitForUi(recipe) {
  const uiUrl = recipe?.ui?.url;
  if (!uiUrl) return { ok: true, url: null };

  const pathPart = recipe?.ui?.healthcheck?.path || "/";
  const expectStatus = Number(recipe?.ui?.healthcheck?.expectStatus ?? 200);
  const match = (recipe?.ui?.healthcheck?.match || "").toString();

  const checkUrl = new URL(uiUrl);
  const basePath = checkUrl.pathname.endsWith("/") ? checkUrl.pathname.slice(0, -1) : checkUrl.pathname;
  const hcPath = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  checkUrl.pathname = `${basePath}${hcPath}` || "/";

  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    const { status, body } = await httpGet(checkUrl.toString());
    if (status === expectStatus) {
      if (!match || body.toLowerCase().includes(match.toLowerCase())) {
        return { ok: true, url: uiUrl };
      }
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  return { ok: false, url: uiUrl, checkUrl: checkUrl.toString(), expectStatus, match };
}

module.exports = {
  isRedirectStatus,
  httpGet,
  waitForUi,
};
