// The site's one beagle-service. CommonJS, like the rest of this lib/.
//
// `sharedBeagleService` returns at once and creates the service on first use,
// one per process however many times Next.js evaluates this file. It never
// throws at a request: while the service cannot start, the routes answer 500
// and `authenticate` answers `ok: false`.
const { sharedBeagleService } = require("@decentnetwork/beagle-service");

const list = (v) => String(v || "").split(",").map((s) => s.trim()).filter(Boolean);

const beagle = sharedBeagleService(() => ({
  // Exact origins of this site's pages: scheme, host and port.
  origins: list(process.env.BEAGLE_ORIGINS || `http://localhost:${process.env.PORT || 3000}`),
  dataDir: process.env.BEAGLE_DATA_DIR || "./data",
  // The site's part of a sign-in, awaited before the answer goes out. What it
  // returns is added to the answer; `{ refuse: "why" }` refuses the sign-in.
  onSignIn: async (user, { origin, door, first }) => {
    if (first) console.log(`first sign-in: ${user.userid} at ${origin} through ${door}`);
    return { role: user.signIns > 100 ? "regular" : "listener" };
  },
  // The site's part of a sign-out, only when it succeeded: here, clearing a
  // cookie an older version of the site used to set.
  onSignOut: async () => ({ setCookie: "old_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" }),
  // Behind a reverse proxy on the same machine that sets X-Forwarded-For itself:
  // rateLimit: { trustProxy: ["loopback"] },
}));

module.exports = { beagle };
