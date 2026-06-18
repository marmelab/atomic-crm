// Ponytail arm: the repo's own SKILL.md (full) as the system prompt. Single source of truth.
const fs = require("fs");
const path = require("path");
const system = fs.readFileSync(
  path.join(__dirname, "..", "..", "skills", "ponytail", "SKILL.md"),
  "utf8",
);
module.exports = ({ vars }) => [
  { role: "system", content: system },
  { role: "user", content: vars.task },
];
