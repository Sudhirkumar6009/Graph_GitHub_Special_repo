// Local development server — mimics Vercel's serverless function environment.
// Run with: npx ts-node server.ts
// Then open: http://localhost:3000/api/graph?username=YOUR_GITHUB_USERNAME

import * as http from "http";
import * as url from "url";
import * as fs from "fs";
import * as path from "path";

// Load .env file manually (no extra package needed)
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key && !process.env[key]) process.env[key] = val;
  }
  console.log("✓ Loaded .env");
} else {
  console.warn("⚠  No .env file found — make sure GH_TOKEN is set in your environment.");
}

const PORT = 3000;

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url ?? "/", true);

  if (!parsed.pathname?.startsWith("/api/graph")) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found. Try: http://localhost:3000/api/graph?username=YOUR_USERNAME");
    return;
  }

  console.log(`→ ${req.method} ${req.url}`);

  try {
    // Dynamically import the handler so changes are picked up on restart
    // Clear require cache so edits to graph.ts take effect without restarting
    const modulePath = path.join(__dirname, "api", "graph.ts");
    // ts-node handles .ts imports directly
    const { default: handler } = await import(modulePath);

    // Build a minimal mock of VercelRequest / VercelResponse
    const mockReq = {
      query: parsed.query as Record<string, string>,
      method: req.method,
      url: req.url,
      headers: req.headers,
    };

    const headers: Record<string, string> = {};
    let statusCode = 200;
    let body = "";

    const mockRes = {
      setHeader(key: string, val: string) {
        headers[key] = val;
      },
      status(code: number) {
        statusCode = code;
        return this;
      },
      send(data: string) {
        body = data;
        res.writeHead(statusCode, headers);
        res.end(body);
      },
    };

    await handler(mockReq, mockRes);
  } catch (err) {
    console.error("Server error:", err);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal server error: " + String(err));
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 Dev server running at http://localhost:${PORT}`);
  console.log(`   Try: http://localhost:${PORT}/api/graph?username=torvalds&theme=dark&area=true\n`);
});
