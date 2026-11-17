import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("./dist/", import.meta.url));
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".mp4": "video/mp4",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
};
const server = http.createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }
  try {
    const url = new URL(request.url, "http://localhost");
    const pathname = decodeURIComponent(url.pathname);
    const filename = resolve(
      root,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (!filename.startsWith(root.endsWith(sep) ? root : root + sep)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    const body = await readFile(filename);
    response.writeHead(200, {
      "Content-Type": `${types[extname(filename)] || "application/octet-stream"}; charset=utf-8`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch (error) {
    response.writeHead(
      error.code === "ENOENT" || error.code === "EISDIR" ? 404 : 400,
    );
    response.end("The requested file could not be opened.");
  }
});
server.listen(4175, "127.0.0.1", () =>
  console.log("Afterlight is ready at http://127.0.0.1:4175"),
);
