import { useState } from "react";
import { beagle } from "../lib/beagle"; // used on the server only, in getServerSideProps

export async function getServerSideProps({ req }) {
  const who = await beagle.authenticate(req);
  return { props: { user: who.ok ? { userid: who.user.userid, name: who.user.name } : null } };
}

export default function Home({ user }) {
  const [me, setMe] = useState(user);
  const [error, setError] = useState("");

  async function signInWithBeagle() {
    // Open the window inside the click, or the browser blocks it.
    const win = window.open("about:blank", "beagle-connect", "width=420,height=560");
    try {
      const { signIn } = await import("@decentnetwork/beagle-connect");
      const { nonce } = await (await fetch("/api/auth/nonce")).json();
      const who = await signIn({ nonce, existingWindow: win });
      const res = await fetch("/api/auth/sign-in", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(who) });
      const answer = await res.json();
      if (!res.ok) throw new Error(answer.message || answer.error);
      setMe(answer.user);
      setError("");
    } catch (e) {
      win?.close();
      setError(String(e.message || e));
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe(null);
  }

  return (
    <main style={{ font: "16px system-ui", maxWidth: 560, margin: "64px auto", padding: "0 16px" }}>
      <h1>Sign in with Beagle</h1>
      {me ? (
        <>
          <p>Signed in as <b>{me.name || "someone"}</b></p>
          <p><code style={{ wordBreak: "break-all" }}>{me.userid}</code></p>
          <button onClick={signOut}>Sign out</button>
        </>
      ) : (
        <button onClick={signInWithBeagle}>Sign in with Beagle</button>
      )}
      {error && <p role="alert">{error}</p>}
      <p><a href="/api/auth/signin">NextAuth's own sign-in page</a> lives beside it.</p>
    </main>
  );
}
