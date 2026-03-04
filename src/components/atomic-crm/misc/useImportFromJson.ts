import { useState } from "react";
import {
  type Identifier,
  useDataProvider,
  useEvent,
  useGetIdentity,
  useRefresh,
} from "ra-core";
import { JSONParser, type JsonTypes } from "@streamparser/json-whatwg";
import mime from "mime/lite";
import type { CrmDataProvider } from "../providers/types";
import type { RAFile, Tag } from "../types";
import { colors } from "../tags/colors";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { contactGender } from "../contacts/contactGender";

export type ImportFromJsonStats = {
  sales: number;
  companies: number;
  contacts: number;
  notes: number;
  tasks: number;
};

export type ImportFromJsonFailures = {
  sales: Array<JsonTypes.JsonPrimitive | JsonTypes.JsonStruct | undefined>;
  companies: Array<JsonTypes.JsonPrimitive | JsonTypes.JsonStruct | undefined>;
  contacts: Array<JsonTypes.JsonPrimitive | JsonTypes.JsonStruct | undefined>;
  notes: Array<JsonTypes.JsonPrimitive | JsonTypes.JsonStruct | undefined>;
  tasks: Array<JsonTypes.JsonPrimitive | JsonTypes.JsonStruct | undefined>;
};

export type ImportFromJsonIdleState = {
  status: "idle";
  error: null;
  stats: ImportFromJsonStats;
  failedImports: ImportFromJsonFailures;
};

export type ImportFromJsonImportingState = {
  status: "importing";
  stats: ImportFromJsonStats;
  error: null;
  failedImports: ImportFromJsonFailures;
};

export type ImportFromJsonErrorState = {
  status: "error";
  error: Error;
  stats: ImportFromJsonStats;
  failedImports: ImportFromJsonFailures;
  duration: number;
};

export type ImportFromJsonSuccessState = {
  status: "success";
  stats: ImportFromJsonStats;
  error: null;
  failedImports: ImportFromJsonFailures;
  duration: number;
};

export type ImportFromJsonState =
  | ImportFromJsonErrorState
  | ImportFromJsonIdleState
  | ImportFromJsonImportingState
  | ImportFromJsonSuccessState;

export type ImportFromJsonFunction = (file: File) => Promise<void>;
type ResetFunction = () => void;

const defaultFailedImports = {
  sales: [],
  companies: [],
  contacts: [],
  notes: [],
  tasks: [],
};

const defaultStats = {
  sales: 0,
  companies: 0,
  contacts: 0,
  notes: 0,
  tasks: 0,
};

/**
 * A hook that returns a function to import data from a JSON file.
 * We do the import on the client because edge functions are limited in both execution time and memory.
 */
