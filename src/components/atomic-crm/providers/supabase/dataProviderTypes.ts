import type { DataProvider } from "ra-core";
import type { supabase } from "./supabase";

/** Authenticated edge function invocation — shared across provider modules. */
export type InvokeEdgeFunction = <T>(
  functionName: string,
  options?: Parameters<typeof supabase.functions.invoke<T>>[1],
) => ReturnType<typeof supabase.functions.invoke<T>>;

/** Minimal subset of the base DataProvider used by feature modules. */
export type BaseProvider = DataProvider;

/** Pagination preset for large lists. */
export const LARGE_PAGE = { page: 1, perPage: 1000 } as const;
