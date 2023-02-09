// Build patched amazon worker

const fs = require("fs");

const amazon_worker = fs.readFileSync("node_modules/amazon-ivs-player/dist/assets/amazon-ivs-worker.min.js");
const patch = fs.readFileSync("src/patch_amazonworker.js");

fs.writeFileSync('src/amazon-ivs-worker.min.js', patch + amazon_worker);

console.log("Worker patched!");