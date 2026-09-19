import { Children, useState, type ReactNode } from "react";
import { useTranslate } from "ra-core";

import { Button } from "@/components/ui/button";

// A Dashboard queue stays five rows tall until asked otherwise.
//
// The point is that the Dashboard stays readable while nothing disappears:
// an operational queue that silently truncates is worse than a long one,
// because the work is still there and Leif can no longer see it. So the
// count is always stated ("Show all 8"), and expanding is one click.
export const VISIBLE_QUEUE_ROWS = 5;

export const CollapsibleQueue = ({
  children,
  itemCount,
}: {
  children: ReactNode;
  // Passed rather than derived, so a caller rendering a fragment or a
  // mapped list gets the same answer this component would.
  itemCount: number;
}) => {
  const translate = useTranslate();
  const [expanded, setExpanded] = useState(false);

  const rows = Children.toArray(children);
  const overflows = rows.length > VISIBLE_QUEUE_ROWS;
  const visible = expanded ? rows : rows.slice(0, VISIBLE_QUEUE_ROWS);

  return (
    <>
      {visible}
      {overflows && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start px-1 h-7 text-xs text-muted-foreground"
          onClick={() => setExpanded((was) => !was)}
        >
          {expanded
            ? translate("crm.dashboard.queue_show_fewer", { _: "Show fewer" })
            : translate("crm.dashboard.queue_show_all", {
                // The number is the point: it says how much is hidden.
                _: `Show all ${itemCount}`,
                count: itemCount,
              })}
        </Button>
      )}
    </>
  );
};
