// Next.js runs this once when the server starts (`next start`, `next dev`),
// before any request. Asking for the service here means a wrong configuration
// (an entry of BEAGLE_ORIGINS that is not an exact origin, a users file that
// does not parse) is found at start, with its reason, instead of showing up as
// a failed sign-in later. There are two ways to ask, and a site picks one:
//
// - Not awaited: the reason is printed at start, the pages stay up, the
//   sign-in routes answer 500 and everybody is signed out until it is fixed.
//   For a site where sign-in is one feature among others.
// - Awaited: Next.js prints "Failed to prepare server" with the reason and
//   answers 500 to every request. For a site where nothing should be served
//   while sign-in cannot work.
//
// This example does the first, and the second when SIGN_IN_REQUIRED is set.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { beagle } = require("./lib/beagle");
  // README:begin
  if (process.env.SIGN_IN_REQUIRED) await beagle.ready();
  else beagle.ready().catch(() => {});
  // README:end
}
