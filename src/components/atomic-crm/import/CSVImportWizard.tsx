import { useState } from "react";
import { useCreate, useDataProvider, useGetIdentity } from "ra-core";
import Papa from "papaparse";
import { Upload, ArrowRight, ArrowLeft, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { CustomFieldEntityType } from "../types";

type CSVRow = Record<string, any>;

type MappingStep = {
  csvHeaders: string[];
  mapping: Record<string, string>;
};

const CONTACT_FIELDS = [
  { value: "first_name", label: "First Name" },
  { value: "last_name", label: "Last Name" },
  { value: "email_work", label: "Email (Work)" },
  { value: "email_home", label: "Email (Home)" },
  { value: "phone_work", label: "Phone (Work)" },
  { value: "phone_home", label: "Phone (Home)" },
  { value: "title", label: "Job Title" },
  { value: "company", label: "Company Name" },
  { value: "linkedin_url", label: "LinkedIn URL" },
  { value: "tags", label: "Tags (comma-separated)" },
  { value: "status", label: "Status" },
  { value: "background", label: "Background/Notes" },
];

const COMPANY_FIELDS = [
  { value: "name", label: "Company Name" },
  { value: "website", label: "Website" },
  { value: "phone_number", label: "Phone Number" },
  { value: "sector", label: "Industry Sector" },
  { value: "size", label: "Company Size" },
  { value: "linkedin_url", label: "LinkedIn URL" },
  { value: "address", label: "Address" },
  { value: "city", label: "City" },
  { value: "zipcode", label: "Zip Code" },
  { value: "country", label: "Country" },
  { value: "description", label: "Description" },
];

export const CSVImportWizard = ({ entityType }: { entityType: CustomFieldEntityType }) => {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(
    null
  );

  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider();

  const availableFields = entityType === "contact" ? CONTACT_FIELDS : COMPANY_FIELDS;

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);

    Papa.parse(uploadedFile, {
      header: true,
      complete: (results) => {
        setCsvData(results.data as CSVRow[]);

        // Auto-detect mappings using fuzzy matching
        const headers = results.meta.fields || [];
        const autoMapping: Record<string, string> = {};

        headers.forEach((header) => {
          const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, "");

          // Simple fuzzy matching
          for (const field of availableFields) {
            const fieldNormalized = field.label.toLowerCase().replace(/[^a-z0-9]/g, "");
            if (normalized.includes(fieldNormalized) || fieldNormalized.includes(normalized)) {
              autoMapping[header] = field.value;
              break;
            }
          }
        });

        setMapping(autoMapping);
        setStep(2);
      },
      error: (error) => {
        console.error("Error parsing CSV:", error);
      },
    });
  };

  const handleImport = async () => {
    setImporting(true);
    let success = 0;
    let failed = 0;

    try {
      // Process in batches
      const batchSize = 10;
      for (let i = 0; i < csvData.length; i += batchSize) {
        const batch = csvData.slice(i, i + batchSize);

        await Promise.allSettled(
          batch.map(async (row) => {
            const transformedData: any = {};

            // Map CSV columns to entity fields
            Object.entries(mapping).forEach(([csvColumn, fieldName]) => {
              if (row[csvColumn]) {
                transformedData[fieldName] = row[csvColumn];
              }
            });

            // Add required fields
            transformedData.sales_id = identity?.id;
            transformedData.workspace_id = identity?.workspace_id || 1;

            if (entityType === "contact") {
              transformedData.first_seen = new Date().toISOString();
              transformedData.last_seen = new Date().toISOString();

              // Handle email fields
              const email_jsonb = [];
              if (transformedData.email_work) {
                email_jsonb.push({ email: transformedData.email_work, type: "Work" });
                delete transformedData.email_work;
              }
              if (transformedData.email_home) {
                email_jsonb.push({ email: transformedData.email_home, type: "Home" });
                delete transformedData.email_home;
              }
              if (email_jsonb.length > 0) {
                transformedData.email_jsonb = email_jsonb;
              }

              // Handle phone fields
              const phone_jsonb = [];
              if (transformedData.phone_work) {
                phone_jsonb.push({ number: transformedData.phone_work, type: "Work" });
                delete transformedData.phone_work;
              }
              if (transformedData.phone_home) {
                phone_jsonb.push({ number: transformedData.phone_home, type: "Home" });
                delete transformedData.phone_home;
              }
              if (phone_jsonb.length > 0) {
                transformedData.phone_jsonb = phone_jsonb;
              }
            }

            if (entityType === "company") {
              transformedData.created_at = new Date().toISOString();
            }

            try {
              await dataProvider.create(entityType === "contact" ? "contacts" : "companies", {
                data: transformedData,
              });
              success++;
            } catch (error) {
              console.error("Error importing row:", error);
              failed++;
            }
          })
        );
      }

      setImportResult({ success, failed });
      setStep(4);
    } catch (error) {
      console.error("Import error:", error);
    } finally {
      setImporting(false);
    }
  };

  const csvHeaders = csvData.length > 0 ? Object.keys(csvData[0]) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Import {entityType === "contact" ? "Contacts" : "Companies"}
        </h1>
        <p className="text-muted-foreground mt-2">
          Upload a CSV file and map columns to import your data
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full ${
                s === step
                  ? "bg-primary text-primary-foreground"
                  : s < step
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {s < step ? <Check className="h-4 w-4" /> : s}
            </div>
            {s < 4 && (
              <div
                className={`w-24 h-1 mx-2 ${
                  s < step ? "bg-primary" : "bg-secondary"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Upload CSV File</CardTitle>
            <CardDescription>
              Select a CSV file containing your {entityType} data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed rounded-lg p-12 text-center">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Drag and drop your CSV file here, or click to browse
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />
              <Button asChild>
                <label htmlFor="csv-upload" className="cursor-pointer">
                  Choose File
                </label>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Map Columns */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Map Columns</CardTitle>
            <CardDescription>
              Map your CSV columns to {entityType} fields. AI has suggested mappings based on
              column names.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{csvData.length}</strong> rows detected in your CSV file
                </AlertDescription>
              </Alert>

              {csvHeaders.map((header) => (
                <div key={header} className="flex items-center gap-4">
                  <div className="flex-1">
                    <Badge variant="secondary">{header}</Badge>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <Select
                      value={mapping[header] || ""}
                      onValueChange={(value) =>
                        setMapping((prev) => ({ ...prev, [header]: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select field..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Skip this column</SelectItem>
                        {availableFields.map((field) => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={() => setStep(3)}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Preview</CardTitle>
            <CardDescription>
              Review the first few rows before importing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Ready to import <strong>{csvData.length}</strong> {entityType}s
                </AlertDescription>
              </Alert>

              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary">
                    <tr>
                      {Object.values(mapping)
                        .filter(Boolean)
                        .map((field) => (
                          <th key={field} className="px-4 py-2 text-left font-medium">
                            {field}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="border-t">
                        {Object.entries(mapping)
                          .filter(([_, field]) => field)
                          .map(([csvCol]) => (
                            <td key={csvCol} className="px-4 py-2">
                              {row[csvCol] || "-"}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? "Importing..." : "Start Import"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Complete */}
      {step === 4 && importResult && (
        <Card>
          <CardHeader>
            <CardTitle>Import Complete!</CardTitle>
            <CardDescription>Your data has been imported</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert>
                <Check className="h-4 w-4" />
                <AlertDescription>
                  Successfully imported <strong>{importResult.success}</strong> {entityType}s
                  {importResult.failed > 0 && (
                    <>
                      {" "}
                      · <strong>{importResult.failed}</strong> failed
                    </>
                  )}
                </AlertDescription>
              </Alert>

              <Button onClick={() => window.location.reload()}>Done</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
