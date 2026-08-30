import { type FormEvent } from "react";
import { ListBase, useListContext } from "ra-core";
import { Link, useSearchParams } from "react-router";

import { Card } from "@/components/ui/card";

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
  if (isPending) return null;

  const onSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("q");
    const next = new URLSearchParams(params);
    if (typeof value === "string" && value.trim()) next.set("q", value.trim());
    else next.delete("q");
    setParams(next);
  };

  return (
    <Card className="p-4">
      <h1 className="text-xl font-semibold mb-4">Contacts</h1>
      <form className="mb-4" onSubmit={onSearch}>
        <input
          name="q"
          defaultValue={params.get("q") ?? ""}
          placeholder="Search name or NMLS"
          className="border rounded px-2 py-1 w-72"
        />
      </form>
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
