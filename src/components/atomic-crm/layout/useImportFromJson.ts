import { useState } from "react";
import {
  type Identifier,
  useDataProvider,
  useEvent,
  useRefresh,
} from "ra-core";
import { JSONParser, type JsonTypes } from "@streamparser/json-whatwg";
import mime from "mime/lite";
import type { CrmDataProvider } from "../providers/types";
import type { RAFile, Sale, Tag } from "../types";
import { colors } from "../tags/colors";
import { Braces } from "lucide-react";

export type ImportFromJsonStats = {
  sales: number;
  companies: number;
  contacts: number;
  notes: number;
  tasks: number;
};

export type ImportFromJsonFailures = {
  sales: Array<any>;
  companies: Array<any>;
  contacts: Array<any>;
  notes: Array<any>;
  tasks: Array<any>;
};

type ImportFromJsonIdleState = {
  status: "idle";
  error: null;
  stats: ImportFromJsonStats;
  failedImports: ImportFromJsonFailures;
};

type ImportFromJsonImportingState = {
  status: "importing";
  stats: ImportFromJsonStats;
  error: null;
  failedImports: ImportFromJsonFailures;
};

type ImportFromJsonErrorState = {
  status: "error";
  error: Error;
  stats: ImportFromJsonStats;
  failedImports: ImportFromJsonFailures;
  duration: number;
};

type ImportFromJsonSuccessState = {
  status: "success";
  stats: ImportFromJsonStats;
  error: null;
  failedImports: ImportFromJsonFailures;
  duration: number;
};

type ImportFromJsonState =
  | ImportFromJsonErrorState
  | ImportFromJsonIdleState
  | ImportFromJsonImportingState
  | ImportFromJsonSuccessState;

type ImportFunction = (file: File) => Promise<void>;

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

export const useImportFromJson = (): [ImportFromJsonState, ImportFunction] => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const refresh = useRefresh();
  const [state, setState] = useState<ImportFromJsonState>({
    status: "idle",
    error: null,
    stats: defaultStats,
    failedImports: defaultFailedImports,
  });

  const importFile = useEvent(async (file: File) => {
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
      if (!isSale(dataToImport)) {
        setState((old) => ({
          ...old,
          status: "error",
          error: new Error(`Error while importing sale: Invalid data`),
          failedImports: {
            ...old.failedImports,
            sales: [...old.failedImports.sales, dataToImport],
          },
          duration: new Date().getDate() - startedAt.getDate(),
        }));
        return;
      }
      try {
        const existingRecord = await dataProvider.getList("sales", {
          filter: { email: dataToImport.email.trim() },
          pagination: { page: 1, perPage: 1 },
          sort: { field: "id", order: "ASC" },
        });
        if (existingRecord.total === 1) {
          return existingRecord.data[0].id;
        }

        const { data } = await dataProvider.salesCreate({
          email: dataToImport.email.trim(),
          first_name: dataToImport.name.trim(),
          last_name: dataToImport.name.trim(),
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
        setState((old) => ({
          ...old,
          status: "error",
          error: new Error(
            `Error while importing sale ${dataToImport.id} (${dataToImport.email}): ${(err as Error).message}`,
          ),
          failedImports: {
            ...old.failedImports,
            sales: [...old.failedImports.sales, dataToImport],
          },
          duration: new Date().getDate() - startedAt.getDate(),
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
            companies: [...old.failedImports.companies, dataToImport],
          },
        }));
        return;
      }
      try {
        const { data } = await dataProvider.create("companies", {
          data: {
            name: dataToImport.name.trim(),
            description: dataToImport.description?.trim(),
            city: dataToImport.city?.trim(),
            country: dataToImport.country?.trim(),
            address: dataToImport.address?.trim(),
            zipcode: dataToImport.zipcode?.trim(),
            stateAbbr: dataToImport.stateAbbr?.trim(),
            sales_id: dataToImport.salesId
              ? idsMaps.sales[dataToImport.salesId]
              : undefined,
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
            companies: [...old.failedImports.companies, dataToImport],
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
            contacts: [...old.failedImports.contacts, dataToImport],
          },
        }));
        return;
      }

      try {
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
            last_name: dataToImport.lastName,
            first_name: dataToImport.firstName,
            title: dataToImport.title,
            background: dataToImport.background,
            linkedin_url: dataToImport.linkedinUrl,
            company_id: dataToImport.companyId
              ? idsMaps.companies[dataToImport.companyId]
              : undefined,
            email_jsonb: Array.isArray(dataToImport.emails)
              ? dataToImport.emails
              : undefined,
            phone_jsonb: Array.isArray(dataToImport.phones)
              ? dataToImport.phones
              : undefined,
            sales_id: dataToImport.salesId
              ? idsMaps.sales[dataToImport.salesId]
              : undefined,
            tags: tagsIds,
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
            contacts: [...old.failedImports.contacts, dataToImport],
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
            notes: [...old.failedImports.notes, dataToImport],
          },
          error: null,
        }));
        return;
      }
      try {
        const defaultSale = await getDefaultSale();

        if (idsMaps.sales[dataToImport.salesId] == null) {
          console.error(
            `note ${dataToImport.text} has an invalid sales ID: ${dataToImport.salesId}`,
          );
        }
        if (idsMaps.contacts[dataToImport.contactId] == null) {
          throw new Error(
            `note ${dataToImport.text} has an invalid contact ID: ${dataToImport.contactId}`,
          );
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

        await dataProvider.create("contactNotes", {
          data: {
            contact_id: idsMaps.contacts[dataToImport.contactId],
            sales_id: idsMaps.sales[dataToImport.salesId] ?? defaultSale.id,
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
            notes: [...old.failedImports.notes, dataToImport],
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
            tasks: [...old.failedImports.tasks, dataToImport],
          },
          error: null,
        }));
        return;
      }
      try {
        const defaultSale = await getDefaultSale();

        if (idsMaps.sales[dataToImport.salesId] == null) {
          console.error(
            `task ${dataToImport.text} has an invalid sales ID: ${dataToImport.salesId}`,
          );
        }
        if (idsMaps.contacts[dataToImport.contactId] == null) {
          throw new Error(
            `task ${dataToImport.text} has an invalid contact ID: ${dataToImport.contactId}`,
          );
          return;
        }

        await dataProvider.create("tasks", {
          data: {
            contact_id: idsMaps.contacts[dataToImport.contactId],
            sales_id: idsMaps.sales[dataToImport.salesId] ?? defaultSale.id,
            text: dataToImport.text,
            due_date: dataToImport.dueDate || undefined,
            done_date: dataToImport.doneDate || undefined,
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
            tasks: [...old.failedImports.tasks, dataToImport],
          },
          error: null,
        }));
      }
    };

    let defaultSale: Sale | null = null;
    const getDefaultSale = async () => {
      if (defaultSale) return defaultSale;
      const { data } = await dataProvider.getList<Sale>("sales", {
        pagination: { page: 1, perPage: 1000 },
        sort: { field: "id", order: "ASC" },
        filter: {},
      });

      // get the first admin or the first sale if no admin yet
      defaultSale = data.find((item) => item.administrator) ?? data[0];
      return defaultSale;
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

    const proccesBatchIfPossible = async (ignoreSize: boolean = false) => {
      if (currentBatch.length === BATCH_SIZE || ignoreSize) {
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
      await proccesBatchIfPossible();
      // Error state should stop the import process
      if (state.status === "error") {
        await reader.cancel();
        break;
      }
    }

    setState((old) => {
      if (old.status === "error") {
        return old;
      }
      return {
        ...old,
        status: "success",
        duration: new Date().getDate() - startedAt.getDate(),
      };
    });
    refresh();
  });

  return [state, importFile];
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
  name: string;
};

