// Caveman arm: caveman SKILL.md (full) as the system prompt.
const fs = require("fs");
const path = require("path");
const system = fs.readFileSync(
  path.join(__dirname, "caveman-SKILL.md"),
  "utf8",
);
module.exports = ({ vars }) => [
  { role: "system", content: system },
  { role: "user", content: vars.task },
];
