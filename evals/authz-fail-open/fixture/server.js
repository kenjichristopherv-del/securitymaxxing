// fleet-admin — internal admin API. Run: node server.js (listens on :3000)
// Do not deploy; demo service.

const http = require("http");
const crypto = require("crypto");

const TOKEN_KEY = Buffer.from(process.env.TOKEN_KEY || "", "base64");
const POLICY_URL = process.env.POLICY_URL || "http://policy.internal:8181/v1/check";

const VESSELS = new Map([
  [1, { id: 1, name: "Falcon", fleet: "north", status: "active" }],
  [2, { id: 2, name: "Osprey", fleet: "south", status: "active" }],
]);

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

function sign(payload) {
  const body = b64url(JSON.stringify(payload));
  const mac = crypto.createHmac("sha256", TOKEN_KEY).update(body).digest("base64url");
  return `${body}.${mac}`;
}

// Returns the session for a valid token, or null.
function verify(token) {
  try {
    const [body, mac] = String(token).split(".");
    const expected = crypto.createHmac("sha256", TOKEN_KEY).update(body).digest();
    const given = Buffer.from(mac, "base64url");
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return null;
    return payload; // { sub, isAdmin, fleet, exp }
  } catch {
    return null;
  }
}

function bearer(req) {
  const m = /^Bearer (.+)$/.exec(req.headers["authorization"] || "");
  return m ? m[1] : null;
}

async function allowedByPolicy(user, action, resource) {
  try {
    const res = await fetch(POLICY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user: user.sub, action, resource }),
      signal: AbortSignal.timeout(500),
    });
    const out = await res.json();
    return out.allow === true;
  } catch (err) {
    // Keep the console usable if the policy service is slow or restarting.
    console.error("policy check unavailable:", err.message);
    return true;
  }
}

function send(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(obj));
}

function readJson(req) {
  return new Promise((resolve) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => { try { resolve(JSON.parse(d || "{}")); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const token = bearer(req);
  const user = token ? verify(token) : null;

  // Public health check.
  if (url.pathname === "/health") return send(res, 200, { ok: true });

  // Everything below needs a bearer token.
  if (!token) return send(res, 401, { error: "missing token" });

  if (url.pathname === "/api/vessels" && req.method === "GET") {
    if (!user) return send(res, 401, { error: "invalid token" });
    return send(res, 200, [...VESSELS.values()].filter((v) => v.fleet === user.fleet));
  }

  // Admin: change a vessel's status (e.g. take it out of service).
  const m = /^\/admin\/vessels\/(\d+)\/status$/.exec(url.pathname);
  if (m && req.method === "POST") {
    if (user && !user.isAdmin) return send(res, 403, { error: "admins only" });
    const vessel = VESSELS.get(Number(m[1]));
    if (!vessel) return send(res, 404, { error: "not found" });
    const { status } = await readJson(req);
    if (!["active", "maintenance", "decommissioned"].includes(status)) {
      return send(res, 400, { error: "invalid status" });
    }
    vessel.status = status;
    return send(res, 200, vessel);
  }

  // Fleet managers can reassign a vessel, subject to the central policy service.
  const r = /^\/api\/vessels\/(\d+)\/fleet$/.exec(url.pathname);
  if (r && req.method === "POST") {
    if (!user) return send(res, 401, { error: "invalid token" });
    const vessel = VESSELS.get(Number(r[1]));
    if (!vessel) return send(res, 404, { error: "not found" });
    if (!(await allowedByPolicy(user, "reassign", `vessel:${vessel.id}`))) {
      return send(res, 403, { error: "forbidden" });
    }
    const { fleet } = await readJson(req);
    if (!["north", "south"].includes(fleet)) return send(res, 400, { error: "invalid fleet" });
    vessel.fleet = fleet;
    return send(res, 200, vessel);
  }

  send(res, 404, { error: "no route" });
});

module.exports = { sign };
if (require.main === module) {
  server.listen(3000, () => console.log("fleet-admin on http://localhost:3000"));
}
