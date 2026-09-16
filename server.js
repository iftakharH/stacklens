// Load .env from the repo root if it exists (zero-env still works without one).
// dotenv never overwrites existing process env, so Vercel/production shell
// values always take precedence.
require("dotenv").config({
  path: require("path").join(__dirname, ".env"),
  quiet: true,
});

const app = require("./api/index.js");
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`StackLens backend running on http://localhost:${PORT}`);
});
