import { ListBase, useGetList, useListContext } from "ra-core";
import { Link } from "react-router";

import { Card } from "@/components/ui/card";

interface GraphDeal {
  id: string;
  name: string;
  stage_id: string;
  pipeline_id: string;
  amount_cents: number | null;
}

interface PipelineStage {
  id: string;
  pipeline_id: string;
  label: string;
  sort_index: number;
}

export function GraphDealList() {
  return (
    <ListBase perPage={100}>
      <DealBoard />
    </ListBase>
  );
}

function DealBoard() {
  const { data, isPending } = useListContext<GraphDeal>();
  const { data: stages } = useGetList<PipelineStage>("pipeline_stages", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "sort_index", order: "ASC" },
  });

  if (isPending) return null;

  const columns = (stages ?? []).length
    ? stages
    : uniqueStages(data ?? []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Deals</h1>
      <div className="flex gap-4 overflow-x-auto">
        {columns.map((stage) => (
          <Card key={stage.id} className="min-w-64 p-3">
            <h2 className="font-medium mb-2">{stage.label}</h2>
            <ul className="space-y-2">
              {(data ?? [])
                .filter((deal) => deal.stage_id === stage.id)
                .map((deal) => (
                  <li key={deal.id}>
                    <Link className="underline" to={`/deals/${deal.id}/show`}>
                      {deal.name}
                    </Link>
                    {deal.amount_cents != null ? (
                      <div className="text-sm text-muted-foreground">
                        ${(deal.amount_cents / 100).toLocaleString()}
                      </div>
                    ) : null}
                  </li>
                ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}

function uniqueStages(deals: GraphDeal[]): PipelineStage[] {
  const seen = new Map<string, PipelineStage>();
  for (const deal of deals) {
    if (!seen.has(deal.stage_id)) {
      seen.set(deal.stage_id, {
        id: deal.stage_id,
        pipeline_id: deal.pipeline_id,
        label: deal.stage_id,
        sort_index: 0,
      });
    }
  }
  return [...seen.values()];
}
