import http from "node:http";
import { spawn } from "node:child_process";

const PUBLIC_PORT = 3001;
const NEXT_PORT = 3002;
const BACKEND_ORIGIN = "http://127.0.0.1:8080";
const NEXT_ORIGIN = `http://127.0.0.1:${NEXT_PORT}`;

export function resolveProxyTarget(pathname) {
  return pathname.startsWith("/api/v1") || pathname === "/ws" || pathname.startsWith("/ws?")
    ? BACKEND_ORIGIN
    : NEXT_ORIGIN;
}

function createProxyRequest(target, req, res) {
  const url = new URL(target);
  const proxyReq = http.request(
    {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      method: req.method,
      path: req.url,
      headers: req.headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on("error", (error) => {
    res.writeHead(502, { "content-type": "text/plain" });
    res.end(`Proxy error: ${error.message}`);
  });

  req.pipe(proxyReq);
}

function handleUpgrade(req, socket, head) {
  const target = new URL(resolveProxyTarget(req.url ?? "/"));
  const proxyReq = http.request({
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port,
    method: req.method,
    path: req.url,
    headers: req.headers,
  });

  proxyReq.on("upgrade", (proxyRes, proxySocket, proxyHead) => {
    socket.write(
      [
        `HTTP/1.1 ${proxyRes.statusCode} ${proxyRes.statusMessage}`,
        ...Object.entries(proxyRes.headers).flatMap(([key, value]) =>
          value === undefined ? [] : `${key}: ${value}`
        ),
        "",
        "",
      ].join("\r\n")
    );

    if (head.length > 0) {
      proxySocket.write(head);
    }
    if (proxyHead.length > 0) {
      socket.write(proxyHead);
    }

    proxySocket.pipe(socket).pipe(proxySocket);
  });

  proxyReq.on("error", () => {
    socket.destroy();
  });

  proxyReq.end();
}

function start() {
  const nextProcess = spawn("pnpm", ["exec", "next", "dev", "--port", String(NEXT_PORT)], {
    stdio: "inherit",
  });

  const server = http.createServer((req, res) => {
    createProxyRequest(resolveProxyTarget(req.url ?? "/"), req, res);
  });

  server.on("upgrade", handleUpgrade);

  const shutdown = () => {
    server.close();
    nextProcess.kill("SIGTERM");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  server.listen(PUBLIC_PORT, "127.0.0.1");
}

const isMain = process.argv[1] && new URL(import.meta.url).pathname === process.argv[1];

if (isMain) {
  start();
}
