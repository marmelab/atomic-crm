import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import {
  formatCompactCurrency,
  type TopClientPoint,
} from "./dashboardModel";

export const DashboardTopClientsCard = ({
  data,
  year,
}: {
  data: TopClientPoint[];
  year: number;
}) => {
  const maxRevenue = data[0]?.revenue ?? 0;

  return (
    <Card className="gap-0">
      <CardHeader className="px-4 pb-3">
        <CardTitle className="text-base font-semibold">
          Clienti principali
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {!data.length ? (
          <p className="text-sm text-muted-foreground">
            Nessun fatturato disponibile per l'anno {year}.
          </p>
        ) : (
          <div className="space-y-4">
            {data.map((client, index) => (
              <div key={client.clientId} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <span className="text-muted-foreground mr-2">
                      {index + 1}.
                    </span>
                    <span className="font-medium truncate">
                      {client.clientName}
                    </span>
                  </div>
                  <span className="text-muted-foreground whitespace-nowrap">
                    {formatCompactCurrency(client.revenue)}
                  </span>
                </div>
                <Progress
                  value={maxRevenue ? (client.revenue / maxRevenue) * 100 : 0}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