export const useImportFromJson = (): [
  ImportFromJsonState,
  ImportFromJsonFunction,
  ResetFunction,
] => {
  const { data: currentSale } = useGetIdentity();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const refresh = useRefresh();
  const { companySectors } = useConfigurationContext();
  const [state, setState] = useState<ImportFromJsonState>({
    status: "idle",
    error: null,
    stats: defaultStats,
    failedImports: defaultFailedImports,
  });

  const reset = useEvent(() => {
    setState({
      status: "idle",
      error: null,
      stats: defaultStats,
      failedImports: defaultFailedImports,
    });
  });

  const importFile = useEvent(async (file: File) => {
    if (currentSale == null) {
      throw new Error("Importing data requires to be authenticated");
    }
    const startedAt = new Date();

    setState({
      status: "importing",
      stats: defaultStats,
      failedImports: defaultFailedImports,
      error: null,
    });

    const idsMaps: {
      sales: Record<number, Identifier>;
      companies: Record<number, Identifier>;
      contacts: Record<number, Identifier>;
      tags: Record<string, Identifier>;
    } = {
      sales: {},
      companies: {},
      contacts: {},
      tags: {},
    };

    const importSale = async (
      dataToImport: JsonTypes.JsonPrimitive | JsonTypes.JsonStruct | undefined,
    ) => {
      try {
        if (!isSale(dataToImport)) {
          throw new Error(`Error while importing sale: Invalid data`);
        }
        const existingRecordResponse = await dataProvider.getList("sales", {
          filter: { email: dataToImport.email.trim() },
          pagination: { page: 1, perPage: 1 },
          sort: { field: "id", order: "ASC" },
        });
        if (existingRecordResponse.total === 1) {
          idsMaps.sales[dataToImport.id] = existingRecordResponse.data[0].id;
          return existingRecordResponse.data[0].id;
        }

        const data = await dataProvider.salesCreate({
          email: dataToImport.email.trim(),
          first_name: dataToImport.first_name.trim(),
          last_name: dataToImport.last_name.trim(),
          administrator: false,
          disabled: false,
        });

        idsMaps.sales[dataToImport.id] = data.id;
        setState((old) => {
          if (old.status === "error") {
            return {
              ...old,
              stats: {
                ...(old.stats ?? defaultStats),
                sales: (old.stats ?? defaultStats).sales + 1,
              },
            };
          }
          return {
            ...old,
            status: "importing",
            stats: {
              ...(old.stats ?? defaultStats),
              sales: (old.stats ?? defaultStats).sales + 1,
            },
            error: null,
          };
        });
        return data;
      } catch (err) {
        const duration = new Date().valueOf() - startedAt.valueOf();
        setState((old) => ({
          ...old,
          status: "error",
          error: new Error(
            `Error while importing sale: ${(err as Error).message}`,
          ),
          failedImports: {
            ...old.failedImports,
            sales: [
              ...old.failedImports.sales,
              { ...(dataToImport as any), error: (err as Error).message },
            ],
          },
          duration,
        }));
      }
    };

    const importCompany = async (
      dataToImport: JsonTypes.JsonPrimitive | JsonTypes.JsonStruct | undefined,
    ) => {
      if (!isCompany(dataToImport)) {
        setState((old) => ({
          ...old,
          status: "importing",
          error: null,
          failedImports: {
            ...old.failedImports,
            companies: [
              ...old.failedImports.companies,
              { ...(dataToImport as any), error: "Invalid format" },
            ],
          },
        }));
        return;
      }
      try {
        // Validate sector against configuration
        const sector = dataToImport.sector?.trim();
        if (sector && !companySectors.some((s) => s.value === sector)) {
          setState((old) => ({
            ...old,
            status: "importing",
            error: null,
            failedImports: {
              ...old.failedImports,
              companies: [
                ...old.failedImports.companies,
                {
                  ...(dataToImport as any),
                  error: `Invalid sector "${sector}". Must be one of: ${companySectors.map((s) => s.value).join(", ")}`,
                },
              ],
            },
          }));
          return;
        }

        const { data } = await dataProvider.create("companies", {
          data: {
            name: dataToImport.name.trim(),
            description: dataToImport.description?.trim(),
            city: dataToImport.city?.trim(),
            country: dataToImport.country?.trim(),
            address: dataToImport.address?.trim(),
            zipcode: dataToImport.zipcode?.trim(),
            state_abbr: dataToImport.state_abbr?.trim(),
            sector: sector || undefined,
            size: dataToImport.size
              ? mapSizeToCategory(dataToImport.size)
              : undefined,
            linkedin_url: dataToImport.linkedin_url?.trim(),
            website: dataToImport.website?.trim(),
            phone_number: dataToImport.phone_number?.trim(),
            revenue: dataToImport.revenue?.trim(),
            tax_identifier: dataToImport.tax_identifier?.trim(),
            context_links: Array.isArray(dataToImport.context_links)
              ? dataToImport.context_links
              : undefined,
            sales_id: dataToImport.sales_id
              ? idsMaps.sales[dataToImport.sales_id]
              : currentSale.id,
            created_at: dataToImport.created_at,
          },
        });

        idsMaps.companies[dataToImport.id] = data.id;
        setState((old) => ({
          ...old,
          status: "importing",
          stats: {
            ...old.stats,
            companies: old.stats.companies + 1,
          },
          error: null,
        }));
        return data;
      } catch (err) {
        console.error(err);
        setState((old) => ({
          ...old,
          status: "importing",
          error: null,
          failedImports: {
            ...old.failedImports,
            companies: [
              ...old.failedImports.companies,
              { ...(dataToImport as any), error: (err as Error).message },
            ],
          },
        }));
      }
    };

    const importContact = async (
      dataToImport: JsonTypes.JsonPrimitive | JsonTypes.JsonStruct | undefined,
    ) => {
      if (!isContact(dataToImport)) {
        setState((old) => ({
          ...old,
          status: "importing",
          error: null,
          failedImports: {
            ...old.failedImports,
            contacts: [
              ...old.failedImports.contacts,
              { ...(dataToImport as any), error: "Invalid format" },
            ],
          },
        }));
        return;
      }

      try {
        // Validate gender against valid values
        const gender = dataToImport.gender?.trim();
        if (gender && !contactGender.some((g) => g.value === gender)) {
          setState((old) => ({
            ...old,
            status: "importing",
            error: null,
            failedImports: {
              ...old.failedImports,
              contacts: [
                ...old.failedImports.contacts,
                {
                  ...(dataToImport as any),
                  error: `Invalid gender "${gender}". Must be one of: ${contactGender.map((g) => g.value).join(", ")}`,
                },
              ],
            },
          }));
          return;
        }

        let tagsIds: Array<Identifier> = [];
        if (dataToImport.tags && Array.isArray(dataToImport.tags)) {
          tagsIds = await Promise.all(
            dataToImport.tags.map(async (tag) => {
              if (idsMaps.tags[tag]) {
                return idsMaps.tags[tag];
              }
              const { data } = await dataProvider.create<Tag>("tags", {
                data: {
                  name: tag,
                  color: colors[Math.floor(Math.random() * colors.length)],
                },
              });
              idsMaps.tags[tag] = data.id;
              return data.id;
            }),
          );
        }

        const { data } = await dataProvider.create("contacts", {
          data: {
            last_name: dataToImport.last_name.trim(),
            first_name: dataToImport.first_name.trim(),
            title: dataToImport.title?.trim(),
            background: dataToImport.background?.trim(),
            linkedin_url: dataToImport.linkedin_url?.trim(),
            gender: gender || undefined,
            has_newsletter: !!dataToImport.has_newsletter,
            company_id: dataToImport.company_id
              ? idsMaps.companies[dataToImport.company_id]
              : undefined,
            email_jsonb: Array.isArray(dataToImport.emails)
              ? dataToImport.emails
              : undefined,
            phone_jsonb: Array.isArray(dataToImport.phones)
              ? dataToImport.phones
              : undefined,
            sales_id: dataToImport.sales_id
              ? idsMaps.sales[dataToImport.sales_id]
              : currentSale.id,
            tags: tagsIds,
            first_seen: dataToImport.created_at,
            last_seen: dataToImport.updated_at,
          },
        });
        idsMaps.contacts[dataToImport.id] = data.id;
        setState((old) => ({
          ...old,
          status: "importing",
          stats: {
            ...old.stats,
            contacts: old.stats.contacts + 1,
          },
          error: null,
        }));
        return data;
      } catch (err) {
        console.error(err);
        setState((old) => ({
          ...old,
          status: "importing",
          error: null,
          failedImports: {
            ...old.failedImports,
            contacts: [
              ...old.failedImports.contacts,
              { ...(dataToImport as any), error: (err as Error).message },
            ],
          },
        }));
      }
    };

    const importNote = async (
      dataToImport: JsonTypes.JsonPrimitive | JsonTypes.JsonStruct | undefined,
    ) => {
      if (!isNote(dataToImport)) {
        setState((old) => ({
          ...old,
          status: "importing",
          failedImports: {
            ...old.failedImports,
            notes: [
              ...old.failedImports.notes,
              { ...(dataToImport as any), error: "Invalid format" },
            ],
          },
          error: null,
        }));
        return;
      }
      try {
        if (idsMaps.sales[dataToImport.sales_id] == null) {
          console.error(
            `note ${dataToImport.text} has an invalid sales ID: ${dataToImport.sales_id}. Fallback to default sale`,
          );
        }
        if (idsMaps.contacts[dataToImport.contact_id] == null) {
          setState((old) => ({
            ...old,
            status: "importing",
            failedImports: {
              ...old.failedImports,
              notes: [
                ...old.failedImports.notes,
                {
                  ...(dataToImport as any),
                  error: `Invalid contact_id ${dataToImport.contact_id}`,
                },
              ],
            },
            error: null,
          }));
          return;
        }

        const attachments: Array<
          Omit<RAFile, "rawFile"> & {
            rawFile: { name: string; type: string | null };
          }
        > = [];
        if (Array.isArray(dataToImport.attachments)) {
          for (const file of dataToImport.attachments) {
            attachments.push({
              src: file.url,
              title: file.name,
              rawFile: {
                name: file.name,
                type: mime.getType(file.name.split(".").pop()!),
              },
            });
          }
        }

        await dataProvider.create("contact_notes", {
          data: {
            contact_id: idsMaps.contacts[dataToImport.contact_id],
            sales_id: idsMaps.sales[dataToImport.sales_id] ?? currentSale.id,
            text: dataToImport.text,
            date: dataToImport.date,
            attachments,
          },
        });
        setState((old) => ({
          ...old,
          status: "importing",
          stats: {
            ...old.stats,
            notes: old.stats.notes + 1,
          },
          error: null,
        }));
      } catch (err) {
        console.error(err);
        setState((old) => ({
          ...old,
          status: "importing",
          failedImports: {
            ...old.failedImports,
            notes: [
              ...old.failedImports.notes,
              { ...(dataToImport as any), error: (err as Error).message },
            ],
          },
          error: null,
        }));
      }
    };

    const importTask = async (
      dataToImport: JsonTypes.JsonPrimitive | JsonTypes.JsonStruct | undefined,
    ) => {
      if (!isTask(dataToImport)) {
        setState((old) => ({
          ...old,
          status: "importing",
          failedImports: {
            ...old.failedImports,
            tasks: [
              ...old.failedImports.tasks,
              { ...(dataToImport as any), error: "Invalid format" },
            ],
          },
          error: null,
        }));
        return;
      }
      try {
        if (idsMaps.sales[dataToImport.sales_id] == null) {
          console.error(
            `task ${dataToImport.text} has an invalid sales ID: ${dataToImport.sales_id}. Fallback to default sale`,
          );
        }
        if (idsMaps.contacts[dataToImport.contact_id] == null) {
          setState((old) => ({
            ...old,
            status: "importing",
            failedImports: {
              ...old.failedImports,
              tasks: [
                ...old.failedImports.tasks,
                {
                  ...(dataToImport as any),
                  error: `Invalid contact_id ${dataToImport.contact_id}`,
                },
              ],
            },
            error: null,
          }));
          return;
        }

        await dataProvider.create("tasks", {
          data: {
            contact_id: idsMaps.contacts[dataToImport.contact_id],
            sales_id: idsMaps.sales[dataToImport.sales_id] ?? currentSale.id,
            text: dataToImport.text,
            due_date: dataToImport.due_date || undefined,
            done_date: dataToImport.done_date || undefined,
          },
        });
        setState((old) => ({
          ...old,
          status: "importing",
          stats: {
            ...old.stats,
            tasks: old.stats.tasks + 1,
          },
          error: null,
        }));
      } catch (err) {
        console.error(err);
        setState((old) => ({
          ...old,
          status: "importing",
          failedImports: {
            ...old.failedImports,
            tasks: [
              ...old.failedImports.tasks,
              { ...(dataToImport as any), error: (err as Error).message },
            ],
          },
          error: null,
        }));
      }
    };

    let currentTask: Promise<any> | null = null;
    let currentBatch: Array<Promise<void>> = [];
    const BATCH_SIZE = 50;

    const parser = new JSONParser({
      paths: [
        "$.sales.*",
        "$.companies.*",
        "$.contacts.*",
        "$.notes.*",
        "$.tasks.*",
      ],
      keepStack: false,
    });
    const stream = file.stream();
    const reader = stream.pipeThrough(parser).getReader();

    const proccesBatchIfPossible = async (
      shouldProcessIncompleteBatch: boolean = false,
    ) => {
      if (currentBatch.length === BATCH_SIZE || shouldProcessIncompleteBatch) {
        currentTask = Promise.all(currentBatch);
        await currentTask;
        currentBatch = [];
        currentTask = null;
      }
    };
    let currentType: Types = "sales";
    while (true) {
      const { done, value: parsedElementInfo } = await reader.read();
      if (done) {
        await proccesBatchIfPossible(true);
        break;
      }
      const { value, stack, partial } = parsedElementInfo;
      if (partial) continue;
      const type =
        stack.length > 1 ? getType(stack[1].key?.toString()) : undefined;

      if (type == null) {
        continue;
      }

      if (type !== currentType) {
        // When moving to another type, make sure we wait for the previous batch to be imported
        await proccesBatchIfPossible(true);
        currentType = type;
      }
      switch (type) {
        case "sales": {
          currentBatch.push(importSale(value));
          break;
        }
        case "companies": {
          currentBatch.push(importCompany(value));
          break;
        }
        case "contacts": {
          currentBatch.push(importContact(value));
          break;
        }
        case "notes": {
          currentBatch.push(importNote(value));
          break;
        }
        case "tasks": {
          currentBatch.push(importTask(value));
          break;
        }
      }
      try {
        await proccesBatchIfPossible();
      } catch {
        // the state should have been set by the function that throw the error
        // stop the import
        await reader.cancel();
      }
    }

    setState((old) => {
      if (old.status === "error") {
        return old;
      }
      const duration = new Date().valueOf() - startedAt.valueOf();
      return {
        ...old,
        status: "success",
        duration,
      };
    });
    refresh();
  });

  return [state, importFile, reset];
};

