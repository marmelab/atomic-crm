import type { DataProvider } from "ra-core";
import { withSupabaseFilterAdapter } from "./supabaseAdapter";

describe("getList", () => {
  it("should transform '@eq'", async () => {
    const getList = vi.fn();
    const mockDataProvider = {
      getList,
    } as unknown as DataProvider;

    getList.mockResolvedValueOnce([{ id: 1 }]);

    const { getList: getListAdapter } =
      withSupabaseFilterAdapter(mockDataProvider);

    await expect(
      getListAdapter("resource", { filter: { "a@id@eq": "1" } }),
    ).resolves.toEqual([{ id: 1 }]);

    expect(getList).toHaveBeenCalledWith("resource", {
      filter: { "a@id_eq": "1" },
    });
  });

  it("should transform '@neq'", async () => {
    const getList = vi.fn();
    const mockDataProvider = {
      getList,
    } as unknown as DataProvider;

    getList.mockResolvedValueOnce([{ id: 1 }]);

    const { getList: getListAdapter } =
      withSupabaseFilterAdapter(mockDataProvider);

    await expect(
      getListAdapter("resource", { filter: { "a@id@neq": "1" } }),
    ).resolves.toEqual([{ id: 1 }]);

    expect(getList).toHaveBeenCalledWith("resource", {
      filter: { "a@id_neq": "1" },
    });
  });

  it("should transform '@eq'", async () => {
    const getList = vi.fn();
    const mockDataProvider = {
      getList,
    } as unknown as DataProvider;

    getList.mockResolvedValueOnce([{ id: 1 }]);

    const { getList: getListAdapter } =
      withSupabaseFilterAdapter(mockDataProvider);

    await expect(
      getListAdapter("resource", { filter: { "a@id@eq": "1" } }),
    ).resolves.toEqual([{ id: 1 }]);

    expect(getList).toHaveBeenCalledWith("resource", {
      filter: { "a@id_eq": "1" },
    });
  });

  it("should transform '@neq'", async () => {
    const getList = vi.fn();
    const mockDataProvider = {
      getList,
    } as unknown as DataProvider;

    getList.mockResolvedValueOnce([{ id: 1 }]);

    const { getList: getListAdapter } =
      withSupabaseFilterAdapter(mockDataProvider);

    await expect(
      getListAdapter("resource", { filter: { "a@id@neq": "1" } }),
    ).resolves.toEqual([{ id: 1 }]);

    expect(getList).toHaveBeenCalledWith("resource", {
      filter: { "a@id_neq": "1" },
    });
  });

  it("should transform '@is'", async () => {
    const getList = vi.fn();
    const mockDataProvider = {
      getList,
    } as unknown as DataProvider;

    getList.mockResolvedValueOnce([{ id: 1 }]);

    const { getList: getListAdapter } =
      withSupabaseFilterAdapter(mockDataProvider);

    await expect(
      getListAdapter("resource", { filter: { "id@is": null } }),
    ).resolves.toEqual([{ id: 1 }]);

    expect(getList).toHaveBeenCalledWith("resource", {
      filter: { id_eq: null },
    });
  });

  it("should transform '@not.is'", async () => {
    const getList = vi.fn();
    const mockDataProvider = {
      getList,
    } as unknown as DataProvider;

    getList.mockResolvedValueOnce([{ id: 1 }]);

    const { getList: getListAdapter } =
      withSupabaseFilterAdapter(mockDataProvider);

    await expect(
      getListAdapter("resource", { filter: { "id@not.is": null } }),
    ).resolves.toEqual([{ id: 1 }]);

    expect(getList).toHaveBeenCalledWith("resource", {
      filter: { id_neq: null },
    });
  });

  it("should transform '@lt'", async () => {
    const getList = vi.fn();
    const mockDataProvider = {
      getList,
    } as unknown as DataProvider;

    getList.mockResolvedValueOnce([{ id: 1 }]);

    const { getList: getListAdapter } =
      withSupabaseFilterAdapter(mockDataProvider);

    await expect(
      getListAdapter("resource", { filter: { "a@id@lt": "1" } }),
    ).resolves.toEqual([{ id: 1 }]);

    expect(getList).toHaveBeenCalledWith("resource", {
      filter: { "a@id_lt": "1" },
    });
  });

  it("should transform '@lte'", async () => {
    const getList = vi.fn();
    const mockDataProvider = {
      getList,
    } as unknown as DataProvider;

    getList.mockResolvedValueOnce([{ id: 1 }]);

    const { getList: getListAdapter } =
      withSupabaseFilterAdapter(mockDataProvider);

    await expect(
      getListAdapter("resource", { filter: { "a@id@lte": "1" } }),
    ).resolves.toEqual([{ id: 1 }]);

    expect(getList).toHaveBeenCalledWith("resource", {
      filter: { "a@id_lte": "1" },
    });
  });

  it("should transform '@gt'", async () => {
    const getList = vi.fn();
    const mockDataProvider = {
      getList,
    } as unknown as DataProvider;

    getList.mockResolvedValueOnce([{ id: 1 }]);

    const { getList: getListAdapter } =
      withSupabaseFilterAdapter(mockDataProvider);

    await expect(
      getListAdapter("resource", { filter: { "a@id@gt": "1" } }),
    ).resolves.toEqual([{ id: 1 }]);

    expect(getList).toHaveBeenCalledWith("resource", {
      filter: { "a@id_gt": "1" },
    });
  });

  it("should transform '@gte'", async () => {
    const getList = vi.fn();
    const mockDataProvider = {
      getList,
    } as unknown as DataProvider;

    getList.mockResolvedValueOnce([{ id: 1 }]);

    const { getList: getListAdapter } =
      withSupabaseFilterAdapter(mockDataProvider);

    await expect(
      getListAdapter("resource", { filter: { "a@id@gte": "1" } }),
    ).resolves.toEqual([{ id: 1 }]);

    expect(getList).toHaveBeenCalledWith("resource", {
      filter: { "a@id_gte": "1" },
    });
  });

  it("should transform '@in'", async () => {
    const getList = vi.fn();
    const mockDataProvider = {
      getList,
    } as unknown as DataProvider;

    getList.mockResolvedValueOnce([{ id: 1 }]);

    const { getList: getListAdapter } =
      withSupabaseFilterAdapter(mockDataProvider);

    await expect(
      getListAdapter("resource", { filter: { "id@in": "(1,2,a)" } }),
    ).resolves.toEqual([{ id: 1 }]);

    expect(getList).toHaveBeenCalledWith("resource", {
      filter: { id_eq_any: [1, 2, "a"] },
    });
  });

  it("should transform '@cs'", async () => {
    const getList = vi.fn();
    const mockDataProvider = {
      getList,
    } as unknown as DataProvider;

    getList.mockResolvedValueOnce([{ id: 1 }]);

    const { getList: getListAdapter } =
      withSupabaseFilterAdapter(mockDataProvider);

    await expect(
      getListAdapter("resource", { filter: { "tags@cs": "{1,2,a}" } }),
    ).resolves.toEqual([{ id: 1 }]);

    expect(getList).toHaveBeenCalledWith("resource", {
      filter: { tags: [1, 2, "a"] },
    });
  });

  it("should transform '@or'", async () => {
    const getList = vi.fn();
    const mockDataProvider = {
      getList,
    } as unknown as DataProvider;

    getList.mockResolvedValueOnce([{ id: 1 }]);

    const { getList: getListAdapter } =
      withSupabaseFilterAdapter(mockDataProvider);

    await expect(
      getListAdapter("resource", {
        filter: { "@or": { last_name: "one" } },
      }),
    ).resolves.toEqual([{ id: 1 }]);

    expect(getList).toHaveBeenCalledWith("resource", {
      filter: { q: "one" },
    });
  });

  it("should not transform a filter without operator", async () => {
    const getList = vi.fn();
    const mockDataProvider = {
      getList,
    } as unknown as DataProvider;

    getList.mockResolvedValueOnce([{ id: 1 }]);

    const { getList: getListAdapter } =
      withSupabaseFilterAdapter(mockDataProvider);

    await expect(
      getListAdapter("resource", { filter: { id: 1 } }),
    ).resolves.toEqual([{ id: 1 }]);

    expect(getList).toHaveBeenCalledWith("resource", {
      filter: { id: 1 },
    });
  });
});

