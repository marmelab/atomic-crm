import { useState, useCallback, useRef, useEffect } from "react";

const STORAGE_PREFIX = "col-widths:";

/**
 * Hook for resizable table columns with localStorage persistence.
 *
 * Usage:
 *   const { getWidth, onResizeStart, headerRef } = useResizableColumns("services");
 *
 *   <Table style={{ tableLayout: "fixed" }}>
 *     <TableHeader ref={headerRef}>
 *       <TableRow>
 *         <ResizableHead onResizeStart={onResizeStart} colKey="date" width={getWidth("date")}>
 *           Data
 *         </ResizableHead>
 *       </TableRow>
 *     </TableHeader>
 *   </Table>
 */
export function useResizableColumns(resource: string) {
  const storageKey = STORAGE_PREFIX + resource;

  const [widths, setWidths] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Persist to localStorage on change
  const widthsRef = useRef(widths);
  widthsRef.current = widths;

  const persist = useCallback(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(widthsRef.current));
    } catch {
      // ignore quota errors
    }
  }, [storageKey]);

  const headerRef = useRef<HTMLTableSectionElement>(null);

  const getWidth = useCallback(
    (colKey: string): number | undefined => widths[colKey],
    [widths],
  );

  const onResizeStart = useCallback(
    (colKey: string, startX: number, startWidth: number) => {
      const onMouseMove = (e: MouseEvent) => {
        const delta = e.clientX - startX;
        const newWidth = Math.max(40, startWidth + delta);
        setWidths((prev) => ({ ...prev, [colKey]: newWidth }));
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        persist();
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [persist],
  );

  // Initialize widths from actual rendered column widths on first mount
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    if (!headerRef.current) return;
    const ths = headerRef.current.querySelectorAll("th[data-col-key]");
    if (ths.length === 0) return;
    initialized.current = true;

    // Only set widths for columns that don't already have a persisted width
    const initial: Record<string, number> = {};
    let hasNew = false;
    ths.forEach((th) => {
      const key = (th as HTMLElement).dataset.colKey!;
      if (!widthsRef.current[key]) {
        initial[key] = (th as HTMLElement).offsetWidth;
        hasNew = true;
      }
    });
    if (hasNew) {
      setWidths((prev) => ({ ...prev, ...initial }));
    }
  }, []);

  const resetWidths = useCallback(() => {
    setWidths({});
    initialized.current = false;
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }, [storageKey]);

  return { getWidth, onResizeStart, headerRef, resetWidths };
}
