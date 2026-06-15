import { Draggable } from "@hello-pangea/dnd";
import { useGetRecordRepresentation, useTranslate } from "ra-core";
import { useState } from "react";

import { DateField } from "@/components/admin/date-field";
import { ReferenceField } from "@/components/admin/reference-field";
import { useIsMobile } from "@/hooks/use-mobile";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Contact, Task as TData } from "../types";
import { TaskEdit } from "./TaskEdit";
import { TaskEditSheet } from "./TaskEditSheet";
import { isOverdue } from "./tasksPredicate";

export const TaskKanbanCard = ({
  task,
  index,
  showContact,
  showAssignee,
}: {
  task: TData;
  index: number;
  showContact?: boolean;
  showAssignee?: boolean;
}) => {
  const isMobile = useIsMobile();
  const translate = useTranslate();
  const { taskTypes } = useConfigurationContext();
  const getContactRepresentation = useGetRecordRepresentation("contacts");
  const [openEdit, setOpenEdit] = useState(false);

  const overdue =
    !!task.due_date && isOverdue(task.due_date) && !task.done_date;
  const taskType = taskTypes.find((t) => t.value === task.type);

  return (
    <>
      <Draggable draggableId={String(task.id)} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            onClick={() => setOpenEdit(true)}
            className={`bg-background rounded-md border p-2.5 text-sm shadow-sm cursor-pointer hover:border-primary/50 transition-shadow ${
              snapshot.isDragging ? "shadow-md ring-1 ring-primary/40" : ""
            }`}
          >
            <div className="flex items-start gap-1.5">
              {task.priority && task.priority !== "medium" && (
                <span
                  className={`mt-1 inline-block w-2 h-2 rounded-full shrink-0 ${
                    task.priority === "high" ? "bg-red-500" : "bg-slate-400"
                  }`}
                  title={
                    task.priority === "high" ? "High priority" : "Low priority"
                  }
                />
              )}
              <div className="flex-1 min-w-0">
                {taskType && task.type !== "none" && (
                  <span className="font-semibold">{taskType.label} </span>
                )}
                <span className={task.done_date ? "line-through" : ""}>
                  {task.text}
                </span>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
              <span className={overdue ? "text-red-600 font-medium" : ""}>
                {translate("resources.tasks.fields.due_short")}{" "}
                <DateField source="due_date" record={task} showDate />
              </span>
              {showAssignee && task.sales_id && (
                <ReferenceField<TData, any>
                  source="sales_id"
                  reference="sales"
                  record={task}
                  link={false}
                  className="inline"
                  render={({ referenceRecord }) => {
                    if (!referenceRecord) return null;
                    return (
                      <span className="bg-muted px-1.5 py-0.5 rounded">
                        {referenceRecord.first_name} {referenceRecord.last_name}
                      </span>
                    );
                  }}
                />
              )}
            </div>

            {showContact && (
              <ReferenceField<TData, Contact>
                source="contact_id"
                reference="contacts"
                record={task}
                link={false}
                className="block mt-1 text-xs text-muted-foreground truncate"
                render={({ referenceRecord }) => {
                  if (!referenceRecord) return null;
                  return <span>{getContactRepresentation(referenceRecord)}</span>;
                }}
              />
            )}
          </div>
        )}
      </Draggable>

      {isMobile ? (
        <TaskEditSheet
          taskId={task.id}
          open={openEdit}
          onOpenChange={setOpenEdit}
          previousSalesId={task.sales_id}
        />
      ) : (
        <TaskEdit
          taskId={task.id}
          open={openEdit}
          close={() => setOpenEdit(false)}
          previousSalesId={task.sales_id}
        />
      )}
    </>
  );
};
