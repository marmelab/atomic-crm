import { DataProvider } from 'react-admin';
import { withSupabaseFilterAdapter } from './supabaseAdapter';

describe('getList', () => {
    it("should transform '@in'", () => {
        const getList = jest.fn();
        const mockDataProvider = {
            getList,
        } as unknown as DataProvider;

        getList.mockResolvedValueOnce([{ id: 1 }]);

        const { getList: getListAdapter } =
            withSupabaseFilterAdapter(mockDataProvider);

        expect(
            getListAdapter('resource', { filter: { 'id@in': '(1,2,a)' } })
        ).resolves.toEqual([{ id: 1 }]);

        expect(getList).toHaveBeenCalledWith('resource', {
            filter: { id_eq_any: [1, 2, 'a'] },
        });
    });

    it("should transform '@cs'", () => {
        const getList = jest.fn();
        const mockDataProvider = {
            getList,
        } as unknown as DataProvider;

        getList.mockResolvedValueOnce([{ id: 1 }]);

        const { getList: getListAdapter } =
            withSupabaseFilterAdapter(mockDataProvider);

        expect(
            getListAdapter('resource', { filter: { 'tags@cs': '{1,2,a}' } })
        ).resolves.toEqual([{ id: 1 }]);

        expect(getList).toHaveBeenCalledWith('resource', {
            filter: { tags: [1, 2, 'a'] },
        });
    });

    it('should not transform a filter without operator', () => {
        const getList = jest.fn();
        const mockDataProvider = {
            getList,
        } as unknown as DataProvider;

        getList.mockResolvedValueOnce([{ id: 1 }]);

        const { getList: getListAdapter } =
            withSupabaseFilterAdapter(mockDataProvider);

        expect(
            getListAdapter('resource', { filter: { id: 1 } })
        ).resolves.toEqual([{ id: 1 }]);

        expect(getList).toHaveBeenCalledWith('resource', {
            filter: { id: 1 },
        });
    });
});

describe('getManyReference', () => {
    it("should transform '@in'", () => {
        const getManyReference = jest.fn();
        const mockDataProvider = {
            getManyReference,
        } as unknown as DataProvider;

        getManyReference.mockResolvedValueOnce([{ id: 1 }]);

        const { getManyReference: getManyReferenceAdapter } =
            withSupabaseFilterAdapter(mockDataProvider);

        expect(
            getManyReferenceAdapter('resource', {
                id: 1,
                target: 'target',
                pagination: { page: 1, perPage: 10 },
                sort: { field: 'id', order: 'ASC' },
                filter: { 'id@in': '(1,2,a)' },
            })
        ).resolves.toEqual([{ id: 1 }]);

        expect(getManyReference).toHaveBeenCalledWith('resource', {
            id: 1,
            target: 'target',
            pagination: { page: 1, perPage: 10 },
            sort: { field: 'id', order: 'ASC' },
            filter: { id_eq_any: [1, 2, 'a'] },
        });
    });

    it("should transform '@cs'", () => {
        const getManyReference = jest.fn();
        const mockDataProvider = {
            getManyReference,
        } as unknown as DataProvider;

        getManyReference.mockResolvedValueOnce([{ id: 1 }]);

        const { getManyReference: getManyReferenceAdapter } =
            withSupabaseFilterAdapter(mockDataProvider);

        expect(
            getManyReferenceAdapter('resource', {
                id: 1,
                target: 'target',
                pagination: { page: 1, perPage: 10 },
                sort: { field: 'id', order: 'ASC' },
                filter: { 'tags@cs': '{1,2,a}' },
            })
        ).resolves.toEqual([{ id: 1 }]);

        expect(getManyReference).toHaveBeenCalledWith('resource', {
            id: 1,
            target: 'target',
            pagination: { page: 1, perPage: 10 },
            sort: { field: 'id', order: 'ASC' },
            filter: { tags: [1, 2, 'a'] },
        });
    });

    it('should not transform a filter without operator', () => {
        const getManyReference = jest.fn();
        const mockDataProvider = {
            getManyReference,
        } as unknown as DataProvider;

        getManyReference.mockResolvedValueOnce([{ id: 1 }]);

        const { getManyReference: getManyReferenceAdapter } =
            withSupabaseFilterAdapter(mockDataProvider);

        expect(
            getManyReferenceAdapter('resource', {
                id: 1,
                target: 'target',
                pagination: { page: 1, perPage: 10 },
                sort: { field: 'id', order: 'ASC' },
                filter: { id: 2 },
            })
        ).resolves.toEqual([{ id: 1 }]);

        expect(getManyReference).toHaveBeenCalledWith('resource', {
            id: 1,
            target: 'target',
            pagination: { page: 1, perPage: 10 },
            sort: { field: 'id', order: 'ASC' },
            filter: { id: 2 },
        });
    });
});
