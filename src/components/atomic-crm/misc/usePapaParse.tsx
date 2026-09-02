import * as Papa from "papaparse";
import { useCallback, useMemo, useRef, useState } from "react";

type Import =
  | {
      state: "idle";
    }
  | {
      state: "parsing";
    }
  | {
      state: "running" | "complete";

      rowCount: number;
      importCount: number;
      errorCount: number;

      // The remaining time in milliseconds
      remainingTime: number | null;
    }
  | {
      state: "error";

      error: Error;
    };

type usePapaParseProps<T> = {
  // The import batch size
  batchSize?: number;

  // Columns to keep as text, because a leading zero is meaningful there
  textColumns?: string[];

  // processBatch returns the number of imported items
  processBatch(batch: T[]): Promise<number>;
};

export function usePapaParse<T>({
  batchSize = 10,
  textColumns,
  processBatch,
}: usePapaParseProps<T>) {
  const importIdRef = useRef<number>(0);

  const [importer, setImporter] = useState<Import>({
    state: "idle",
  });

  const reset = useCallback(() => {
    setImporter({
      state: "idle",
    });
    importIdRef.current += 1;
  }, []);

  const parseCsv = useCallback(
    (file: File) => {
      setImporter({
        state: "parsing",
      });

      const importId = importIdRef.current;
      Papa.parse<T>(file, {
        header: true,
        skipEmptyLines: true,
        async complete(results) {
          if (importIdRef.current !== importId) {
            return;
          }

          setImporter({
            state: "running",
            rowCount: results.data.length,
            errorCount: results.errors.length,
            importCount: 0,
            remainingTime: null,
          });

          let totalTime = 0;
          for (let i = 0; i < results.data.length; i += batchSize) {
            if (importIdRef.current !== importId) {
              return;
            }

            const batch = results.data.slice(i, i + batchSize);
            try {
              const start = Date.now();
              // A batch reports how many of its rows the backend accepted, so
              // the rows it refused count as errors while the records that did
              // land are not reported as failures.
              const created = await processBatch(batch);
              totalTime += Date.now() - start;

              const meanTime = totalTime / (i + batch.length);
              setImporter((previous) => {
                if (previous.state === "running") {
                  const importCount = previous.importCount + created;
                  const errorCount =
                    previous.errorCount + (batch.length - created);
                  return {
                    ...previous,
                    importCount,
                    errorCount,
                    remainingTime:
                      meanTime *
                      (results.data.length - importCount - errorCount),
                  };
                }
                return previous;
              });
            } catch (error) {
              console.error("Failed to import batch", error);
              setImporter((previous) =>
                previous.state === "running"
                  ? {
                      ...previous,
                      errorCount: previous.errorCount + batch.length,
                    }
                  : previous,
              );
            }
          }

          setImporter((previous) =>
            previous.state === "running"
              ? {
                  ...previous,
                  state: "complete",
                  remainingTime: null,
                }
              : previous,
          );
        },
        error(error) {
          console.error(error);
          setImporter({
            state: "error",
            error,
          });
        },
        // Numeric-looking cells are converted, except where a leading zero
        // carries meaning: a "02134" zipcode would be stored as 2134.
        dynamicTyping: (field) => !textColumns?.includes(String(field)),
      });
    },
    [batchSize, processBatch, textColumns],
  );

  return useMemo(
    () => ({
      importer,
      parseCsv,
      reset,
    }),
    [importer, parseCsv, reset],
  );
}
