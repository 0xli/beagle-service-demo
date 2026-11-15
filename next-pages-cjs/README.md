# Sign in with Beagle beside NextAuth, in a CommonJS Next.js site

A pages-router site whose `lib/` is CommonJS and which already has NextAuth's catch-all at
`pages/api/auth/[...nextauth].js`.

```bash
npm install
npm run build
BEAGLE_ORIGINS=http://localhost:3000 npm start
```

| File | What it shows |
|---|---|
| `lib/beagle.js` | `require("@decentnetwork/beagle-service")`, one service per process, the `onSignIn` and `onSignOut` hooks |
| `instrumentation.js` | the service is asked for when the server starts, so a wrong `BEAGLE_ORIGINS` is printed then; the pages stay up, or with `SIGN_IN_REQUIRED=1` nothing is served |
| `pages/api/auth/[...nextauth].js` | NextAuth's catch-all, untouched |
| `pages/api/auth/nonce.js`, `sign-in.js`, `launch.js`, `me.js`, `logout.js`, `register.js` | one Beagle route per file: `export default beagle.route("signIn")` |
| `pages/api/notes.js` | a route of the site's own: `beagle.authenticate(req, { checkOrigin: true })` |
| `pages/index.js` | reading the session in `getServerSideProps`; the popup with `beagle-connect` |
| `next.config.js`, `lib/peer-for-browser.mjs` | what the browser bundle needs for `beagle-connect` |

The operator's command works beside the running server:

```bash
npx beagle-service users list
npx beagle-service users block <userid> spam
```

In the standalone bundle (`next.config.js` has `output: "standalone"`) there is no `npx`; the command's file is
there:

```bash
cd .next/standalone
node node_modules/@decentnetwork/beagle-service/dist/cli.js users list --data ../../data
```
