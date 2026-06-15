import { spawnSync } from "node:child_process";

export function exec(file, args = [], opts = {}) {
  const r = spawnSync(file, args, { encoding: "utf8", ...opts });
  return {
    status: r.status ?? (r.error ? 1 : 0),
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    error: r.error,
  };
}

export function bash(cmd, opts = {}) {
  return exec("bash", ["-c", cmd], opts);
}
