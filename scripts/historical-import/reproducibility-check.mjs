// Proves SOURCE + RULINGS -> SAME COMPLETE MIGRATION PLAN, every time.
// Generates the manifest twice (fresh module state each time is not
// achievable within one process for a pure function, so this instead
// re-invokes generateManifest() twice against the same loaded sources —
// the meaningful claim is "the SAME inputs deterministically produce the
// SAME output", not "a second process re-reads disk", since the generator
// itself does no caching/mutation of its inputs).

import { generateManifest } from "./generateManifest.mjs";
import crypto from "node:crypto";

const pass1 = generateManifest();
const pass2 = generateManifest();

const normalize = (m) => {
  const clone = JSON.parse(JSON.stringify(m));
  clone.generatedAt = "NORMALIZED"; // the only intentionally non-deterministic-looking field, and it's already a constant string, not a real timestamp
  return clone;
};

const n1 = normalize(pass1);
const n2 = normalize(pass2);
const s1 = JSON.stringify(n1);
const s2 = JSON.stringify(n2);
const h1 = crypto.createHash("sha256").update(s1).digest("hex");
const h2 = crypto.createHash("sha256").update(s2).digest("hex");

// eslint-disable-next-line no-console
console.log("PASS 1 hash:", h1);
// eslint-disable-next-line no-console
console.log("PASS 2 hash:", h2);
// eslint-disable-next-line no-console
console.log("IDENTICAL:", h1 === h2);
if (h1 !== h2) {
  // eslint-disable-next-line no-console
  console.log("PASS 1:", s1);
  // eslint-disable-next-line no-console
  console.log("PASS 2:", s2);
  process.exit(1);
}
// eslint-disable-next-line no-console
console.log(JSON.stringify(pass1, null, 2));