describe("getManyReference", () => {
  it("should transform @eq", async () => {
    const getManyReference = vi.fn();
    const mockDataProvider = {
      getManyReference,
    } as unknown as DataProvider;

    getManyReference.mockResolvedValueOnce([{ id: 1 }]);

    const { getManyReference: getManyReferenceAdapter } =
      withSupabaseFilterAdapter(mockDataProvider);

    await expect(
      getManyReferenceAdapter("resource", {
        id: 1,
        target: "target",
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
        filter: { "a@id@eq": "2" },
      }),
    ).resolves.toEqual([{ id: 1 }]);

    expect(getManyReference).toHaveBeenCalledWith("resource", {
      id: 1,
      target: "target",
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
      filter: { "a@id_eq": "2" },
    });
  });

  it("should transform @neq", async () => {
    const getManyReference = vi.fn();
    const mockDataProvider = {
      getManyReference,
    } as unknown as DataProvider;

    getManyReference.mockResolvedValueOnce([{ id: 1 }]);

    const { getManyReference: getManyReferenceAdapter } =
      withSupabaseFilterAdapter(mockDataProvider);

    await expect(
      getManyReferenceAdapter("resource", {
        id: 1,
        target: "target",
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
        filter: { "a@id@neq": "2" },
      }),
    ).resolves.toEqual([{ id: 1 }]);

    expect(getManyReference).toHaveBeenCalledWith("resource", {
      id: 1,
      target: "target",
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
      filter: { "a@id_neq": "2" },
    });
  });

  it("should transform @is", async () => {
    const getManyReference = vi.fn();
    const mockDataProvider = {
      getManyReference,
    } as unknown as DataProvider;

    getManyReference.mockResolvedValueOnce([{ id: 1 }]);

    const { getManyReference: getManyReferenceAdapter } =
      withSupabaseFilterAdapter(mockDataProvider);

    await expect(
      getManyReferenceAdapter("resource", {
        id: 1,
        target: "target",
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
        filter: { "id@is": null },
      }),
    ).resolves.toEqual([{ id: 1 }]);

    expect(getManyReference).toHaveBeenCalledWith("resource", {
      id: 1,
      target: "target",
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
      filter: { id_eq: null },
    });
  });

  it("should transform @not.is", async () => {
    const getManyReference = vi.fn();
    const mockDataProvider = {
      getManyReference,
    } as unknown as DataProvider;

    getManyReference.mockResolvedValueOnce([{ id: 1 }]);

    const { getManyReference: getManyReferenceAdapter } =
      withSupabaseFilterAdapter(mockDataProvider);

    await expect(
      getManyReferenceAdapter("resource", {
        id: 1,
        target: "target",
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
        filter: { "id@not.is": null },
      }),
    ).resolves.toEqual([{ id: 1 }]);

    expect(getManyReference).toHaveBeenCalledWith("resource", {
      id: 1,
      target: "target",
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
      filter: { id_neq: null },
    });
  });

  it("should transform @lt", async () => {
    const getManyReference = vi.fn();
    const mockDataProvider = {
      getManyReference,
    } as unknown as DataProvider;

    getManyReference.mockResolvedValueOnce([{ id: 1 }]);

    const { getManyReference: getManyReferenceAdapter } =
      withSupabaseFilterAdapter(mockDataProvider);

    await expect(
      getManyReferenceAdapter("resource", {
        id: 1,
        target: "target",
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
        filter: { "a@id@lt": "2" },
      }),
    ).resolves.toEqual([{ id: 1 }]);

    expect(getManyReference).toHaveBeenCalledWith("resource", {
      id: 1,
      target: "target",
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
      filter: { "a@id_lt": "2" },
    });
  });

  it("should transform @lte", async () => {
    const getManyReference = vi.fn();
    const mockDataProvider = {
      getManyReference,
    } as unknown as DataProvider;

    getManyReference.mockResolvedValueOnce([{ id: 1 }]);

    const { getManyReference: getManyReferenceAdapter } =
      withSupabaseFilterAdapter(mockDataProvider);

    await expect(
      getManyReferenceAdapter("resource", {
        id: 1,
        target: "target",
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
        filter: { "a@id@lte": "2" },
      }),
    ).resolves.toEqual([{ id: 1 }]);

    expect(getManyReference).toHaveBeenCalledWith("resource", {
      id: 1,
      target: "target",
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
      filter: { "a@id_lte": "2" },
    });
  });

  it("should transform @gt", async () => {
    const getManyReference = vi.fn();
    const mockDataProvider = {
      getManyReference,
    } as unknown as DataProvider;

    getManyReference.mockResolvedValueOnce([{ id: 1 }]);

    const { getManyReference: getManyReferenceAdapter } =
      withSupabaseFilterAdapter(mockDataProvider);

    await expect(
      getManyReferenceAdapter("resource", {
        id: 1,
        target: "target",
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
        filter: { "a@id@gt": "2" },
      }),
    ).resolves.toEqual([{ id: 1 }]);

    expect(getManyReference).toHaveBeenCalledWith("resource", {
      id: 1,
      target: "target",
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
      filter: { "a@id_gt": "2" },
    });
  });

  it("should transform @gte", async () => {
    const getManyReference = vi.fn();
    const mockDataProvider = {
      getManyReference,
    } as unknown as DataProvider;

    getManyReference.mockResolvedValueOnce([{ id: 1 }]);

    const { getManyReference: getManyReferenceAdapter } =
      withSupabaseFilterAdapter(mockDataProvider);

    await expect(
      getManyReferenceAdapter("resource", {
        id: 1,
        target: "target",
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
        filter: { "a@id@gte": "2" },
      }),
    ).resolves.toEqual([{ id: 1 }]);

    expect(getManyReference).toHaveBeenCalledWith("resource", {
      id: 1,
      target: "target",
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
      filter: { "a@id_gte": "2" },
    });
  });

  it("should transform '@in'", async () => {
    const getManyReference = vi.fn();
    const mockDataProvider = {
      getManyReference,
    } as unknown as DataProvider;

    getManyReference.mockResolvedValueOnce([{ id: 1 }]);

    const { getManyReference: getManyReferenceAdapter } =
      withSupabaseFilterAdapter(mockDataProvider);

    await expect(
      getManyReferenceAdapter("resource", {
        id: 1,
        target: "target",
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
        filter: { "id@in": "(1,2,a)" },
      }),
    ).resolves.toEqual([{ id: 1 }]);

    expect(getManyReference).toHaveBeenCalledWith("resource", {
      id: 1,
      target: "target",
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
      filter: { id_eq_any: [1, 2, "a"] },
    });
  });

  it("should transform '@cs'", async () => {
    const getManyReference = vi.fn();
    const mockDataProvider = {
      getManyReference,
    } as unknown as DataProvider;

    getManyReference.mockResolvedValueOnce([{ id: 1 }]);

    const { getManyReference: getManyReferenceAdapter } =
      withSupabaseFilterAdapter(mockDataProvider);

    await expect(
      getManyReferenceAdapter("resource", {
        id: 1,
        target: "target",
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
        filter: { "tags@cs": "{1,2,a}" },
      }),
    ).resolves.toEqual([{ id: 1 }]);

    expect(getManyReference).toHaveBeenCalledWith("resource", {
      id: 1,
      target: "target",
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
      filter: { tags: [1, 2, "a"] },
    });
  });

  it("should transform '@or'", async () => {
    const getManyReference = vi.fn();
    const mockDataProvider = {
      getManyReference,
    } as unknown as DataProvider;

    getManyReference.mockResolvedValueOnce([{ id: 1 }]);

    const { getManyReference: getManyReferenceAdapter } =
      withSupabaseFilterAdapter(mockDataProvider);

    await expect(
      getManyReferenceAdapter("resource", {
        id: 1,
        target: "target",
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
        filter: { "@or": { last_name: "one" } },
      }),
    ).resolves.toEqual([{ id: 1 }]);

    expect(getManyReference).toHaveBeenCalledWith("resource", {
      id: 1,
      target: "target",
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
      filter: { q: "one" },
    });
  });

  it("should not transform a filter without operator", async () => {
    const getManyReference = vi.fn();
    const mockDataProvider = {
      getManyReference,
    } as unknown as DataProvider;

    getManyReference.mockResolvedValueOnce([{ id: 1 }]);

    const { getManyReference: getManyReferenceAdapter } =
      withSupabaseFilterAdapter(mockDataProvider);

    await expect(
      getManyReferenceAdapter("resource", {
        id: 1,
        target: "target",
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
        filter: { id: 2 },
      }),
    ).resolves.toEqual([{ id: 1 }]);

    expect(getManyReference).toHaveBeenCalledWith("resource", {
      id: 1,
      target: "target",
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
      filter: { id: 2 },
    });
  });
});