const TYPES = ["sales", "companies", "contacts", "notes", "tasks"] as const;
type Types = (typeof TYPES)[number];

const getType = (value: string | undefined): Types | undefined => {
  const type = value as Types;
  if (TYPES.includes(type)) return type;
  return undefined;
};

type SaleImport = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
};

const isSale = (data: any): data is SaleImport =>
  data != null &&
  typeof data === "object" &&
  !Array.isArray(data) &&
  data.id != null &&
  data.email != null &&
  data.first_name !== null &&
  data.last_name != null;

type CompanyImport = {
  id: number;
  name: string;
  sales_id?: number;
  description?: string;
  city?: string;
  country?: string;
  address?: string;
  zipcode?: string;
  state_abbr?: string;
  sector?: string;
  size?: number;
  linkedin_url?: string;
  website?: string;
  phone_number?: string;
  revenue?: string;
  tax_identifier?: string;
  context_links?: string[];
  created_at?: string;
  updated_at?: string;
};

const isCompany = (data: any): data is CompanyImport =>
  data != null &&
  typeof data === "object" &&
  !Array.isArray(data) &&
  data.id != null &&
  data.name != null;

type ContactImport = {
  id: number;
  sales_id: number;
  company_id?: number;
  first_name: string;
  last_name: string;
  title?: string;
  background?: string;
  linkedin_url?: string;
  avatar?: string;
  gender?: string;
  has_newsletter?: boolean;
  emails: Array<{ email: string; type: string }>;
  phones: Array<{ number: string; type: string }>;
  tags: Array<string>;
  created_at?: string;
  updated_at?: string;
};

