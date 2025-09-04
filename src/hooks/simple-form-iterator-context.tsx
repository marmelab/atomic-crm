import { createContext, useContext } from "react";

/**
 * A React context that provides access to a SimpleFormIterator data (the total number of items) and mutators (add, reorder and remove).
 * Useful to create custom array input iterators.
 * @deprecated Use SimpleFormIteratorContext from `ra-core` once available.
 * @see {SimpleFormIterator}
 * @see {ArrayInput}
 */
export const SimpleFormIteratorContext = createContext<
  SimpleFormIteratorContextValue | undefined
>(undefined);

/**
 * @deprecated Use SimpleFormIteratorContextValue from `ra-core` once available.
 */
export type SimpleFormIteratorContextValue = {
  add: (item?: any) => void;
  remove: (index: number) => void;
  reOrder: (index: number, newIndex: number) => void;
  source: string;
  total: number;
};

/**
 * @deprecated Use useSimpleFormIterator from `ra-core` once available.
 */
export const useSimpleFormIterator = () => {
  const context = useContext(SimpleFormIteratorContext);
  if (!context) {
    throw new Error(
      "useSimpleFormIterator must be used inside a SimpleFormIterator",
    );
  }
  return context;
};

/**
 * A React context that provides access to a SimpleFormIterator item meta (its index and the total number of items) and mutators (reorder and remove this remove).
 * Useful to create custom array input iterators.
 * @deprecated Use SimpleFormIteratorItemContext from `ra-core` once available.
 * @see {SimpleFormIterator}
 * @see {ArrayInput}
 */
export const SimpleFormIteratorItemContext = createContext<
  SimpleFormIteratorItemContextValue | undefined
>(undefined);

/**
 * @deprecated Use SimpleFormIteratorItemContextValue from `ra-core` once available.
 */
export type SimpleFormIteratorItemContextValue = {
  index: number;
  total: number;
  remove: () => void;
  reOrder: (newIndex: number) => void;
};

/**
 * @deprecated Use useSimpleFormIteratorItem from `ra-core` once available.
 */
export const useSimpleFormIteratorItem = () => {
  const context = useContext(SimpleFormIteratorItemContext);
  if (!context) {
    throw new Error(
      "useSimpleFormIteratorItem must be used inside a SimpleFormIteratorItem",
    );
  }
  return context;
};
