import { useGetList } from "ra-core";
import { Link } from "react-router";

import { Card } from "@/components/ui/card";

interface SavedViewResult {
  id: string;
  label: string;
  href: string;
}

interface SavedView {
  id: string;
  name: string;
  object_type: string;
  results: SavedViewResult[];
}

export function GraphHome() {
  const { data, isPending } = useGetList<SavedView>("saved_views", {
    pagination: { page: 1, perPage: 20 },
    sort: { field: "name", order: "ASC" },
  });

  if (isPending) return null;

  const views = data ?? [];
  if (views.length === 0) {
    return (
      <Card className="p-6">
        <h1 className="text-xl font-semibold">Home</h1>
        <p className="text-sm text-muted-foreground mt-2">
          No saved views yet.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {views.map((view) => (
        <Card key={view.id} className="p-4">
          <h2 className="font-semibold mb-3">{view.name}</h2>
          {(view.results ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">None</p>
          ) : (
            <ul className="divide-y">
              {view.results.map((row) => (
                <li key={row.id} className="py-2">
                  <Link className="underline" to={row.href}>
                    {row.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}
    </div>
  );
}
