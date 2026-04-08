import { Users } from "lucide-react";
import { useGetList } from "ra-core";
import { memo, useMemo } from "react";

type Contact = {
  id: number;
  lead_source_id?: string | null;
};

type LeadSource = {
  id: string;
  name: string;
};

export const LeadSourcesBreakdown = memo(() => {
  const { data: contacts, isPending: contactsPending } = useGetList<Contact>(
    "contacts",
    { pagination: { page: 1, perPage: 500 } },
  );

  const { data: leadSources, isPending: leadSourcesPending } =
    useGetList<LeadSource>("lead_sources", {
      pagination: { page: 1, perPage: 100 },
    });

  const grouped = useMemo(() => {
    if (!contacts || !leadSources) return [];

    const sourceMap = new Map<string, string>();
    for (const ls of leadSources) {
      sourceMap.set(ls.id, ls.name);
    }

    const counts: Record<string, number> = {};
    for (const contact of contacts) {
      const sourceName = contact.lead_source_id
        ? sourceMap.get(contact.lead_source_id) ?? "Unknown"
        : "No Source";
      counts[sourceName] = (counts[sourceName] ?? 0) + 1;
    }

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [contacts, leadSources]);

  if (contactsPending || leadSourcesPending) return null;
  if (grouped.length === 0) return null;

  const total = grouped.reduce((sum, { count }) => sum + count, 0);

  return (
    <div className="flex flex-col">
      <div className="flex items-center mb-4">
        <div className="mr-3 flex">
          <Users className="text-muted-foreground w-5 h-5" />
        </div>
        <h2 className="text-lg font-semibold text-muted-foreground">
          Lead Sources
        </h2>
      </div>
      <div className="space-y-2">
        {grouped.map(({ name, count }) => {
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={name} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{name}</span>
                <span className="text-xs text-muted-foreground">
                  {count} ({pct}%)
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
