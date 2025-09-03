import { ReactNode } from "react";

/**
 * @deprecated Use a simple div with flex and flex-col instead
 */
export const SimpleShowLayout = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-col gap-4">{children}</div>
);
