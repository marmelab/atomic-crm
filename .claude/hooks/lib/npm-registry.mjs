// What the npm registry says about a package, and whether that is enough for an agent to
// add it without a human. `npm_config_registry` and HARNESS_NPM_DOWNLOADS_API point the
// lookups elsewhere (a mirror, or the test stub).

const DAY_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 1000;
const INSTALL_SCRIPTS = ["preinstall", "install", "postinstall"];
const EXACT = /^v?\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/;
const TAG = /^[a-z][\w.-]*$/i;

const trimSlash = (url) => url.replace(/\/+$/, "");
const registry = () =>
  trimSlash(process.env.npm_config_registry || "https://registry.npmjs.org");
const downloadsApi = () =>
  trimSlash(process.env.HARNESS_NPM_DOWNLOADS_API || "https://api.npmjs.org");

const fetchOnce = async (url, init) => {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json();
};

const getJson = async (url, init = {}) => {
  try {
    return await fetchOnce(url, init);
  } catch {
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    return fetchOnce(url, init);
  }
};

/**
 * The version a spec would install, as far as it can be told without semver: the
 * `latest` tag for a bare name, the version itself, or a tag. "" for a range.
 * @param {object} packument
 * @param {string} version  the part after `@`, possibly empty
 * @returns {string}
 */
export function targetVersion(packument, version) {
  const tags = packument["dist-tags"] ?? {};
  if (!version) return tags.latest ?? "";
  if (EXACT.test(version)) return version.replace(/^v/, "");
  if (TAG.test(version)) return tags[version] ?? version;
  return "";
}

/**
 * @param {string} name
 * @param {string} version
 * @returns {Promise<{packument: object | null, target?: string, weeklyDownloads?: number, advisories?: object[]}>}
 */
export async function fetchFacts(name, version) {
  const [packument, downloads] = await Promise.all([
    getJson(`${registry()}/${name.replace("/", "%2f")}`),
    getJson(`${downloadsApi()}/downloads/point/last-week/${name}`),
  ]);
  if (!packument) return { packument };
  const target = targetVersion(packument, version);
  const bulk =
    target && packument.versions?.[target]
      ? await getJson(`${registry()}/-/npm/v1/security/advisories/bulk`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ [name]: [target] }),
        })
      : null;
  return {
    packument,
    target,
    weeklyDownloads: downloads?.downloads ?? 0,
    advisories: bulk?.[name] ?? [],
  };
}

/**
 * Why an agent may not add this package under `policy`, or null when it may.
 * @param {Awaited<ReturnType<typeof fetchFacts>>} facts
 * @param {{minReleaseAgeDays: number, minWeeklyDownloads: number, blockingSeverities: string[]}} policy
 * @param {number} [now]
 * @returns {string | null}
 */
export function refusal(
  { packument, target, weeklyDownloads = 0, advisories = [] },
  policy,
  now = Date.now(),
) {
  if (!packument) return "does not exist on the npm registry";
  const ageDays = (now - Date.parse(packument.time?.created ?? "")) / DAY_MS;
  if (!(ageDays >= policy.minReleaseAgeDays))
    return `was first published less than ${policy.minReleaseAgeDays} days ago`;
  if (weeklyDownloads < policy.minWeeklyDownloads)
    return `has ${weeklyDownloads} downloads a week (minimum ${policy.minWeeklyDownloads})`;
  if (!target) return null;
  const manifest = packument.versions?.[target];
  if (!manifest) return `has no published version or tag \`${target}\``;
  if (manifest.deprecated)
    return `${target} is deprecated: ${manifest.deprecated}`;
  const script =
    INSTALL_SCRIPTS.find((k) => manifest.scripts?.[k]) ??
    (manifest.gypfile ? "node-gyp" : "");
  if (script) return `${target} runs an install script (\`${script}\`)`;
  const advisory = advisories.find((a) =>
    policy.blockingSeverities.includes(a.severity),
  );
  if (advisory)
    return `${target} has a ${advisory.severity} security advisory: ${advisory.title}`;
  return null;
}
