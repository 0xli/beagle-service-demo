// A personal homepage whose visitors sign in with their own Beagle identity.
//
//   npm install
//   npm start                      → http://localhost:3000
//   OWNER=<your userid> npm start  → the same, and you are its owner
//
// What it shows: sign-in, four levels of who may see what (public, signed-in,
// selected, owner), an owner's panel that selects visitors, an assistant that
// only knows what the asker may see, and the site's own identity, which
// accepts friend requests from signed-in visitors and passes their messages on
// to the owner.
import http from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { createBeagleService } from "@decentnetwork/beagle-service";

const PORT = Number(process.env.PORT ?? 3000);
// Exactly what the browser's address bar shows: scheme, host, port. No path, no trailing slash.
const ORIGIN = process.env.ORIGIN ?? `http://localhost:${PORT}`;

const here = (file) => fileURLToPath(new URL(file, import.meta.url)); // beside this file, wherever it is started from
const SITE_NAME = "My homepage";

const svc = await createBeagleService({
  origins: [ORIGIN],
  dataDir: here("./data"), // users, sessions and keys; created on first start
  // The site's own identity. People who have signed in may add it as a contact.
  agent: { nickname: SITE_NAME, accept: "signed-in" },
});

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

const auth = svc.nodeHandler({ prefix: "/api/auth" }); // nonce, sign-in, launch, me, logout, register
const routes = new Map(); // your own routes: path -> async (req, res)
const send = (res, status, body, type = "application/json") => {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
};

// One route of your own: who is asking?
routes.set("/api/hello", async (req, res) => {
  const who = await svc.auth.authenticate(req);
  if (!who.ok) return send(res, who.status, { error: who.error });
  send(res, 200, { message: `Hello ${who.user.name ?? who.user.userid}` });
});

// ── 1. Who may see what ──────────────────────────────────────────
const OWNER = (process.env.OWNER ?? "").trim(); // your own userid: sign in once, copy it from the page, start again with it
const LEVELS = ["public", "signed-in", "selected", "owner"];
const items = [
  { level: "public", title: "About me", text: "I build small tools with AI." },
  { level: "signed-in", title: "Now", text: "This month I am learning how peer-to-peer messaging works." },
  { level: "selected", title: "Resume", text: "Ten years of building things. Ask me for the PDF." },
  { level: "owner", title: "Notes to self", text: "Answer the two people who wrote last week." },
];

// Who is asking? This is the only place a session is read.
async function viewer(req) {
  const who = await svc.auth.authenticate(req, { checkOrigin: true });
  if (who.ok) {
    const level = who.user.userid === OWNER ? 3 : who.user.selected === true ? 2 : 1;
    return { level, user: who.user };
  }
  if (who.error === "not-signed-in") return { level: 0, user: null };
  return { level: -1, refuse: who }; // blocked, or the records could not be read: an error, never "public"
}

// May this viewer see this item? A level name that is not in LEVELS shows the item to nobody.
function maySee(v, item) {
  const need = LEVELS.indexOf(item.level);
  return need >= 0 && v.level >= need;
}
const visibleTo = (v) => items.filter((item) => maySee(v, item));

routes.set("/api/page", async (req, res) => {
  const v = await viewer(req);
  if (v.refuse) return send(res, v.refuse.status, { error: v.refuse.error });
  send(res, 200, { level: LEVELS[v.level], items: visibleTo(v) });
});

// ── 2. Selected visitors: a field on the visitor's record, set by the owner ──
const readJson = async (req) => {
  let raw = "";
  for await (const chunk of req) { raw += chunk; if (raw.length > 65536) return {}; }
  try { return JSON.parse(raw); } catch { return {}; }
};

