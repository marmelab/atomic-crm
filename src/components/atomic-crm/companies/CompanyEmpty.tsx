import { CreateButton } from "@/components/admin/create-button";

import useAppBarHeight from "../misc/useAppBarHeight";

export const CompanyEmpty = () => {
  const appbarHeight = useAppBarHeight();
  return (
    <div
      className="flex flex-col justify-center items-center gap-6"
      style={{
        height: `calc(100dvh - ${appbarHeight}px)`,
      }}
    >
      <img src="./img/empty.svg" alt="No companies found" />
      <div className="flex flex-col gap-0 items-center">
        <h6 className="text-lg font-bold">No companies found</h6>
        <p className="text-sm text-center text-muted-foreground mb-4">
          It seems your company list is empty.
        </p>
      </div>
      <div className="flex space-x-2">
        <CreateButton label="Create Company" />
      </div>
    </div>
  );
};
