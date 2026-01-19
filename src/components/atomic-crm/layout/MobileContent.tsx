import { type ReactNode } from "react";

export const MobileContent = ({ children }: { children: ReactNode }) => (
  <main
    className="max-w-screen-xl mx-auto pt-18 px-4 pb-20 min-h-screen overflow-y-auto"
    id="main-content"
  >
    {children}
  </main>
);
