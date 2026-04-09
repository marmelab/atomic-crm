import { ShowBase, useShowContext } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EditButton } from "@/components/admin/edit-button";
import { DateField } from "@/components/admin/date-field";
import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";

import { TopToolbar } from "../layout/TopToolbar";
import type { ServiceContract } from "../types";
import {
  daysUntilRenewal,
  formatPrice,
  getStatusLabel,
  isExpiringSoon,
} from "./contractUtils";

const ShowActions = () => (
  <TopToolbar>
    <EditButton />
  </TopToolbar>
);

const ServiceContractShowContent = () => {
  const { record, isPending } = useShowContext<ServiceContract>();
  if (isPending || !record) return null;

  const days = daysUntilRenewal(record.renewal_date);
  const expiring = isExpiringSoon(record.renewal_date);

  return (
    <Card>
      <CardContent>
        <div className="flex flex-col gap-4 pt-4">
          <h2 className="text-2xl font-bold">{record.name}</h2>
          <div className="flex items-center gap-2">
            <Badge variant={expiring ? "destructive" : "default"}>
              {getStatusLabel(record.status)}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {days >= 0
                ? `Renouvellement dans ${days} jour(s)`
                : `Expiré depuis ${Math.abs(days)} jour(s)`}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Entreprise
              </p>
              <ReferenceField source="company_id" reference="companies">
                <TextField source="name" />
              </ReferenceField>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Date de renouvellement
              </p>
              <DateField source="renewal_date" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Montant annuel
              </p>
              <p>{formatPrice(record.amount)}</p>
            </div>
            {record.notes && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Notes
                </p>
                <p>{record.notes}</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const ServiceContractShow = () => (
  <ShowBase>
    <ShowActions />
    <div className="mt-2">
      <ServiceContractShowContent />
    </div>
  </ShowBase>
);

export default ServiceContractShow;
