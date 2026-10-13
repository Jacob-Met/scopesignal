#!/usr/bin/env node
// Serve only this packet's exact saved-record viewer on a fresh loopback port.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const paths = [
  "record.html", "record-view.css", "src/record-view.mjs",
  "src/record-reader.mjs", "src/record-event-filter.mjs",
  "src/fixture-record.mjs", "src/ledger.mjs",
  "src/record-review-download.mjs", "src/record-review-export.mjs",
];
const mime = name => name.endsWith(".html") ? "text/html; charset=utf-8"
  : name.endsWith(".css") ? "text/css; charset=utf-8"
  : "text/javascript; charset=utf-8";
const pins = JSON.parse(await readFile(new URL("./RUNTIME-PINS.json", import.meta.url), "utf8"));
if (pins.source !== "86d6c39dc219aa34285f66c91545103ffff2daa3" ||
    Object.keys(pins.files).sort().join("\n") !== [...paths].sort().join("\n")) {
  throw Error("Runtime pins do not describe the qualified saved-record viewer.");
}
const routes = new Map();
for (const path of paths) {
  const bytes = await readFile(new URL("./source/candidate/" + path, import.meta.url));
  const pin = pins.files[path];
  if (bytes.length !== pin.bytes ||
      createHash("sha256").update(bytes).digest("hex") !== pin.sha256) {
    throw Error("Runtime bytes differ: " + path);
  }
  routes.set("/" + path, { bytes, type: mime(path) });
}
routes.set("/", routes.get("/record.html"));
const server = createServer((request, response) => {
  const end = (status, type, bytes, extra = {}) => {
    response.writeHead(status, {
      "Content-Type": type, "Content-Length": bytes.length,
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extra,
    });
    response.end(request.method === "HEAD" ? undefined : bytes);
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    request.resume();
    end(405, "text/plain; charset=utf-8", Buffer.from("This local viewer accepts GET and HEAD only.\n"), { Allow: "GET, HEAD" });
    return;
  }
  let pathname;
  try { pathname = new URL(request.url, "http://127.0.0.1").pathname; }
  catch { end(400, "text/plain; charset=utf-8", Buffer.from("Invalid local request.\n")); return; }
  const item = routes.get(pathname);
  if (!item) {
    end(404, "text/plain; charset=utf-8", Buffer.from(
      "This focused companion contains only the saved-record viewer.\n" +
      "The full demo and other pages are outside this packet; see OPEN.txt.\n"));
    return;
  }
  end(200, item.type, item.bytes);
});
server.on("error", error => { console.error(error.message); process.exitCode = 1; });
server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  console.log("ScopeSignal saved-record companion: http://127.0.0.1:" + address.port + "/record.html");
  console.log("Open that address in a browser. Choose fixtures/mixed.json to try the authored example.");
  console.log("This packet includes only the saved reader. Press Ctrl+C here to stop.");
});
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  server.close(error => {
    if (error) { console.error(error.message); process.exitCode = 1; }
  });
  server.closeAllConnections();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