const isSale = (data: any): data is SaleImport =>
  data != null &&
  typeof data === "object" &&
  !Array.isArray(data) &&
  data.id != null &&
  data.email != null &&
  data.name != null;

type CompanyImport = {
  id: number;
  name: string;
  salesId?: number;
  description?: string;
  city?: string;
  country?: string;
  address?: string;
  zipcode?: string;
  stateAbbr?: string;
};

const isCompany = (data: any): data is CompanyImport =>
  data != null &&
  typeof data === "object" &&
  !Array.isArray(data) &&
  data.id != null &&
  data.name != null;

type ContactImport = {
  id: number;
  salesId: number;
  companyId?: number;
  firstName: string;
  lastName: string;
  title?: string;
  background?: string;
  linkedinUrl?: string;
  avatar?: string;
  emails: Array<{ email: string; type: string }>;
  phones: Array<{ number: string; type: string }>;
  tags: Array<string>;
};

const isContact = (data: any): data is ContactImport =>
  data != null &&
  typeof data === "object" &&
  !Array.isArray(data) &&
  data.id != null;

type NoteImport = {
  contactId: number;
  salesId: number;
  text: string;
  date: string;
  attachments: Array<{ url: string; name: string }>;
};

const isNote = (data: any): data is NoteImport =>
  data != null &&
  typeof data === "object" &&
  !Array.isArray(data) &&
  data.salesId != null &&
  data.contactId != null &&
  data.text != null &&
  data.date != null;

type TaskImport = {
  contactId: number;
  salesId: number;
  text: string;
  dueDate?: string;
  doneDate?: string;
};

const isTask = (data: any): data is TaskImport =>
  data != null &&
  typeof data === "object" &&
  !Array.isArray(data) &&
  data.salesId != null &&
  data.contactId != null &&
  data.text != null;
