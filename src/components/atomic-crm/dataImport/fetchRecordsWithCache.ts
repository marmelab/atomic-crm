import type { DataProvider } from "ra-core";

/**
 * Resolve records by name, creating the missing ones, and memoize them in the
 * given cache to avoid creating the same record twice and to save roundtrips
 * across the batches of a single import.
 */
export const fetchRecordsWithCache = async function <T>(
  resource: string,
  cache: Map<string, T>,
  names: string[],
  getCreateData: (name: string) => Partial<T>,
  dataProvider: DataProvider,
) {
  const trimmedNames = [...new Set(names.map((name) => name.trim()))];
  const uncachedRecordNames = trimmedNames.filter((name) => !cache.has(name));

  // check the backend for existing records, across pages since names are not
  // unique and duplicates of one name can fill a page
  const perPage = trimmedNames.length;
  for (let page = 1; uncachedRecordNames.length > 0; page++) {
    const response = await dataProvider.getList(resource, {
      filter: {
        "name@in": `(${uncachedRecordNames
          .map((name) => `"${name}"`)
          .join(",")})`,
      },
      pagination: { page, perPage },
      sort: { field: "id", order: "ASC" },
    });
    for (const record of response.data) {
      const name = record.name.trim();
      if (!cache.has(name)) cache.set(name, record);
    }
    if (
      response.data.length < perPage ||
      uncachedRecordNames.every((name) => cache.has(name))
    ) {
      break;
    }
  }

  // create missing records in parallel
  await Promise.all(
    uncachedRecordNames.map(async (name) => {
      if (cache.has(name)) return;
      const response = await dataProvider.create(resource, {
        data: getCreateData(name),
      });
      cache.set(name, response.data);
    }),
  );

  // now all records are in cache, return a map of all records
  return trimmedNames.reduce((acc, name) => {
    acc.set(name, cache.get(name) as T);
    return acc;
  }, new Map<string, T>());
};
