/**
 * Creates one record per row and reports how many actually landed.
 *
 * `Promise.all` would reject on the first row the database refuses while the
 * other creates have already fired, so `usePapaParse` counted a whole batch as
 * failed even though most of its records existed — users then fixed the file
 * and re-imported, duplicating everything that had gone through. Settling every
 * create instead keeps the report in line with what was written.
 */
export const createEachRow = async (
  creates: Promise<unknown>[],
): Promise<number> => {
  const results = await Promise.allSettled(creates);
  const rejected = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  for (const { reason } of rejected) {
    console.error("Failed to import a row", reason);
  }
  return results.length - rejected.length;
};
