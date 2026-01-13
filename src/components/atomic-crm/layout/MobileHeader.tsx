import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useConfigurationContext } from "../root/ConfigurationContext";

export const MobileHeader = ({ children }: { children?: ReactNode }) => {
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();

  const portalTarget = document.getElementById("atomic-crm-header");

  if (!portalTarget) return null;

  const content = children || (
    <div className="flex items-center gap-2 text-secondary-foreground no-underline py-3">
      <img className="[.light_&]:hidden h-6" src={darkModeLogo} alt={title} />
      <img className="[.dark_&]:hidden h-6" src={lightModeLogo} alt={title} />
      <h1 className="text-xl font-semibold">{title}</h1>
    </div>
  );

  return createPortal(content, portalTarget);
};
