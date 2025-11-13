import * as React from "react";
import { FieldTitle, useResourceContext } from "ra-core";
import { GripVertical } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/**
 * UI to enable/disable a field
 */
export const FieldToggle = (props: FieldToggleProps) => {
  const { selected, label, onToggle, onMove, source, index } = props;
  const resource = useResourceContext();
  const dropIndex = React.useRef<number | null>(null);
  const x = React.useRef<number | null>(null);
  const y = React.useRef<number | null>(null);

  const handleDocumentDragOver = React.useCallback((event: DragEvent) => {
    x.current = event.clientX;
    y.current = event.clientY;
  }, []);

  const handleDragStart = () => {
    document.addEventListener(
      "dragover",
      handleDocumentDragOver as EventListener
    );
  };

  const handleDrag = (event: React.DragEvent) => {
    // imperative DOM manipulations using the native Drag API
    const selectedItem = event.target as HTMLElement;
    selectedItem.dataset.dragActive = "true";
    const list = selectedItem.closest("ul");
    if (x.current == null || y.current == null) {
      return;
    }
    const elementAtDragCoordinates = document.elementFromPoint(
      x.current,
      y.current
    );
    let dropItem =
      elementAtDragCoordinates === null
        ? selectedItem
        : elementAtDragCoordinates.closest("li");

    if (!dropItem) {
      return;
    }
    if (dropItem.classList.contains("dragIcon")) {
      const parent = dropItem.parentNode;
      if (parent instanceof HTMLElement) {
        dropItem = parent;
      }
    }
    if (dropItem === selectedItem) {
      return;
    }
    const dropItemParent = dropItem.parentNode;
    if (
      list &&
      dropItemParent instanceof HTMLElement &&
      list === dropItemParent.closest("ul")
    ) {
      const dataIndex = dropItem.dataset.index;
      if (dataIndex) {
        dropIndex.current = parseInt(dataIndex, 10);
      }
      if (dropItem === selectedItem.nextSibling) {
        dropItem = dropItem.nextSibling as HTMLElement;
      }
      list.insertBefore(selectedItem, dropItem);
    }
  };

  const handleDragEnd = (event: React.DragEvent) => {
    const selectedItem = event.target as HTMLElement;
    const list = selectedItem.closest("ul");

    const elementFromPoint =
      x.current != null && y.current != null
        ? document.elementFromPoint(x.current, y.current)
        : null;

    let dropItem =
      x.current == null || y.current == null || elementFromPoint === null
        ? selectedItem
        : elementFromPoint.closest("li");

    if (y.current !== null && list && !dropItem) {
      const closestUL = selectedItem.closest("ul");
      if (closestUL && y.current > closestUL.getBoundingClientRect().bottom) {
        dropItem = list.lastChild as HTMLElement;
      } else {
        dropItem = list.firstChild as HTMLElement;
      }
    }

    if (dropItem && list && dropItem.closest("ul") === list) {
      if (onMove) onMove(selectedItem.dataset.index!, dropIndex.current!);
    } else {
      event.preventDefault();
      event.stopPropagation();
    }
    selectedItem.dataset.dragActive = "false";
    document.removeEventListener(
      "dragover",
      handleDocumentDragOver as EventListener
    );
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  return (
    <li
      key={source}
      role="option"
      draggable={onMove ? "true" : undefined}
      onDrag={onMove ? handleDrag : undefined}
      onDragStart={onMove ? handleDragStart : undefined}
      onDragEnd={onMove ? handleDragEnd : undefined}
      onDragOver={onMove ? handleDragOver : undefined}
      data-index={index}
      className={cn(
        "flex justify-between items-center py-1",
        "data-[drag-active=true]:bg-transparent data-[drag-active=true]:text-transparent data-[drag-active=true]:outline data-[drag-active=true]:outline-1 data-[drag-active=true]:outline-border"
      )}
    >
      <label
        htmlFor={`switch_${index}`}
        className="flex items-center gap-2 cursor-pointer"
      >
        <Switch
          id={`switch_${index}`}
          checked={selected}
          onCheckedChange={onToggle}
          name={`${index}`}
        />
        <span className="text-sm">
          <FieldTitle label={label} source={source} resource={resource} />
        </span>
      </label>
      {onMove && (
        <GripVertical className="cursor-move dragIcon w-4 h-4 text-muted-foreground" />
      )}
    </li>
  );
};

export interface FieldToggleProps {
  selected: boolean;
  label: React.ReactNode;
  onToggle?: (event: boolean) => void;
  onMove?: (
    dragIndex: string | number,
    dropIndex: string | number | null
  ) => void;
  source: string;
  index: number | string;
}