it("should remove summary suffix", async () => {
  const getOne = vi.fn();
  const getList = vi.fn();
  const getMany = vi.fn();
  const getManyReference = vi.fn();
  const create = vi.fn();
  const del = vi.fn();
  const deleteMany = vi.fn();
  const update = vi.fn();
  const updateMany = vi.fn();

  const dataProvider: DataProvider = withSupabaseFilterAdapter({
    getOne,
    getList,
    getMany,
    getManyReference,
    create,
    delete: del,
    deleteMany,
    update,
    updateMany,
  });

  await expect(
    Promise.all([
      dataProvider.getOne("resource_summary", { id: 1 }),
      dataProvider.getList("resource_summary", {
        pagination: { page: 1, perPage: 10 },
      }),
      dataProvider.getMany("resource_summary", { ids: [1] }),
      dataProvider.getManyReference("resource_summary", {
        id: 1,
        target: "target",
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
        filter: {},
      }),
      dataProvider.create("resource_summary", { data: {} }),
      dataProvider.delete("resource_summary", { id: 1 }),
      dataProvider.deleteMany("resource_summary", { ids: [1] }),
      dataProvider.update("resource_summary", {
        id: 1,
        data: {},
        previousData: {},
      }),
      dataProvider.updateMany("resource_summary", { ids: [1], data: {} }),
    ]),
  ).resolves.toHaveLength(9);

  expect(getOne).toHaveBeenCalledWith("resource", { id: 1 });
  expect(getList).toHaveBeenCalledWith("resource", {
    pagination: { page: 1, perPage: 10 },
    filter: undefined,
  });
  expect(getMany).toHaveBeenCalledWith("resource", { ids: [1] });
  expect(getManyReference).toHaveBeenCalledWith("resource", {
    id: 1,
    target: "target",
    pagination: { page: 1, perPage: 10 },
    sort: { field: "id", order: "ASC" },
    filter: {},
  });
  expect(create).toHaveBeenCalledWith("resource", { data: {} });
  expect(del).toHaveBeenCalledWith("resource", { id: 1 });
  expect(deleteMany).toHaveBeenCalledWith("resource", { ids: [1] });
  expect(update).toHaveBeenCalledWith("resource", {
    id: 1,
    data: {},
    previousData: {},
  });
  expect(updateMany).toHaveBeenCalledWith("resource", { ids: [1], data: {} });
});
