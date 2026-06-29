const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULT_ROOT = __dirname;
const DEFAULT_DATA_DIR = path.join(DEFAULT_ROOT, "data");
const DEFAULT_UPLOAD_DIR = path.join(DEFAULT_ROOT, "uploads");
const DEFAULT_PORT = Number(process.env.PORT || 8766);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".flac": "audio/flac"
};

function ensureDirs(dataDir = DEFAULT_DATA_DIR, uploadDir = DEFAULT_UPLOAD_DIR) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadDir, { recursive: true });
  for (const name of ["backgrounds", "avatars", "music", "photos"]) {
    fs.mkdirSync(path.join(uploadDir, name), { recursive: true });
  }
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store"
  });
  res.end(payload);
}

function readBody(req, limit = 120 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function safeUploadKind(kind) {
  const allowed = new Set(["backgrounds", "avatars", "music", "photos"]);
  return allowed.has(kind) ? kind : "photos";
}

function extensionFromMime(mime, fallbackName = "") {
  const fromName = path.extname(fallbackName).toLowerCase();
  if (fromName && fromName.length <= 8) return fromName;
  if (mime === "image/png") return ".png";
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/gif") return ".gif";
  if (mime === "audio/mpeg") return ".mp3";
  if (mime === "audio/wav") return ".wav";
  if (mime === "audio/ogg") return ".ogg";
  if (mime === "audio/mp4") return ".m4a";
  return ".bin";
}

function latestUploadUrl(kind, uploadDir = DEFAULT_UPLOAD_DIR) {
  const dir = path.join(uploadDir, safeUploadKind(kind));
  if (!fs.existsSync(dir)) return "";
  const files = fs.readdirSync(dir)
    .map((name) => {
      const filePath = path.join(dir, name);
      const stat = fs.statSync(filePath);
      return stat.isFile() ? { name, mtimeMs: stat.mtimeMs } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return files[0] ? `/uploads/${kind}/${files[0].name}` : "";
}

function hydrateLocalAssets(state, uploadDir = DEFAULT_UPLOAD_DIR) {
  if (!state || typeof state !== "object") return state;
  state.settings = state.settings || {};
  if (!state.settings.background) {
    state.settings.background = latestUploadUrl("backgrounds", uploadDir);
  }
  if (!state.settings.avatar) {
    state.settings.avatar = latestUploadUrl("avatars", uploadDir);
  }
  if (!state.settings.musicSrc) {
    const music = latestUploadUrl("music", uploadDir);
    if (music) {
      state.settings.musicSrc = music;
      state.settings.musicName = path.basename(music);
    }
  }
  return state;
}

function writeStateFile(state, stateFile, backupFile) {
  if (fs.existsSync(stateFile)) {
    fs.copyFileSync(stateFile, backupFile);
  }
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), "utf8");
}

async function handleApi(req, res, pathname, context) {
  const { stateFile, stateBackupFile, uploadDir } = context;
  if (req.method === "GET" && pathname === "/api/state") {
    if (!fs.existsSync(stateFile)) return send(res, 200, { state: null });
    const state = hydrateLocalAssets(JSON.parse(fs.readFileSync(stateFile, "utf8")), uploadDir);
    return send(res, 200, { state });
  }

  if (req.method === "PUT" && pathname === "/api/state") {
    const body = await readBody(req);
    const state = hydrateLocalAssets(JSON.parse(body || "{}"), uploadDir);
    writeStateFile(state, stateFile, stateBackupFile);
    return send(res, 200, { ok: true });
  }

  if (req.method === "POST" && pathname === "/api/upload") {
    const body = JSON.parse(await readBody(req));
    const match = String(body.dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return send(res, 400, { error: "Invalid dataUrl" });
    const mime = match[1];
    const buffer = Buffer.from(match[2], "base64");
    const kind = safeUploadKind(body.kind);
    const ext = extensionFromMime(mime, body.name);
    const fileName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    const target = path.join(uploadDir, kind, fileName);
    fs.writeFileSync(target, buffer);
    return send(res, 200, {
      ok: true,
      url: `/uploads/${kind}/${fileName}`,
      size: buffer.length,
      mime
    });
  }

  return send(res, 404, { error: "Not found" });
}

function serveFile(req, res, pathname, context) {
  const { rootDir, uploadDir } = context;
  let requested = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);
  requested = requested.replace(/^\/+/, "");
  let filePath;
  if (requested === "uploads" || requested.startsWith("uploads/")) {
    filePath = path.resolve(uploadDir, requested.replace(/^uploads[\\/]/, ""));
    if (!filePath.startsWith(uploadDir)) return send(res, 403, "Forbidden", "text/plain; charset=utf-8");
  } else {
    filePath = path.resolve(rootDir, requested);
    if (!filePath.startsWith(rootDir)) return send(res, 403, "Forbidden", "text/plain; charset=utf-8");
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return send(res, 404, "Not found", "text/plain; charset=utf-8");
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Cache-Control": filePath.includes(`${path.sep}uploads${path.sep}`) ? "public, max-age=31536000" : "no-cache"
  });
  fs.createReadStream(filePath).pipe(res);
}

function createServer(options = {}) {
  const context = {
    rootDir: options.rootDir || DEFAULT_ROOT,
    dataDir: options.dataDir || DEFAULT_DATA_DIR,
    uploadDir: options.uploadDir || DEFAULT_UPLOAD_DIR
  };
  context.stateFile = path.join(context.dataDir, "state.json");
  context.stateBackupFile = path.join(context.dataDir, "state.json.bak");
  ensureDirs(context.dataDir, context.uploadDir);
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url.pathname, context);
      return serveFile(req, res, url.pathname, context);
    } catch (error) {
      console.error(error);
      return send(res, 500, { error: error.message || "Server error" });
    }
  });
}

function startServer(options = {}) {
  const port = Number(options.port ?? DEFAULT_PORT);
  const host = options.host || "127.0.0.1";
  const server = createServer(options);
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : port;
      const url = `http://${host}:${actualPort}/`;
      console.log(`Astrel local blog is running at ${url}`);
      resolve({ server, url, port: actualPort });
    });
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { createServer, startServer, ensureDirs };
