import { input } from "@inquirer/prompts";
import { execa } from "execa";
import fs from "node:fs";

(async () => {
  await loginToSupabase();
  const projectName = await input({
    message: "Enter the name of the project:",
    default: "Atomic CRM",
  });
  const databasePassword = await input({
    message: "Enter a database password:",
    default: generatePassword(16),
  });

  const projectRef = await createProject({ projectName, databasePassword });
  await waitForProjectToBeReady({ projectRef });

  // This also ensures the project is ready
  const { publishableKey, secretKey } = await fetchApiKeys({
    projectRef,
  });

  await linkProject({
    projectRef,
    databasePassword,
  });

  await setupDatabase({
    databasePassword,
  });

  await setupSupabaseSecrets({
    projectRef,
    publishableKey,
    secretKey,
  });

  await persistSupabaseEnv({
    projectRef,
    publishableKey,
  });
})();

async function loginToSupabase() {
  await execa("npx", ["supabase", "login"], { stdio: "inherit" });
}

async function createProject({ projectName, databasePassword }) {
  const { stdout } = await execa(
    "npx",
    [
      "supabase",
      "projects",
      "create",
      "--interactive",
      "--output",
      "json",
      "--db-password",
      databasePassword,
      projectName,
    ],
    {
      stdin: "inherit",
      stdout: ["inherit", "pipe"],
    },
  );

  try {
    const matchJSON = stdout.match(new RegExp("{.*}", "s"));
    if (!matchJSON) {
      throw new Error("Invalid JSON output");
    }
    const jsonOuput = JSON.parse(matchJSON[0]);
    return jsonOuput.id;
  } catch (e) {
    console.error("Failed to create project");
    console.error(e);
    throw e;
  }
}

async function waitForProjectToBeReady({ projectRef }) {
  console.log("Waiting for project to be ready...");
  const { stdout } = await execa(
    "npx",
    ["supabase", "projects", "list", "--output", "json"],
    {
      stdout: "pipe",
    },
  );

  try {
    // The response is an Array of objects
    const matchJSON = stdout.match(new RegExp("\\[.*\\]", "s"));
    if (!matchJSON) {
      throw new Error("Invalid JSON output");
    }
    const jsonOuput = JSON.parse(matchJSON[0]);
    const project = jsonOuput.find((project) => project.id === projectRef);
    if (project.status !== "ACTIVE_HEALTHY") {
      await sleep(1000);
      return waitForProjectToBeReady({ projectRef });
    }
  } catch (e) {
    console.error("Failed to create project");
    console.error(e);
    throw e;
  }
}

let retry = 0;
async function linkProject({ projectRef, databasePassword }) {
  await execa(
    "npx",
    [
      "supabase",
      "link",
      "--project-ref",
      projectRef,
      "--password",
      databasePassword,
    ],
    {
      stdout: "ignore",
      stderr: "ignore",
    },
  ).catch(() => {
    retry++;
    if (retry === 1) {
      console.log("Waiting for project to be ready...");
    }
    return sleep(1000).then(() =>
      linkProject({ projectRef, databasePassword }),
    );
  });
}

async function setupDatabase({ databasePassword }) {
  await execa(
    "npx",
    [
      "supabase",
      "db",
      "push",
      "--linked",
      "--include-roles",
      "--include-seed",
      "--password",
      databasePassword,
    ],
    {
      stdio: "inherit",
    },
  );
}

async function fetchApiKeys({ projectRef }) {
  let publishableKey = "";
  let secretKey = "";
  try {
    const { stdout, exitCode } = await execa(
      "npx",
      [
        "supabase",
        "projects",
        "api-keys",
        "--output",
        "json",
        "--project-ref",
        projectRef,
      ],
      {
        stdout: "pipe",
        stderr: "ignore",
      },
    );
    // If the exitCode is not 0, the command failed most probably because the project is not ready
    if (exitCode === 0) {
      // The response is an Array of objects
      const matchJSON = stdout.match(new RegExp("\\[.*\\]", "s"));
      if (!matchJSON) {
        throw new Error("Invalid JSON output");
      }
      const jsonOutput = JSON.parse(matchJSON[0]);

      // Prioritize the default publishable key, but any publishable key will work.
      publishableKey = jsonOutput.find(
        (key) => key.type === "publishable" && key.name === "default",
      )?.api_key;
      if (!publishableKey) {
        publishableKey = jsonOutput.find(
          (key) => key.type === "publishable",
        )?.api_key;
      }

      // Prioritize the default secret key, but any secret key will work.
      secretKey = jsonOutput.find(
        (key) => key.type === "secret" && key.name === "default",
      )?.api_key;
      if (!secretKey) {
        secretKey = jsonOutput.find((key) => key.type === "secret")?.api_key;
      }
    }
  } catch (e) {
    console.error("Failed to fetch API keys");
    console.error(e);
    throw e;
  }

  if (publishableKey === "" || secretKey === "") {
    await sleep(1000);
    return fetchApiKeys({ projectRef });
  }

  return { publishableKey, secretKey };
}

async function setupSupabaseSecrets({ projectRef, publishableKey, secretKey }) {
  await execa(
    "npx",
    [
      "supabase",
      "secrets",
      "set",
      `SB_PUBLISHABLE_KEY=${publishableKey}`,
      `SB_SECRET_KEY=${secretKey}`,
      "--project-ref",
      projectRef,
    ],
    {
      stdio: "inherit",
    },
  );
}

async function persistSupabaseEnv({ projectRef, publishableKey }) {
  fs.writeFileSync(
    `${process.cwd()}/.env.production.local`,
    `
VITE_SUPABASE_URL=https://${projectRef}.supabase.co
VITE_SB_PUBLISHABLE_KEY=${publishableKey}`,
    { flag: "a" },
  );
}

function generatePassword(length) {
  const password = crypto
    .getRandomValues(new BigUint64Array(4))
    .reduce(
      (prev, curr, index) =>
        (!index ? prev : prev.toString(36)) +
        (index % 2 ? curr.toString(36).toUpperCase() : curr.toString(36)),
    )
    .split("")
    .sort(() => 128 - crypto.getRandomValues(new Uint8Array(1))[0])
    .join("");

  if (length) {
    return password.slice(0, length);
  }

  return password;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
