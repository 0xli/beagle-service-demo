// NextAuth owns the catch-all under /api/auth. A second catch-all in this
// directory does not build, so the Beagle routes beside it are one file each
// (nonce.js, sign-in.js, launch.js, me.js, logout.js, register.js); a named
// file wins over the catch-all, and none of those names is one of NextAuth's.
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export default NextAuth({
  secret: process.env.NEXTAUTH_SECRET || "example-only-secret-change-me",
  providers: [
    Credentials({
      name: "Demo",
      credentials: { name: { label: "Name", type: "text" } },
      authorize: async (credentials) => (credentials?.name ? { id: credentials.name, name: credentials.name } : null),
    }),
  ],
});
