// A whole site on Beagle identity in one file.
//   npm install @decentnetwork/beagle-service @decentnetwork/beagle-connect esbuild
//   node server.mjs        →  http://localhost:3000
import http from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { createBeagleService } from "@decentnetwork/beagle-service";

const PORT = Number(process.env.PORT ?? 3000);
const ORIGIN = process.env.ORIGIN ?? `http://localhost:${PORT}`; // exactly what the browser's address bar shows

const svc = await createBeagleService({
  origins: [ORIGIN],
  dataDir: process.env.DATA_DIR ?? fileURLToPath(new URL("./data", import.meta.url)),
  register: { required: ["email"], optional: ["location"] }, // [] = every visitor is a user at once
  visitor: { maxDays: 14, then: "ask" },                     // "refuse" = 403 until they register
  // The site's own Carrier identity. Leave it out if the site only needs sign-in.
  agent: process.env.AGENT ? { nickname: "Minimal Site", accept: "signed-in", befriendOn: "register" } : undefined,
});

svc.agent?.onMessage(({ user, text, reply }) => reply(user ? `Hello ${user.name ?? "there"}, you said: ${text}` : "Sign in on the site first."));
svc.users.on("registered", (user) => console.log(`registered: ${user.userid} ${JSON.stringify(user.profile)}`));

// beagle-connect for the browser. It needs two functions of @decentnetwork/peer
// (the signature check), so bundle those two modules instead of the whole peer.
const peerForBrowser = {
  name: "peer-for-browser",
  setup(b) {
    b.onResolve({ filter: /^@decentnetwork\/peer$/ }, () => ({ path: "peer", namespace: "shim" }));
    b.onLoad({ filter: /.*/, namespace: "shim" }, () => ({
      resolveDir: fileURLToPath(new URL(".", import.meta.url)),
      contents: `export { verifyDetached } from "@decentnetwork/peer/dist/crypto/sign.js";
                 export { base58ToBytes } from "@decentnetwork/peer/dist/utils/base58.js";`,
    }));
  },
};
const client = (await build({
  entryPoints: [fileURLToPath(import.meta.resolve("@decentnetwork/beagle-connect"))],
  bundle: true, format: "esm", platform: "browser", write: false, plugins: [peerForBrowser],
})).outputFiles[0].text;

const page = readFileSync(new URL("./index.html", import.meta.url));
const auth = svc.nodeHandler({ prefix: "/api/auth" }); // nonce, sign-in, launch, me, logout, register
const send = (res, status, type, body) => { res.writeHead(status, { "content-type": type, "cache-control": "no-store" }); res.end(body); };

http.createServer(async (req, res) => {
  const path = new URL(req.url, ORIGIN).pathname;
  if (path.startsWith("/api/auth/")) return auth(req, res);
  if (path === "/api/hello") {
    // One of the site's own routes: who is asking?
    const who = await svc.auth.authenticate(req);
    if (!who.ok) return send(res, who.status, "application/json", JSON.stringify({ error: who.error }));
    return send(res, 200, "application/json", JSON.stringify({ message: `Hello ${who.user.name ?? who.user.userid}, you are ${who.user.status}.` }));
  }
  if (path === "/beagle-connect.js") return send(res, 200, "text/javascript; charset=utf-8", client);
  if (path === "/") return send(res, 200, "text/html; charset=utf-8", page);
  send(res, 404, "text/plain", "not found");
}).listen(PORT, () => {
  console.log(`minimal-site: ${ORIGIN}`);
  if (svc.agent) console.log(`agent address (add it in Beagle): ${svc.agent.address}`);
});

// To refuse someone:  await svc.users.block(userid, "spam")   (sign-in answers 403, sessions end, the agent drops them)
