import { ShowBase, useShowContext } from "ra-core";
import { Link } from "react-router";

import { Card } from "@/components/ui/card";

interface GraphCompany {
  id: string;
  name: string;
  kind_id: string | null;
  parent: { id: string; name: string } | null;
  children: { id: string; name: string; kind_id: string | null }[];
  people: {
    contact_id: string;
    first_name: string;
    last_name: string;
    role: string | null;
  }[];
}

export function GraphCompanyShow() {
  return (
    <ShowBase>
      <CompanyGraph />
    </ShowBase>
  );
}

function CompanyGraph() {
  const { record, isPending } = useShowContext<GraphCompany>();
  if (isPending || !record) return null;

  return (
    <Card className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">{record.name}</h1>
      {record.kind_id ? (
        <p className="text-muted-foreground">{record.kind_id}</p>
      ) : null}

      <section>
        <h2 className="font-medium mb-2">Parent</h2>
        {record.parent ? (
          <Link className="underline" to={`/companies/${record.parent.id}/show`}>
            {record.parent.name}
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">None</p>
        )}
      </section>

      <section>
        <h2 className="font-medium mb-2">Children</h2>
        <ul>
          {(record.children ?? []).map((child) => (
            <li key={child.id}>
              <Link className="underline" to={`/companies/${child.id}/show`}>
                {child.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-medium mb-2">People</h2>
        <ul>
          {(record.people ?? []).map((person) => (
            <li key={person.contact_id}>
              <Link className="underline" to={`/contacts/${person.contact_id}/show`}>
                {person.first_name} {person.last_name}
              </Link>
              {person.role ? ` — ${person.role}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </Card>
  );
}
