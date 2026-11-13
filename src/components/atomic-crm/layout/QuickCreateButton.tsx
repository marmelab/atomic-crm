import { Building2, Handshake, ListTodo, Plus, UserPlus } from "lucide-react";
import { useState } from "react";
import { useTranslate } from "ra-core";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { TaskCreateSheet } from "../tasks/TaskCreateSheet";

/**
 * The single "+" of the interface (TZ section 4.1): creates any object. It is
 * the one element drawn in the accent color.
 */
export const QuickCreateButton = () => {
  const translate = useTranslate();
  const [taskOpen, setTaskOpen] = useState(false);
  const label = translate("crm.quick_create.label");

  return (
    <>
      <TaskCreateSheet open={taskOpen} onOpenChange={setTaskOpen} />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button className="h-10 gap-1.5 rounded-full px-4" />}
        >
          <Plus className="size-5" />
          <span className="hidden md:inline">{label}</span>
          <span className="sr-only md:hidden">{label}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem
            render={
              <Link to="/deals/create" className="flex items-center gap-2" />
            }
          >
            <Handshake />
            {translate("crm.quick_create.deal")}
          </DropdownMenuItem>
          <DropdownMenuItem
            render={
              <Link to="/contacts/create" className="flex items-center gap-2" />
            }
          >
            <UserPlus />
            {translate("crm.quick_create.contact")}
          </DropdownMenuItem>
          <DropdownMenuItem
            render={
              <Link
                to="/companies/create"
                className="flex items-center gap-2"
              />
            }
          >
            <Building2 />
            {translate("crm.quick_create.company")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setTaskOpen(true)}
            className="flex items-center gap-2"
          >
            <ListTodo />
            {translate("crm.quick_create.task")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
