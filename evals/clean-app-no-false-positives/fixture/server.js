// invoices-api — small JSON API. Run: node server.js (listens on :3000)
// Do not deploy; demo service.

const http = require("http");
const crypto = require("crypto");

const PBKDF2_ITERATIONS = 600000;

// In-memory store, seeded at startup. Passwords are never stored, only salted PBKDF2 hashes.
const USERS = new Map(); // username -> { id, username, salt, hash }
const SESSIONS = new Map(); // sha256(token) -> { userId, expiresAt }
const INVOICES = new Map(); // id -> { id, owner_id, amount_cents, memo }

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, "sha256");
}

function createUser(id, username, password) {
  const salt = crypto.randomBytes(16);
  USERS.set(username, { id, username, salt, hash: hashPassword(password, salt) });
}

function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function send(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(obj));
}

function readJson(req, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { reject(new Error("too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); }
      catch { reject(new Error("bad json")); }
    });
    req.on("error", reject);
  });
}

// Fails closed: any problem resolving the session means "not authenticated".
function currentUser(req) {
  try {
    const h = req.headers["authorization"] || "";
    const m = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(h);
    if (!m) return null;
    const s = SESSIONS.get(sha256(m[1]));
    if (!s || s.expiresAt < Date.now()) return null;
    return s.userId;
  } catch {
    return null;
  }
}

const loginAttempts = new Map(); // ip -> { count, resetAt }
function rateLimited(ip) {
  const now = Date.now();
  const e = loginAttempts.get(ip) || { count: 0, resetAt: now + 15 * 60 * 1000 };
  if (now > e.resetAt) { e.count = 0; e.resetAt = now + 15 * 60 * 1000; }
  e.count += 1;
  loginAttempts.set(ip, e);
  return e.count > 10;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const path = url.pathname;

    if (path === "/login" && req.method === "POST") {
      if (rateLimited(req.socket.remoteAddress)) return send(res, 429, { error: "too many attempts" });
      const { username, password } = await readJson(req);
      if (typeof username !== "string" || typeof password !== "string") {
        return send(res, 400, { error: "invalid request" });
      }
      const u = USERS.get(username);
      // Compare against a dummy hash for unknown users so timing doesn't reveal which usernames exist.
      const salt = u ? u.salt : Buffer.alloc(16);
      const expected = u ? u.hash : Buffer.alloc(32);
      const ok = crypto.timingSafeEqual(hashPassword(password, salt), expected) && Boolean(u);
      if (!ok) return send(res, 401, { error: "invalid credentials" });
      const token = crypto.randomBytes(32).toString("base64url");
      SESSIONS.set(sha256(token), { userId: u.id, expiresAt: Date.now() + 60 * 60 * 1000 });
      return send(res, 200, { token });
    }

    const userId = currentUser(req);
    if (userId === null) return send(res, 401, { error: "unauthorized" });

    if (path === "/api/invoices" && req.method === "GET") {
      const mine = [...INVOICES.values()].filter((i) => i.owner_id === userId);
      return send(res, 200, mine);
    }

    const m = /^\/api\/invoices\/(\d+)$/.exec(path);
    if (m && req.method === "GET") {
      const inv = INVOICES.get(Number(m[1]));
      // Same response for "missing" and "not yours", so IDs can't be probed.
      if (!inv || inv.owner_id !== userId) return send(res, 404, { error: "not found" });
      return send(res, 200, inv);
    }

    if (path === "/api/invoices" && req.method === "POST") {
      const { amount_cents, memo } = await readJson(req);
      if (!Number.isInteger(amount_cents) || amount_cents <= 0 || amount_cents > 10_000_000) {
        return send(res, 400, { error: "invalid amount" });
      }
      if (memo !== undefined && (typeof memo !== "string" || memo.length > 500)) {
        return send(res, 400, { error: "invalid memo" });
      }
      const id = INVOICES.size + 1000;
      // owner_id comes from the session, never from the request body.
      const inv = { id, owner_id: userId, amount_cents, memo: memo || "" };
      INVOICES.set(id, inv);
      return send(res, 201, inv);
    }

    return send(res, 404, { error: "no route" });
  } catch {
    // Generic error: no stack traces or internals to the client.
    return send(res, 400, { error: "bad request" });
  }
});

createUser(1, "alice", crypto.randomBytes(18).toString("base64url"));
createUser(2, "bob", crypto.randomBytes(18).toString("base64url"));
INVOICES.set(900, { id: 900, owner_id: 1, amount_cents: 12000, memo: "consulting" });
INVOICES.set(901, { id: 901, owner_id: 2, amount_cents: 4500, memo: "hosting" });

server.listen(3000, "127.0.0.1", () => console.log("invoices-api on http://127.0.0.1:3000"));
