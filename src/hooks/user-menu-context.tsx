import { createContext, useContext } from "react";

/**
 * @deprecated Use UserMenuContextValue from `ra-core` once available.
 */
export type UserMenuContextValue = {
  /**
   * Closes the user menu
   * @see UserMenu
   */
  onClose: () => void;
};

/**
 * @deprecated Use UserMenuContext from `ra-core` once available.
 */
export const UserMenuContext = createContext<UserMenuContextValue | undefined>(
  undefined,
);

/**
 * @deprecated Use useUserMenu from `ra-core` once available.
 */
export const useUserMenu = () => useContext(UserMenuContext);
