const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number.parseInt(process.env.PORT ?? "8123", 10);
const ROOT = __dirname;

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function isPathInsideRoot(filePath) {
  return filePath === ROOT || filePath.startsWith(`${ROOT}${path.sep}`);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "text/plain; charset=utf-8",
  });
  response.end(body);
}

function serveFile(response, filePath) {
  fs.readFile(filePath, (error, fileBuffer) => {
    if (error) {
      sendText(response, 500, "Unable to read file.");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type":
        CONTENT_TYPES[extension] ?? "application/octet-stream",
    });
    response.end(fileBuffer);
  });
}

const server = http.createServer((request, response) => {
  if (!request.url) {
    sendText(response, 400, "Missing request URL.");
    return;
  }

  const requestUrl = new URL(
    request.url,
    `http://${request.headers.host ?? "127.0.0.1"}`
  );

  if (requestUrl.pathname === "/api/time") {
    sendJson(response, 200, { now: Date.now() });
    return;
  }

  const relativePath =
    requestUrl.pathname === "/"
      ? "/index.html"
      : decodeURIComponent(requestUrl.pathname);
  const filePath = path.normalize(path.join(ROOT, relativePath));

  if (!isPathInsideRoot(filePath)) {
    sendText(response, 403, "Forbidden.");
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      sendText(response, 404, "Not found.");
      return;
    }

    serveFile(response, filePath);
  });
});

server.listen(PORT, () => {
  console.log(`Timer server running at http://127.0.0.1:${PORT}`);
});
