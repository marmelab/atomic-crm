import { useCanAccess } from "ra-core";

export const useCanFilterByAccountManager = () => {
  const { canAccess, isPending } = useCanAccess({
    resource: "sales",
    action: "list",
  });
  return { canFilter: canAccess === true, isPending };
};
