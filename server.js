// Load .env then .env.local from the repo root if they exist (zero-env still
// works without one). dotenv never overwrites existing process env, so
// Vercel/production shell values always take precedence; .env.local is the
// per-machine override layer and never clobbers the shared .env.
const path = require("path");
for (const file of [".env", ".env.local"]) {
  require("dotenv").config({
    path: path.join(__dirname, file),
    quiet: true,
  });
}

const app = require("./api/index.js");
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`StackLens backend running on http://localhost:${PORT}`);
});
