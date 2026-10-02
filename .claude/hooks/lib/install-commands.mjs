// Find the package installs and npx runs inside a Bash command, so dependency-gate can vet
// what they would fetch. Reads the quote-masked text: a package name inside a commit
// message or an echo is not an install.

/**
 * Blank out the CONTENT of quoted spans, keeping the quotes and the length.
 *
 * Every regex below reads shell punctuation, and none of it means anything inside quotes:
 * `grep "a;b" f` split into two commands whose second one had no known verb, and
 * `echo "a -> b"` read as a redirect into a file. Both were counted as work.
 *
 * @param {string} command
 * @returns {string} the command with quoted content replaced by `x`
 */
function maskQuoted(command) {
  let out = "";
  let quote = "";
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (quote) {
      if (ch === "\\" && quote === '"' && i + 1 < command.length) {
        out += "xx";
        i++;
        continue;
      }
      if (ch === quote) {
        quote = "";
        out += ch;
        continue;
      }
      out += "x";
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === "\\" && i + 1 < command.length) {
      out += ch + command[i + 1];
      i++;
      continue;
    }
    out += ch;
  }
  return out;
}

const NPM_INSTALL = new Set([
  "install",
  "i",
  "add",
  "in",
  "ins",
  "inst",
  "insta",
  "instal",
  "isnt",
  "isnta",
  "isntal",
  "isntall",
  "it",
  "install-test",
]);
const NPM_EXEC = new Set(["exec", "x"]);
const NPM_VALUE_FLAGS = new Set([
  "--prefix",
  "-C",
  "--workspace",
  "-w",
  "--omit",
  "--include",
  "--tag",
  "--install-strategy",
  "--cache",
  "--userconfig",
  "--registry",
  "--before",
  "--min-release-age",
]);
const EXEC_VALUE_FLAGS = new Set([...NPM_VALUE_FLAGS, "--call", "-c"]);
const GATE_OWNED =
  /^--(?:registry|before|min-release-age)(?:=|$)|^--(?:no-ignore-scripts|ignore-scripts=false)$/;

