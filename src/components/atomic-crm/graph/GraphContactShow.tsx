import { ShowBase, useShowContext } from "ra-core";
import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import { GraphMergeButton } from "./GraphMergeButton";

interface GraphContact {
  id: string;
  first_name: string;
  last_name: string;
  types: { type_id: string; is_primary: boolean }[];
  identifiers: { id: string; id_type: string; value: string }[];
  affiliations: {
    id: string;
    company_id: string;
    company_name: string;
    parent_company_id: string | null;
    parent_company_name: string | null;
    role: string | null;
  }[];
  links: {
    id: string;
    link_type_id: string;
    from_id: string;
    to_id: string;
    from_name: string | null;
    to_name: string | null;
  }[];
  deals: { deal_id: string; deal_name: string; role: string }[];
  merged_into_id?: string | null;
}

export function GraphContactShow() {
  return (
    <ShowBase>
      <ContactGraph />
    </ShowBase>
  );
}

function ContactGraph() {
  const { record, isPending } = useShowContext<GraphContact>();
  if (isPending || !record) return null;

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {record.first_name} {record.last_name}
        </h1>
        <div className="flex gap-2 mt-2 flex-wrap">
          {(record.types ?? []).map((type) => (
            <Badge
              key={type.type_id}
              variant={type.is_primary ? "default" : "secondary"}
            >
              {type.type_id}
            </Badge>
          ))}
        </div>
        {record.merged_into_id ? (
          <p className="text-sm mt-2">
            Merged into{" "}
            <Link
              className="underline"
              to={`/contacts/${record.merged_into_id}/show`}
            >
              surviving contact
            </Link>
          </p>
        ) : (
          <div className="mt-4">
            <GraphMergeButton
              loserId={record.id}
              firstName={record.first_name}
              lastName={record.last_name}
            />
          </div>
        )}
      </div>

      <section>
        <h2 className="font-medium mb-2">Identifiers</h2>
        {(record.identifiers ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">None</p>
        ) : (
          <ul>
            {record.identifiers.map((id) => (
              <li key={id.id}>
                {id.id_type}: {id.value}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-medium mb-2">Team / affiliations</h2>
        <ul>
          {(record.affiliations ?? []).map((aff) => (
            <li key={aff.id}>
              <Link
                className="underline"
                to={`/companies/${aff.company_id}/show`}
              >
                {aff.company_name}
              </Link>
              {aff.parent_company_name
                ? ` (under ${aff.parent_company_name})`
                : ""}
              {aff.role ? ` — ${aff.role}` : ""}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-medium mb-2">Related</h2>
        <ul>
          {(record.links ?? []).map((link) => {
            const otherId =
              link.from_id === record.id ? link.to_id : link.from_id;
            const otherName =
              link.from_id === record.id ? link.to_name : link.from_name;
            return (
              <li key={link.id}>
                {link.link_type_id}:{" "}
                <Link className="underline" to={`/contacts/${otherId}/show`}>
                  {otherName || "related contact"}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {(record.types ?? []).some(
        (type) =>
          type.type_id === "employee" || type.type_id === "loan_officer",
      ) ? (
        <section>
          <h2 className="font-medium mb-2">OPTAH / Coaching</h2>
          <p className="text-sm text-muted-foreground">Coming.</p>
        </section>
      ) : null}

      <section>
        <h2 className="font-medium mb-2">Deals</h2>
        <ul>
          {(record.deals ?? []).map((deal) => (
            <li key={`${deal.deal_id}-${deal.role}`}>
              <Link className="underline" to={`/deals/${deal.deal_id}/show`}>
                {deal.deal_name}
              </Link>{" "}
              ({deal.role})
            </li>
          ))}
        </ul>
      </section>
    </Card>
  );
}