routes.set("/api/visitors", async (req, res) => {
  const v = await viewer(req);
  if (v.refuse) return send(res, v.refuse.status, { error: v.refuse.error });
  if (v.level < 1) return send(res, 401, { error: "not-signed-in" });
  if (v.level < 3) return send(res, 403, { error: "owner-only" });
  if (req.method === "POST") {
    const { userid, selected } = await readJson(req);
    if (typeof userid !== "string" || !(await svc.users.get(userid))) return send(res, 404, { error: "no-such-visitor" });
    await svc.users.update(userid, { selected: selected === true });
  } else if (req.method !== "GET") return send(res, 405, { error: "method-not-allowed" });
  const visitors = (await svc.users.list()).map((u) => ({ userid: u.userid, name: u.name, selected: u.selected === true }));
  send(res, 200, { visitors });
});

// ── 3. The assistant ─────────────────────────────────────────────
// A stand-in that matches words, so the demo runs without a model or a key.
// Put your model here. Whatever answers gets the question and `visible`, the
// items this visitor may see, and nothing else: it cannot leak what it was
// never given.
async function answer(question, visible) {
  const words = question.toLowerCase().match(/\w{4,}/g) ?? [];
  const hits = visible.filter((item) => words.some((w) => `${item.title} ${item.text}`.toLowerCase().includes(w)));
  if (hits.length) return hits.map((item) => `${item.title}: ${item.text}`).join("\n");
  return `I can tell you about: ${visible.map((item) => item.title).join(", ")}.`;
}

routes.set("/api/ask", async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "method-not-allowed" });
  const v = await viewer(req);
  if (v.level < 1) return send(res, v.refuse?.status ?? 401, { error: v.refuse?.error ?? "not-signed-in" });
  const { question } = await readJson(req);
  send(res, 200, { answer: await answer(String(question ?? "").slice(0, 500), visibleTo(v)) });
});

// ── 4. Contact ───────────────────────────────────────────────────
// Two ways to reach you. "Add me on Beagle" needs your own Beagle address (the
// long one a friend request is sent to, not the userid). "Message this site"
// needs nothing: it adds the site's identity, which answers and passes the
// message on to you, once you have added the site's identity yourself.
const OWNER_ADDRESS = (process.env.OWNER_ADDRESS ?? "").trim();

routes.set("/api/contact", async (req, res) => {
  const v = await viewer(req);
  if (v.level < 1) return send(res, v.refuse?.status ?? 401, { error: v.refuse?.error ?? "not-signed-in" });
  send(res, 200, {
    owner: OWNER_ADDRESS ? { address: OWNER_ADDRESS, name: "the owner of this page" } : null,
    site: svc.agent ? { address: svc.agent.address, name: SITE_NAME } : null,
  });
});

// Messages people send to the site's identity: thank the sender, pass the text on to the owner.
svc.agent?.onMessage(async ({ userid, user, text, reply }) => {
  if (userid === OWNER) return;
  await reply("Thanks. The owner of this page will get your message.");
  if (OWNER) await svc.agent.send(OWNER, `${user?.name ?? "A visitor"} (${userid}) wrote: ${text}`);
});
svc.agent?.on("dead-letter", ({ why }) =>
  console.warn(`a message could not be passed on: ${why}${why === "not-a-friend" ? " (the owner has not added the site's identity yet: sign in as the owner and press \"Message this site\")" : ""}`));
if (svc.agent) console.log(`the site's address: ${svc.agent.address}`);
if (!OWNER) console.log("no OWNER set: sign in, copy your userid from the page, and start again with OWNER=<userid>");

http.createServer(async (req, res) => {
  try {
    const path = new URL(req.url, ORIGIN).pathname;
    if (path.startsWith("/api/auth/")) return await auth(req, res);
    if (routes.has(path)) return await routes.get(path)(req, res);
    if (path === "/beagle-connect.js") return send(res, 200, client, "text/javascript; charset=utf-8");
    if (path === "/") return send(res, 200, readFileSync(here("./index.html")), "text/html; charset=utf-8");
    send(res, 404, { error: "not-found" });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) send(res, 500, { error: "server-error" });
  }
}).listen(PORT, process.env.HOST, () => console.log(`open ${ORIGIN}`));
