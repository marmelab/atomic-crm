import { ListBase, useListContext } from "ra-core";
import { Link } from "react-router";

import { Card } from "@/components/ui/card";

interface GraphContact {
  id: string;
  first_name: string;
  last_name: string;
  primary_type?: string | null;
}

export function GraphContactList() {
  return (
    <ListBase perPage={50} sort={{ field: "last_name", order: "ASC" }}>
      <ContactRows />
    </ListBase>
  );
}

function ContactRows() {
  const { data, isPending } = useListContext<GraphContact>();
  if (isPending) return null;

  return (
    <Card className="p-4">
      <h1 className="text-xl font-semibold mb-4">Contacts</h1>
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
