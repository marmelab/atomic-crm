import {
  withLifecycleCallbacks,
  type DataProvider,
  type GetListParams,
  type Identifier,
  type ResourceCallbacks,
} from "ra-core";
import type {
  ContactNote,
  Deal,
  DealNote,
  RAFile,
  Sale,
  SalesFormData,
  SignUpData,
} from "../../types";
import type { ConfigurationContextValue } from "../../root/ConfigurationContext";
import { getActivityLog } from "../commons/activity";
import { mergeContacts as mergeContactsCommon } from "../commons/mergeContacts";
import { cacheCurrentSale, getIsInitialized } from "./authProvider";
import { baseDataProvider } from "./internal/httpClient";

// --- Attachment / image handling -------------------------------------------
// Supabase Storage is replaced by base64-in-database storage: uploaded files
// are inlined as data URLs (single-user personal deployment, no object store).

const fileToBase64 = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const processRAFile = async (fi: RAFile): Promise<RAFile> => {
  if (fi?.rawFile instanceof File) {
    const src = await fileToBase64(fi.rawFile);
    return { ...fi, src, type: fi.rawFile.type };
  }
  return fi;
};

const processConfigLogo = async (logo: any): Promise<string> => {
  if (typeof logo === "string") return logo;
  if (logo?.rawFile instanceof File) {
    return await fileToBase64(logo.rawFile);
  }
  return logo?.src ?? "";
};

const processCompanyLogo = async (params: any) => {
  const logo = params.data.logo;
  if (logo?.rawFile instanceof File) {
    const src = await fileToBase64(logo.rawFile);
    return {
      ...params,
      data: {
        ...params.data,
        logo: { src, title: logo.title, type: logo.rawFile.type },
      },
    };
  }
  return params;
};

// --- Data provider ----------------------------------------------------------

const getDataProviderWithCustomMethods = () => {
  return {
    ...baseDataProvider,
    async getList(resource: string, params: GetListParams) {
      if (resource === "companies") {
        return baseDataProvider.getList("companies_summary", params);
      }
      if (resource === "contacts") {
        return baseDataProvider.getList("contacts_summary", params);
      }
      if (resource === "activity_log") {
        const { filter = {}, pagination } = params;
        const all = await getActivityLog(
          baseDataProvider,
          filter.company_id,
          filter.sales_id,
        );
        const { page = 1, perPage = 25 } = pagination ?? {};
        const start = (page - 1) * perPage;
        return {
          data: all.slice(start, start + perPage) as any[],
          total: all.length,
        };
      }
      return baseDataProvider.getList(resource, params);
    },
    async getOne(resource: string, params: any) {
      if (resource === "companies") {
        return baseDataProvider.getOne("companies_summary", params);
      }
      if (resource === "contacts") {
        return baseDataProvider.getOne("contacts_summary", params);
      }
      return baseDataProvider.getOne(resource, params);
    },

    async signUp({ email, password, first_name, last_name }: SignUpData) {
      const initialized = await getIsInitialized();
      const { data: sale } = await baseDataProvider.create<Sale>("sales", {
        data: {
          email,
          first_name,
          last_name,
          administrator: !initialized, // the first user is the administrator
          disabled: false,
          user_id: crypto.randomUUID(),
        } as Partial<Sale>,
      });
      cacheCurrentSale(sale);
      return { id: sale.id, email, password };
    },
    async salesCreate(body: SalesFormData) {
      const avatar = body.avatar
        ? await processRAFile(
            typeof body.avatar === "string"
              ? ({ src: body.avatar } as RAFile)
              : (body.avatar as RAFile),
          )
        : undefined;
      const { data } = await baseDataProvider.create<Sale>("sales", {
        data: {
          email: body.email,
          first_name: body.first_name,
          last_name: body.last_name,
          administrator: body.administrator ?? false,
          disabled: body.disabled ?? false,
          avatar,
          user_id: crypto.randomUUID(),
        } as Partial<Sale>,
      });
      return data;
    },
    async salesUpdate(
      id: Identifier,
      data: Partial<Omit<SalesFormData, "password">>,
    ) {
      const { avatar, ...rest } = data as any;
      const patch: Record<string, unknown> = { ...rest };
      if (avatar) {
        patch.avatar = await processRAFile(
          typeof avatar === "string" ? ({ src: avatar } as RAFile) : avatar,
        );
      }
      const { data: updated } = await baseDataProvider.update<Sale>("sales", {
        id,
        data: patch,
        previousData: { id } as Sale,
      });
      return updated;
    },
    async updatePassword(_id: Identifier) {
      // No real authentication in this deployment: nothing to reset.
      return true;
    },
    async unarchiveDeal(deal: Deal) {
      const { data: deals } = await baseDataProvider.getList<Deal>("deals", {
        filter: { stage: deal.stage },
        pagination: { page: 1, perPage: 1000 },
        sort: { field: "index", order: "ASC" },
      });

      const updatedDeals = deals.map((d, index) => ({
        ...d,
        index: d.id === deal.id ? 0 : index + 1,
        archived_at: d.id === deal.id ? null : d.archived_at,
      }));

      return await Promise.all(
        updatedDeals.map((updatedDeal) =>
          baseDataProvider.update("deals", {
            id: updatedDeal.id,
            data: updatedDeal,
            previousData: deals.find((d) => d.id === updatedDeal.id),
          }),
        ),
      );
    },
    async isInitialized() {
      return getIsInitialized();
    },
    async mergeContacts(sourceId: Identifier, targetId: Identifier) {
      return mergeContactsCommon(sourceId, targetId, baseDataProvider);
    },
    async getConfiguration(): Promise<ConfigurationContextValue> {
      const { data } = await baseDataProvider.getOne("configuration", {
        id: 1,
      });
      return (data?.config as ConfigurationContextValue) ?? {};
    },
    async updateConfiguration(
      config: ConfigurationContextValue,
    ): Promise<ConfigurationContextValue> {
      const { data } = await baseDataProvider.update("configuration", {
        id: 1,
        data: { config },
        previousData: { id: 1 },
      });
      return data.config as ConfigurationContextValue;
    },
  } satisfies DataProvider;
};

