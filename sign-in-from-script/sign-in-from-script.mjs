// A script that signs in to a site: a publisher node, a cron job, a test.
//
//   node sign-in-from-script.mjs https://your.app
//
// A browser adds the `Origin` header by itself; a script has to. The server
// takes the origin from that header only (never from the body), checks it
// against its exact list, and checks that the signature was made for it. So a
// script names the site's own origin, the one its pages are served from, in
// the header and in the string it signs.
import { generateKeyPairSync } from "node:crypto";
import { bytesToBase58, signDetached } from "@decentnetwork/peer";

const site = new URL(process.argv[2] ?? "http://localhost:3000").origin;
const sendOrigin = !process.argv.includes("--no-origin");

// The script's identity. A real one loads its key from a file it keeps; this
// one makes a throwaway X25519 key so the example runs anywhere.
const { publicKey, privateKey } = generateKeyPairSync("x25519");
const secretKey = new Uint8Array(Buffer.from(privateKey.export({ format: "jwk" }).d, "base64url"));
const userid = bytesToBase58(new Uint8Array(Buffer.from(publicKey.export({ format: "jwk" }).x, "base64url")));
const headers = sendOrigin ? { Origin: site, "content-type": "application/json" } : { "content-type": "application/json" };

// README:begin
const { nonce } = await (await fetch(`${site}/api/auth/nonce`)).json();
const sig = Buffer.from(signDetached(secretKey, new TextEncoder().encode(`decent-auth\n${site}\n${nonce}`))).toString("hex");
const res = await fetch(`${site}/api/auth/sign-in`, { method: "POST", headers, body: JSON.stringify({ userid, nonce, sig }) });
// README:end

const answer = await res.json();
if (!res.ok) {
  console.error(`sign-in refused: ${res.status} ${answer.error}`);
  process.exit(1);
}
// The session: send this cookie back on later requests (or use `session: { transport: "bearer" }` on the site).
const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const me = await (await fetch(`${site}/api/auth/me`, { headers: { cookie } })).json();
console.log(`signed in as ${me.user.userid}`);
