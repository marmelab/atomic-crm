import { useState } from "react";
import { useGetList, useCreate, useUpdate, useDelete, useGetIdentity } from "ra-core";
import { Plus, Edit, Trash2, GripVertical, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { CustomFieldDefinition, CustomFieldEntityType } from "../types";
import { CustomFieldDialog } from "./CustomFieldDialog";

export const CustomFieldsManager = () => {
  const { identity } = useGetIdentity();
  const [selectedEntity, setSelectedEntity] = useState<CustomFieldEntityType>("contact");

  if (!identity?.administrator) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">
            You need administrator privileges to manage custom fields.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Custom Fields</h1>
        <p className="text-muted-foreground mt-2">
          Create and manage custom fields for your workspace. Custom fields allow you to capture
          data specific to your business needs.
        </p>
      </div>

      <Tabs value={selectedEntity} onValueChange={(v) => setSelectedEntity(v as CustomFieldEntityType)}>
        <TabsList>
          <TabsTrigger value="contact">Contacts</TabsTrigger>
          <TabsTrigger value="company">Companies</TabsTrigger>
          <TabsTrigger value="deal">Deals</TabsTrigger>
        </TabsList>

        <TabsContent value="contact" className="mt-6">
          <CustomFieldsList entityType="contact" />
        </TabsContent>
        <TabsContent value="company" className="mt-6">
          <CustomFieldsList entityType="company" />
        </TabsContent>
        <TabsContent value="deal" className="mt-6">
          <CustomFieldsList entityType="deal" />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const CustomFieldsList = ({ entityType }: { entityType: CustomFieldEntityType }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null);

  const { data, isPending, refetch } = useGetList<CustomFieldDefinition>(
    "custom_field_definitions",
    {
      filter: { entity_type: entityType, is_active: true },
      sort: { field: "sort_order", order: "ASC" },
      pagination: { page: 1, perPage: 100 },
    }
  );

  const [deleteField] = useDelete();
  const [updateField] = useUpdate();

  const handleEdit = (field: CustomFieldDefinition) => {
    setEditingField(field);
    setDialogOpen(true);
  };

  const handleDelete = async (field: CustomFieldDefinition) => {
    if (!confirm(`Are you sure you want to delete the field "${field.label}"?`)) return;

    await deleteField("custom_field_definitions", { id: field.id });
    refetch();
  };

  const handleToggleActive = async (field: CustomFieldDefinition) => {
    await updateField("custom_field_definitions", {
      id: field.id,
      data: { is_active: !field.is_active },
    });
    refetch();
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingField(null);
    refetch();
  };

  if (isPending) {
    return <CustomFieldsListSkeleton />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {data?.length || 0} custom field{data?.length !== 1 ? "s" : ""}
        </p>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Field
        </Button>
      </div>

      {!data?.length ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground mb-4">
              No custom fields yet. Create your first field to get started.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Field
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.map((field) => (
            <Card key={field.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{field.label}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {field.data_type}
                      </Badge>
                      {field.is_required && (
                        <Badge variant="destructive" className="text-xs">
                          Required
                        </Badge>
                      )}
                      {field.is_filterable && (
                        <Badge variant="outline" className="text-xs">
                          Filterable
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Key: <code className="text-xs bg-secondary px-1 py-0.5 rounded">
                        {field.key}
                      </code>
                      {field.help_text && <span className="ml-2">· {field.help_text}</span>}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleActive(field)}
                      title={field.is_active ? "Deactivate" : "Activate"}
                    >
                      {field.is_active ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(field)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(field)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CustomFieldDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        entityType={entityType}
        editingField={editingField}
      />
    </div>
  );
};

const CustomFieldsListSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => (
      <Card key={i}>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-5 w-5" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);
