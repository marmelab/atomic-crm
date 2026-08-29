import { ShowBase, useRefresh, useShowContext, useUpdate } from "ra-core";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface GraphDeal {
  id: string;
  name: string;
  amount_cents: number | null;
  pipeline_name: string;
  stage_id: string;
  stage_label: string;
  parties: {
    contact_id: string;
    first_name: string;
    last_name: string;
    role: string;
    is_primary: boolean;
  }[];
  stages: { id: string; label: string; sort_index: number }[];
}

export function GraphDealShow() {
  return (
    <ShowBase>
      <DealGraph />
    </ShowBase>
  );
}

function DealGraph() {
  const { record, isPending } = useShowContext<GraphDeal>();
  const [update, { isPending: isSaving }] = useUpdate();
  const refresh = useRefresh();
  if (isPending || !record) return null;

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{record.name}</h1>
        <p className="text-muted-foreground">
          {record.pipeline_name} · {record.stage_label}
          {record.amount_cents != null
            ? ` · $${(record.amount_cents / 100).toLocaleString()}`
            : ""}
        </p>
      </div>

      <section>
        <h2 className="font-medium mb-2">Parties</h2>
        <ul>
          {(record.parties ?? []).map((party) => (
            <li key={`${party.contact_id}-${party.role}`}>
              <Link className="underline" to={`/contacts/${party.contact_id}/show`}>
                {party.first_name} {party.last_name}
              </Link>{" "}
              — {party.role}
              {party.is_primary ? " (primary)" : ""}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-medium mb-2">Move stage</h2>
        <div className="flex flex-wrap gap-2">
          {(record.stages ?? []).map((stage) => (
            <Button
              key={stage.id}
              variant={stage.id === record.stage_id ? "default" : "outline"}
              disabled={isSaving || stage.id === record.stage_id}
              onClick={() =>
                update(
                  "deals",
                  {
                    id: record.id,
                    data: { stage_id: stage.id, stage_label: stage.label },
                    previousData: record,
                  },
                  { onSuccess: () => refresh() },
                )
              }
            >
              {stage.label}
            </Button>
          ))}
        </div>
      </section>
    </Card>
  );
}