export type CrmDataProvider = ReturnType<
  typeof getDataProviderWithCustomMethods
>;

const lifeCycleCallbacks: ResourceCallbacks[] = [
  {
    resource: "configuration",
    beforeUpdate: async (params) => {
      const config = params.data.config;
      if (config) {
        config.lightModeLogo = await processConfigLogo(config.lightModeLogo);
        config.darkModeLogo = await processConfigLogo(config.darkModeLogo);
      }
      return params;
    },
  },
  {
    resource: "contact_notes",
    beforeSave: async (data: ContactNote, _, __) => {
      if (data.attachments) {
        data.attachments = await Promise.all(
          data.attachments.map((fi) => processRAFile(fi)),
        );
      }
      return data;
    },
  },
  {
    resource: "deal_notes",
    beforeSave: async (data: DealNote, _, __) => {
      if (data.attachments) {
        data.attachments = await Promise.all(
          data.attachments.map((fi) => processRAFile(fi)),
        );
      }
      return data;
    },
  },
  {
    resource: "sales",
    beforeSave: async (data: Sale, _, __) => {
      if (data.avatar) {
        data.avatar = await processRAFile(data.avatar as RAFile);
      }
      return data;
    },
  },
  {
    resource: "contacts",
    beforeGetList: async (params) => {
      return applyFullTextSearch([
        "first_name",
        "last_name",
        "company_name",
        "title",
        "email",
        "phone",
        "background",
      ])(params);
    },
  },
  {
    resource: "companies",
    beforeGetList: async (params) => {
      return applyFullTextSearch([
        "name",
        "phone_number",
        "website",
        "zipcode",
        "city",
        "state_abbr",
      ])(params);
    },
    beforeCreate: async (params) => {
      const createParams = await processCompanyLogo(params);
      return {
        ...createParams,
        data: {
          created_at: new Date().toISOString(),
          ...createParams.data,
        },
      };
    },
    beforeUpdate: async (params) => {
      return await processCompanyLogo(params);
    },
  },
  {
    resource: "contacts_summary",
    beforeGetList: async (params) => {
      return applyFullTextSearch(["first_name", "last_name"])(params);
    },
  },
  {
    resource: "deals",
    beforeGetList: async (params) => {
      return applyFullTextSearch(["name", "category", "description"])(params);
    },
  },
];

export const getDataProvider = (): CrmDataProvider => {
  return withLifecycleCallbacks(
    getDataProviderWithCustomMethods(),
    lifeCycleCallbacks,
  ) as CrmDataProvider;
};

const applyFullTextSearch = (columns: string[]) => (params: GetListParams) => {
  if (!params.filter?.q) {
    return params;
  }
  const { q, ...filter } = params.filter;
  return {
    ...params,
    filter: {
      ...filter,
      "@or": columns.reduce((acc, column) => {
        if (column === "email")
          return {
            ...acc,
            [`email_fts@ilike`]: q,
          };
        if (column === "phone")
          return {
            ...acc,
            [`phone_fts@ilike`]: q,
          };
        else
          return {
            ...acc,
            [`${column}@ilike`]: q,
          };
      }, {}),
    },
  };
};
