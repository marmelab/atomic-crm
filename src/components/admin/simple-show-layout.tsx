import { ReactNode } from "react";

export const SimpleShowLayout = ({children}: {children: ReactNode}) => (
  <div className="flex flex-col gap-4">
    {children}
  </div>
)