const isContact = (data: any): data is ContactImport =>
  data != null &&
  typeof data === "object" &&
  !Array.isArray(data) &&
  data.id != null;

type NoteImport = {
  contact_id: number;
  sales_id: number;
  text: string;
  date: string;
  attachments: Array<{ url: string; name: string }>;
  created_at?: string;
  updated_at?: string;
};

const isNote = (data: any): data is NoteImport =>
  data != null &&
  typeof data === "object" &&
  !Array.isArray(data) &&
  data.sales_id != null &&
  data.contact_id != null &&
  data.text != null &&
  data.date != null;

type TaskImport = {
  contact_id: number;
  sales_id: number;
  text: string;
  due_date?: string;
  done_date?: string;
  created_at?: string;
  updated_at?: string;
};

const isTask = (data: any): data is TaskImport =>
  data != null &&
  typeof data === "object" &&
  !Array.isArray(data) &&
  data.sales_id != null &&
  data.contact_id != null &&
  data.text != null;

/**
 * Maps a company size number to the appropriate size category.
 * Categories: 1, 10, 50, 250, 500
 */
const mapSizeToCategory = (size: number): 1 | 10 | 50 | 250 | 500 => {
  if (size === 1) return 1;
  if (size < 10) return 10;
  if (size < 50) return 50;
  if (size < 250) return 250;
  return 500;
};
