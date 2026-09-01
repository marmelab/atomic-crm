import { useEffect, useState } from "react";
import { ListBase, useListContext } from "ra-core";
import { Link, useSearchParams } from "react-router";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface GraphContact {
  id: string;
  first_name: string;
  last_name: string;
  primary_type?: string | null;
}

export function GraphContactList() {
  const [params] = useSearchParams();
  const q = params.get("q") ?? undefined;
  return (
    <ListBase
      perPage={200}
      sort={{ field: "last_name", order: "ASC" }}
      filter={q ? { q } : undefined}
    >
      <ContactRows />
    </ListBase>
  );
}

function ContactRows() {
  const { data, isPending } = useListContext<GraphContact>();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = new URLSearchParams(params);
      const trimmed = q.trim();
      if (trimmed) next.set("q", trimmed);
      else next.delete("q");
      if (next.toString() !== params.toString()) setParams(next);
    }, 200);
    return () => window.clearTimeout(handle);
  }, [q, params, setParams]);

  if (isPending && !data) return null;

  return (
    <Card className="p-4">
      <h1 className="text-xl font-semibold mb-4">Contacts</h1>
      <div className="mb-4">
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search name or NMLS"
          className="w-72"
          aria-label="Search name or NMLS"
        />
      </div>
      <ul className="divide-y">
        {(data ?? []).map((row) => (
          <li key={row.id} className="py-2">
            <Link className="underline" to={`/contacts/${row.id}/show`}>
              {row.first_name} {row.last_name}
            </Link>
            {row.primary_type ? (
              <span className="text-muted-foreground">
                {" "}
                · {row.primary_type}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
