import { cn } from "@/lib/utils";

interface ListPlaceholderProps {
  className?: string;
}

export const ListPlaceholder = ({ className }: ListPlaceholderProps) => {
  return <span className={cn("bg-gray-300 flex", className)}>&nbsp;</span>;
};
