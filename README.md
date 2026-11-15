# beagle-service-demo

A small personal homepage built on [`@decentnetwork/beagle-service`](https://www.npmjs.com/package/@decentnetwork/beagle-service),
the web backend for a site whose visitors sign in with their Beagle identity, and the three examples that ship
with the package.

A visitor's identity is a key pair made on their own device. The site learns who they are from a signature, keeps
its own record of them, and needs no account server in between.

| Folder | What it shows |
|---|---|
| [`homepage`](homepage) | **The demo site.** A personal page where what you see depends on who you are: public, signed-in, selected by the owner, or the owner. An owner's panel, an assistant that only knows what the asker may see, and the site's own identity, which takes messages and passes them on to the owner. |
| [`minimal-site`](minimal-site) | The package's smallest example: a whole site in one file and one page, with registration fields. |
| [`next-pages-cjs`](next-pages-cjs) | The package's Next.js example: a CommonJS pages-router site that already has NextAuth's catch-all. |
| [`sign-in-from-script`](sign-in-from-script) | The package's script example: a cron job, a publisher node or a test signing in to any of the sites. |

The three examples are copied from the npm tarball (version 0.3.0); each folder has its own `package.json` and runs
by itself.

You need Node 20 or newer. To sign in from a page you also need a Beagle: the web client at
<https://app.beagle.chat>, or one running on this computer. The script example needs neither.

## The demo site: homepage

```bash
cd homepage
npm install
npm start
```

It prints the site's own address and `open http://localhost:3000`. Open exactly that address (the site accepts
sign-ins for that origin and no other; `http://127.0.0.1:3000` is a different origin).

**Signed out** you see one item, *About me*, and two buttons: **Sign in with Beagle (installed)** for a Beagle on
this computer, **Sign in with Beagle in the browser** for the web client. Either opens a Beagle window that names
this site and asks whether to sign in; allow pop-ups if the browser asks.

**Signed in** the page says `Signed in as <your name> <your userid> · you see: signed-in` and shows a second item,
*Now*. Below it:

- **Ask**: a stand-in assistant (it matches words; put a model in its place in `server.mjs`). It is handed only the
  items you may see, so asking for something above your level gets `I can tell you about: About me, Now.`
- **Message this site**: your Beagle asks whether to send a friend request to the site's own identity. The site
  accepts requests from people who have signed in. Write to it in your Beagle and it answers
  `Thanks. The owner of this page will get your message.`

**To be the owner**, copy your userid from the page, stop the server and start it again with it:

```bash
OWNER=<your userid> npm start
```

Now the page says `you see: owner` and shows all four items, and a **Selected visitors** list of everybody who has
signed in. Tick someone and their next page load says `you see: selected` and shows the third item, *Resume*.
Press **Message this site** once yourself: after that, what visitors write to the site's identity is passed on to
your Beagle as `<their name> (<their userid>) wrote: …`.

| You are | You see |
|---|---|
| anybody | *About me* |
| signed in | *About me*, *Now*, the assistant, the contact button |
| selected by the owner | the same, and *Resume* |
| the owner (`OWNER`) | all four items and the *Selected visitors* list |

Things to know:

- A Beagle on another local port: open the page as `http://localhost:3000/?beagle=http://127.0.0.1:8767`.
- `OWNER_ADDRESS=<your Beagle address>` adds an **Add me on Beagle** button that sends the request to you directly.
- The first sign-in on localhost makes the library log one line about its rate limit and reverse proxies. It is
  about deployments and can be ignored here.
- Everything the site keeps is in `homepage/data/` (users, sessions, the site's own key). Delete the folder to
  start over; `npx beagle-service users list --data data` lists who has signed in.
- Another port: `PORT=3001 npm start`.

## Example 1: minimal-site

```bash
cd minimal-site
npm install
npm start
```

It prints `minimal-site: http://localhost:3000`. Open exactly that address (the site accepts sign-ins for that
origin and no other; `http://127.0.0.1:3000` is a different origin).

What you should see:

- Two buttons: **Sign in with Beagle (installed)** for a Beagle on this computer, **Sign in with Beagle in the
  browser** for the web client. Either opens a Beagle window that asks whether to sign in to this site.
- After you approve: `Signed in as <your name> (visitor)` with your userid (`someone` if your Beagle has no name
  set), a small form (email is required, location is optional), a **Sign out** button, and a line from the site's
  own route: `Hello <your name>, you are visitor.`
- Save an email address and the status becomes `registered`. Reload: still signed in. Sign out: the buttons are back.

Without a Beagle you can still see the server side answer:

```bash
curl http://localhost:3000/api/auth/nonce      # {"ok":true,"nonce":"…","expiresIn":120}
curl -i http://localhost:3000/api/auth/me      # 401 {"ok":false,"error":"not-signed-in",…}
```

The users it has seen are in `minimal-site/data/users.json`; `npx beagle-service users list --data data` lists them,
`npx beagle-service users block <userid> spam --data data` refuses one (no restart needed).

Another port: `PORT=3001 npm start`.

## Example 2: next-pages-cjs

```bash
cd next-pages-cjs
npm install
npm run build
BEAGLE_ORIGINS=http://localhost:3000 npm start
```

Open <http://localhost:3000>. What you should see:

- A page with one button, **Sign in with Beagle**, and a link to NextAuth's own sign-in page, which lives beside it
  under the same `/api/auth`.
- After you approve in the Beagle window: `Signed in as <your name>` and your userid. Reload: the page is rendered
  on the server already signed in. **Sign out** ends the session.
- `next start` prints `⚠ "next start" does not work with "output: standalone" configuration`. It does start and
  serve the site; the warning is there because `next.config.js` also asks for a standalone build, which the
  example uses to show the operator's command inside such a bundle.

```bash
curl http://localhost:3000/api/auth/providers  # NextAuth's catch-all still answers
curl http://localhost:3000/api/auth/nonce      # the Beagle route beside it
npx beagle-service users list                  # the operator's command, beside the running server
```

Its own [README](next-pages-cjs/README.md) says which file shows what. Another port: `PORT=3001
BEAGLE_ORIGINS=http://localhost:3001 npm start`.

## Example 3: sign-in-from-script

With one of the sites running on port 3000:

```bash
cd sign-in-from-script
npm install
node sign-in-from-script.mjs http://localhost:3000
```

What you should see: `signed in as <a userid>`. The script makes a throwaway key, asks the site for a nonce, signs
it, and posts the sign-in with an `Origin` header, which a browser adds by itself and a script has to send.
`node sign-in-from-script.mjs http://localhost:3000 --no-origin` shows what happens without it:
`sign-in refused: 403 origin-not-allowed`.

## More

- The package and its documentation: <https://www.npmjs.com/package/@decentnetwork/beagle-service>
- The browser side these pages use: <https://www.npmjs.com/package/@decentnetwork/beagle-connect>

MIT licensed.
