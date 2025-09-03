import { FunctionComponent, memo } from "react";

/**
 * A version of React.memo that preserves the original component type allowing it to accept generics.
 * See {@link https://stackoverflow.com/a/70890101}
 * @deprecated Use genericMemo from "ra-core" when available.
 */
export function genericMemo<T>(component: T): T {
  const result = memo(component as FunctionComponent);

  // We have to set the displayName on both the field implementation and the memoized version.
  // On the implementation so that the memoized version can pick them up and users may reference the defaultProps in their components.
  // On the memoized version so that components that inspect their children props may read them.
  // @ts-expect-error: genericMemo does not have a displayName property
  result.displayName = component.displayName?.replace("Impl", "");
  return result as unknown as T;
}
