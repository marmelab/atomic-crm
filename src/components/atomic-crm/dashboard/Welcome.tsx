import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Welcome = () => (
  <Card>
    <CardHeader className="px-4">
      <CardTitle>Practice-CRM — Eswatini Consulting</CardTitle>
    </CardHeader>
    <CardContent className="px-4">
      <p className="text-sm mb-4">
        Practice-CRM is a CRM and tax-compliance manager built for Eswatini
        Consulting. Manage clients, track ERS filing deadlines, and log billable
        time — all in one place.
      </p>
      <p className="text-sm">
        Get started by adding your first client company, then use the Compliance
        Calendar to generate their annual ERS filing schedule.
      </p>
    </CardContent>
  </Card>
);
