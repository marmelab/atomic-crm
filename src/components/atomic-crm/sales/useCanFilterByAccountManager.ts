import { useCanAccess } from "ra-core";

export const useCanFilterByAccountManager = () => {
  const { canAccess } = useCanAccess({ resource: "sales", action: "list" });
  return canAccess === true;
};
