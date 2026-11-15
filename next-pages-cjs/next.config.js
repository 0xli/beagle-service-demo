const path = require("path");

module.exports = {
  // Also emit .next/standalone: a self-contained server (server.js and the
  // node_modules it needs). File tracing puts the library there, the
  // operator's command with it:
  //   cd .next/standalone && node node_modules/@decentnetwork/beagle-service/dist/cli.js users list
  output: "standalone",
  webpack(config, { isServer }) {
    // The page uses beagle-connect, which needs two functions of
    // @decentnetwork/peer (the signature check). Give the browser those two
    // modules instead of the whole peer.
    if (!isServer) config.resolve.alias["@decentnetwork/peer$"] = path.join(__dirname, "lib/peer-for-browser.mjs");
    return config;
  },
};