const MANAGER = /(?:^|[\s;&|(){}`])(npm|npx|pnpm|pnpx|yarn|bun|bunx)(?=\s|$)/g;
const SEGMENT_END = /[;&|\n)`]/;
const CD = /(?:^|[\s;&|(){}`])cd\s+(\S+)/g;
const REDIRECT = /^\d*[<>]/;
const BARE_REDIRECT = /^\d*[<>]+&?$/;
const NAME = /^(?:@[a-z0-9~][\w.~-]*\/)?[a-z0-9~][\w.~-]*$/i;

const unquote = (text) => text.replace(/["']/g, "");

const tokensOf = (command, masked, from, to) =>
  [...masked.slice(from, to).matchAll(/\S+/g)].map((m) => {
    const start = from + m.index;
    const end = start + m[0].length;
    return { text: unquote(command.slice(start, end)), end };
  });

const installArgs = (words) => {
  const specs = [];
  const flags = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i].text;
    if (REDIRECT.test(w)) {
      if (BARE_REDIRECT.test(w)) i++;
      continue;
    }
    if (w.startsWith("-")) {
      flags.push(w);
      if (NPM_VALUE_FLAGS.has(w)) i++;
      continue;
    }
    specs.push(w);
  }
  return { specs, gateFlags: flags.filter((f) => GATE_OWNED.test(f)) };
};

const execArgs = (words) => {
  const packages = [];
  const flags = [];
  let bin;
  for (let i = 0; i < words.length && bin === undefined; i++) {
    const w = words[i].text;
    if (w === "--") bin = words[i + 1]?.text ?? "";
    else if (w.startsWith("--package=")) packages.push(w.slice(10));
    else if (w === "-p" || w === "--package") packages.push(words[++i]?.text);
    else if (w.startsWith("-")) {
      flags.push(w);
      if (EXEC_VALUE_FLAGS.has(w)) i++;
    } else bin = w;
  }
  const specs = packages.length ? packages.filter(Boolean) : bin ? [bin] : [];
  return {
    specs,
    binOnly: !packages.length,
    gateFlags: flags.filter((f) => GATE_OWNED.test(f)),
  };
};

const addsWithOtherManager = (manager, [sub, next] = []) => {
  const withPackage = next !== undefined && !next.startsWith("-");
  switch (manager) {
    case "pnpx":
    case "bunx":
      return true;
    case "pnpm":
      return (
        sub === "add" ||
        sub === "dlx" ||
        ((sub === "i" || sub === "install") && withPackage)
      );
    case "yarn":
      return (
        sub === "add" || sub === "dlx" || (sub === "global" && next === "add")
      );
    case "bun":
      return (
        ["add", "a", "x"].includes(sub) ||
        ((sub === "i" || sub === "install") && withPackage)
      );
    default:
      return false;
  }
};

const classify = (manager, managerEnd, words) => {
  if (manager === "npx") {
    const exec = execArgs(words);
    return exec.specs.length
      ? { kind: "exec", manager, insertAt: managerEnd, ...exec }
      : null;
  }
  if (manager !== "npm") {
    return addsWithOtherManager(
      manager,
      words.map((w) => w.text),
    )
      ? { kind: "other", manager, specs: [], gateFlags: [], insertAt: -1 }
      : null;
  }
  let i = 0;
  while (i < words.length && words[i].text.startsWith("-")) {
    i += NPM_VALUE_FLAGS.has(words[i].text) ? 2 : 1;
  }
  const sub = words[i];
  if (!sub) return null;
  if (NPM_INSTALL.has(sub.text)) {
    const install = installArgs(words.slice(i + 1));
    return install.specs.length
      ? {
          kind: "install",
          manager,
          insertAt: sub.end,
          binOnly: false,
          ...install,
        }
      : null;
  }
  if (NPM_EXEC.has(sub.text)) {
    const exec = execArgs(words.slice(i + 1));
    return exec.specs.length
      ? { kind: "exec", manager, insertAt: sub.end, ...exec }
      : null;
  }
  return null;
};

const lastCdBefore = (command, masked, index) => {
  let dir;
  for (const m of masked.slice(0, index).matchAll(CD)) {
    const start = m.index + m[0].length - m[1].length;
    dir = unquote(command.slice(start, start + m[1].length));
  }
  return dir;
};

/**
 * Every install or npx run in `command`, in order.
 *
 * `kind` is `install` (npm install and its aliases, with at least one package), `exec`
 * (npx / npm exec), or `other` (a pnpm / yarn / bun install or runner, which the gate
 * does not vet). `insertAt` is the offset right after the subcommand, where flags go.
 * `binOnly` means the spec is a command name npx may resolve to a local bin.
 * @param {string} command
 * @returns {Array<{kind: string, manager: string, specs: string[], gateFlags: string[], insertAt: number, binOnly?: boolean, cwd?: string}>}
 */
export function findInstalls(command) {
  const original = String(command || "");
  const masked = maskQuoted(original);
  const found = [];
  for (const m of masked.matchAll(MANAGER)) {
    const start = m.index + m[0].length - m[1].length;
    const endRel = masked.slice(start).search(SEGMENT_END);
    const end = endRel === -1 ? masked.length : start + endRel;
    const [managerToken, ...words] = tokensOf(original, masked, start, end);
    const install = classify(m[1], managerToken.end, words);
    if (install)
      found.push({ ...install, cwd: lastCdBefore(original, masked, start) });
  }
  return found;
}

/**
 * Split a registry spec into name and version part, or null when `spec` is not a plain
 * registry package (git URL, GitHub shorthand, tarball, path, alias, shell variable).
 * @param {string} spec
 * @returns {{name: string, version: string} | null}
 */
export function parseSpec(spec) {
  const at = spec.indexOf("@", 1);
  const name = at === -1 ? spec : spec.slice(0, at);
  const version = at === -1 ? "" : spec.slice(at + 1);
  if (!NAME.test(name) || /[:/]/.test(version) || /\.tgz$/i.test(spec))
    return null;
  return { name, version };
}
