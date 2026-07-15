// Manual entry point for `npm run migrate` - importing db.js runs every
// pending migration via its top-level await (same code path the server
// uses on startup), then this just exits cleanly.
import "../db.js";

console.log("Migrations complete.");
process.exit(0);
