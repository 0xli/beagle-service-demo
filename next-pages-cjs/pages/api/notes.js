// One of the site's own routes. Reading a session is asynchronous and never
// throws: no session, a bad one, a blocked user or a server that cannot check
// all come back as `ok: false` with a status.
const { beagle } = require("../../lib/beagle");

const notes = new Map(); // userid -> text; a real site has a database

export default async function handler(req, res) {
  // checkOrigin: a request that changes something and carries the session
  // cookie must come from one of this site's pages (its Origin header is on
  // the list). A GET is not checked.
  const who = await beagle.authenticate(req, { checkOrigin: true });
  if (!who.ok) return res.status(who.status).json({ error: who.error });
  if (req.method === "POST") notes.set(who.user.userid, String(req.body?.text ?? "").slice(0, 500));
  res.status(200).json({ note: notes.get(who.user.userid) ?? "" });
}
