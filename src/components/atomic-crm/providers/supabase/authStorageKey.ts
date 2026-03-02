export function buildSupabaseAuthStorageKey(instanceUrl: string) {
  const { hostname, port } = new URL(instanceUrl);
  const hostnameLabel =
    hostname
      .split(".")[0]
      ?.replace(/[^a-z0-9_-]/gi, "_")
      .toLowerCase() ?? "supabase";
  const scope = port ? `${hostnameLabel}-${port}` : hostnameLabel;

  return `sb-${scope}-auth-token`;
}
