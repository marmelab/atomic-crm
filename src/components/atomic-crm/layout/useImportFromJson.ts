import { useState } from "react";
import {
  type Identifier,
  useDataProvider,
  useEvent,
  useRefresh,
} from "ra-core";
import { JSONParser } from "@streamparser/json-whatwg";
import mime from "mime/lite";
import type { CrmDataProvider } from "../providers/types";
import type { RAFile, Sale, Tag } from "../types";
import { colors } from "../tags/colors";

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
      sales: Record<number, number>;
      companies: Record<number, number>;
      contacts: Record<number, number>;
      tags: Record<string, number>;
    } = {
      sales: {},
      companies: {},
      contacts: {},
      tags: {},
    };

    const importSale = async (dataToImport: SaleImport) => {
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

      return data;
    };

    const importCompany = async (dataToImport: CompanyImport) => {
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

      return data;
    };

    const importContact = async (dataToImport: ContactImport) => {
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

      return data;
    };

    const importNote = async (dataToImport: NoteImport, defaultSale: Sale) => {
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
    };

    const importTask = async (dataToImport: TaskImport, defaultSale: Sale) => {
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
    while (true) {
      const { done, value: parsedElementInfo } = await reader.read();
      if (done) {
        await proccesBatchIfPossible(true);
        break;
      }
      const { value, stack, partial } = parsedElementInfo;
      if (partial) continue;
      const type = stack.length > 1 ? stack[1].key : undefined;

      if (type === "sales") {
        if (!isSale(value)) continue;

        currentBatch.push(
          importSale(value)
            .then((data) => {
              idsMaps.sales[value.id] = data.id;
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
            })
            .catch((err) => {
              setState((old) => ({
                ...old,
                status: "error",
                error: new Error(
                  `Error while importing sale ${value.id} (${value.email}): ${(err as Error).message}`,
                ),
                failedImports: {
                  ...old.failedImports,
                  sales: [...old.failedImports.sales, value],
                },
                duration: new Date().getDate() - startedAt.getDate(),
              }));
            }),
        );
        await proccesBatchIfPossible();
        continue;
      }
      await proccesBatchIfPossible(true);
      // Error state should stop the import process
      if (state.status === "error") {
        await reader.cancel();
        break;
      }

      const defaultSale = await getDefaultSale();

      if (type === "companies") {
        if (!isCompany(value)) continue;

        currentBatch.push(
          importCompany(value)
            .then((data) => {
              idsMaps.companies[value.id] = data.id;
              setState((old) => ({
                ...old,
                status: "importing",
                stats: {
                  ...old.stats,
                  companies: old.stats.companies + 1,
                },
                error: null,
              }));
            })
            .catch((err) => {
              console.error(err);
              setState((old) => ({
                ...old,
                status: "importing",
                error: null,
                failedImports: {
                  ...old.failedImports,
                  companies: [...old.failedImports.companies, value],
                },
              }));
            }),
        );
        await proccesBatchIfPossible();
        continue;
      }
      await proccesBatchIfPossible(true);

      if (type === "contacts") {
        if (!isContact(value)) continue;

        currentBatch.push(
          importContact(value)
            .then((data) => {
              idsMaps.contacts[value.id] = data.id;
              setState((old) => ({
                ...old,
                status: "importing",
                stats: {
                  ...old.stats,
                  contacts: old.stats.contacts + 1,
                },
                error: null,
              }));
            })
            .catch((err) => {
              console.error(err);
              setState((old) => ({
                ...old,
                status: "importing",
                error: null,
                failedImports: {
                  ...old.failedImports,
                  contacts: [...old.failedImports.contacts, value],
                },
              }));
            }),
        );
        await proccesBatchIfPossible();
        continue;
      }
      await proccesBatchIfPossible(true);
      if (type === "notes") {
        if (!isNote(value)) continue;

        currentBatch.push(
          importNote(value, defaultSale)
            .then(() => {
              setState((old) => ({
                ...old,
                status: "importing",
                stats: {
                  ...old.stats,
                  notes: old.stats.notes + 1,
                },
                error: null,
              }));
            })
            .catch((err) => {
              console.error(err);
              setState((old) => ({
                ...old,
                status: "importing",
                failedImports: {
                  ...old.failedImports,
                  notes: [...old.failedImports.notes, value],
                },
                error: null,
              }));
            }),
        );
        await proccesBatchIfPossible();
        continue;
      }
      await proccesBatchIfPossible(true);
      if (type === "tasks") {
        if (!isTask(value)) continue;

        currentBatch.push(
          importTask(value, defaultSale)
            .then(() => {
              setState((old) => ({
                ...old,
                status: "importing",
                stats: {
                  ...old.stats,
                  tasks: old.stats.tasks + 1,
                },
                error: null,
              }));
            })
            .catch((err) => {
              console.error(err);
              setState((old) => ({
                ...old,
                status: "importing",
                failedImports: {
                  ...old.failedImports,
                  tasks: [...old.failedImports.tasks, value],
                },
                error: null,
              }));
            }),
        );
        await proccesBatchIfPossible();
        continue;
      }

      await proccesBatchIfPossible(true);
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
