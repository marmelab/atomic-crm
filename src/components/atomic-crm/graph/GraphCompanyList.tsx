import { ListBase, useListContext } from "ra-core";
import { Link } from "react-router";

import { Card } from "@/components/ui/card";

interface GraphCompany {
  id: string;
  name: string;
  kind_id: string | null;
}

export function GraphCompanyList() {
  return (
    <ListBase perPage={50}>
      <CompanyRows />
    </ListBase>
  );
}

function CompanyRows() {
  const { data, isPending } = useListContext<GraphCompany>();
  if (isPending) return null;

  return (
    <Card className="p-4">
      <h1 className="text-xl font-semibold mb-4">Companies</h1>
      <ul className="divide-y">
        {(data ?? []).map((row) => (
          <li key={row.id} className="py-2">
            <Link className="underline" to={`/companies/${row.id}/show`}>
              {row.name}
            </Link>
            {row.kind_id ? (
              <span className="text-muted-foreground"> · {row.kind_id}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
