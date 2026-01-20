import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileNavigationProps {
  onClose: () => void;
  currentPath: string | boolean;
}

export const MobileNavigation = ({
  onClose,
  currentPath,
}: MobileNavigationProps) => {
  return (
    <div className="fixed inset-0 top-16 z-50 bg-background/80 backdrop-blur-sm md:hidden">
      <div className="absolute top-0 right-0 p-4">
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close menu">
          <X className="h-6 w-6" />
        </Button>
      </div>
      <nav className="flex flex-col items-center justify-center h-full gap-4">
        <MobileNavigationLink
          label="Dashboard"
          to="/"
          isActive={currentPath === "/"}
          onClick={onClose}
        />
        <MobileNavigationLink
          label="Contacts"
          to="/contacts"
          isActive={currentPath === "/contacts"}
          onClick={onClose}
        />
        <MobileNavigationLink
          label="Companies"
          to="/companies"
          isActive={currentPath === "/companies"}
          onClick={onClose}
        />
        <MobileNavigationLink
          label="Deals"
          to="/deals"
          isActive={currentPath === "/deals"}
          onClick={onClose}
        />
      </nav>
    </div>
  );
};

const MobileNavigationLink = ({
  label,
  to,
  isActive,
  onClick,
}: {
  label: string;
  to: string;
  isActive: boolean;
  onClick: () => void;
}) => (
  <Link
    to={to}
    onClick={onClick}
    className={`text-2xl font-bold ${
      isActive ? "text-primary" : "text-foreground/60"
    }`}
  >
    {label}
  </Link>
);
