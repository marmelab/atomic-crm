import { createContext, useContext, useMemo } from "react";
import { UseFieldArrayReturn } from "react-hook-form";

/**
 * A React context that provides access to an ArrayInput methods as provided by react-hook-form
 * Useful to create custom array input iterators.
 * @deprecated Use ArrayInputContext from `ra-core` once available.
 * @see {ArrayInput}
 * @see {@link https://react-hook-form.com/docs/usefieldarray}
 */
export const ArrayInputContext = createContext<
  ArrayInputContextValue | undefined
>(undefined);

/**
 * @deprecated Use ArrayInputContextValue from `ra-core` once available.
 */
export type ArrayInputContextValue = UseFieldArrayReturn;

/**
 * @deprecated Use useArrayInput from `ra-core` once available.
 */
export const useArrayInput = (
  props?: Partial<ArrayInputContextValue>,
): ArrayInputContextValue => {
  const context = useContext(ArrayInputContext);
  const memo = useMemo(
    () =>
      ({
        append: props?.append,
        fields: props?.fields,
        insert: props?.insert,
        move: props?.move,
        prepend: props?.prepend,
        remove: props?.remove,
        replace: props?.replace,
        swap: props?.swap,
        update: props?.update,
      }) as ArrayInputContextValue,
    [props],
  );

  if (props?.fields) {
    return memo;
  }
  if (!context) {
    throw new Error(
      "useArrayInput must be used inside an ArrayInputContextProvider",
    );
  }

  return context;
};
