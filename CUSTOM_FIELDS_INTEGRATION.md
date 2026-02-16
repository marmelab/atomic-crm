# Custom Fields Integration Guide

This guide shows how to integrate custom fields into your forms.

## Quick Start

### 1. Import the Dynamic Field Renderer

```typescript
import { DynamicFieldRenderer } from "../misc/DynamicFieldRenderer";
```

### 2. Add to Your Form Component

In any form component (ContactCreate, ContactEdit, CompanyCreate, etc.), wrap your form with `FormProvider` and add the `DynamicFieldRenderer`:

```typescript
import { FormProvider, useForm } from "react-hook-form";
import { DynamicFieldRenderer } from "../misc/DynamicFieldRenderer";

export const ContactForm = () => {
  const methods = useForm({
    defaultValues: {
      first_name: "",
      last_name: "",
      custom_fields: {}, // Initialize custom fields
    },
  });

  const onSubmit = (data) => {
    // custom_fields will be automatically included
    console.log(data);
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        {/* Your existing fields */}
        <Input {...methods.register("first_name")} />
        <Input {...methods.register("last_name")} />

        {/* Dynamic custom fields */}
        <DynamicFieldRenderer entityType="contact" />

        <Button type="submit">Save</Button>
      </form>
    </FormProvider>
  );
};
```

### 3. Handle Custom Fields in Submit

Custom fields are automatically included in the form data under `custom_fields`:

```typescript
const onSubmit = async (data) => {
  await dataProvider.create("contacts", {
    data: {
      ...data,
      // custom_fields is already part of data
      workspace_id: identity?.workspace_id,
    },
  });
};
```

## Complete Example: Contact Create Form

```typescript
import { useState } from "react";
import { useCreate, useGetIdentity, useNotify } from "ra-core";
import { FormProvider, useForm } from "react-hook-form";
import { DynamicFieldRenderer } from "../misc/DynamicFieldRenderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const ContactCreateWithCustomFields = () => {
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const [create, { isPending }] = useCreate();

  const methods = useForm({
    defaultValues: {
      first_name: "",
      last_name: "",
      email_jsonb: [],
      phone_jsonb: [],
      custom_fields: {}, // Important: Initialize as empty object
    },
  });

  const onSubmit = async (data) => {
    try {
      await create("contacts", {
        data: {
          ...data,
          workspace_id: identity?.workspace_id || 1,
          sales_id: identity?.id,
          first_seen: new Date().toISOString(),
          last_seen: new Date().toISOString(),
        },
      });
      notify("Contact created successfully");
    } catch (error) {
      notify("Error creating contact", { type: "error" });
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="first_name">First Name *</Label>
            <Input
              id="first_name"
              {...methods.register("first_name", { required: true })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="last_name">Last Name *</Label>
            <Input
              id="last_name"
              {...methods.register("last_name", { required: true })}
            />
          </div>
        </div>

        {/* Dynamic Custom Fields - Automatically renders all active custom fields */}
        <DynamicFieldRenderer entityType="contact" />

        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating..." : "Create Contact"}
        </Button>
      </form>
    </FormProvider>
  );
};
```

## Custom Fields in Filters

To filter by custom fields, use the JSONB containment operator:

```typescript
// Filter contacts where custom_fields.industry = "SaaS"
const filter = {
  "custom_fields@cs": JSON.stringify({ industry: "SaaS" }),
};

const { data } = useGetList("contacts", {
  filter,
  pagination: { page: 1, perPage: 25 },
});
```

## Managing Custom Fields (Admin Only)

1. Navigate to `/custom-fields` in the sidebar
2. Select entity type (Contacts, Companies, Deals)
3. Click "Add Field" to create a new custom field
4. Configure:
   - Label: Display name
   - Key: Internal field name (snake_case, immutable)
   - Type: Data type (text, number, date, dropdown, etc.)
   - Options: For dropdown fields
   - Required: Whether the field is mandatory
   - Filterable: Whether users can filter by this field

## CSV Import with Custom Fields

The CSV import wizard automatically includes custom fields:

1. Upload CSV file
2. Map columns to both standard and custom fields
3. Preview and import

Custom fields will be stored in the `custom_fields` JSONB column automatically.

## Database Structure

### custom_field_definitions Table

```sql
SELECT * FROM custom_field_definitions
WHERE entity_type = 'contact' AND is_active = true
ORDER BY sort_order;
```

### Storing Custom Field Values

Values are stored in the entity's `custom_fields` JSONB column:

```sql
-- Contact with custom fields
SELECT
  first_name,
  last_name,
  custom_fields->>'industry' as industry,
  custom_fields->>'lead_score' as lead_score
FROM contacts;
```

### Querying Custom Fields

```sql
-- Filter by custom field value
SELECT * FROM contacts
WHERE custom_fields @> '{"industry": "SaaS"}';

-- Filter by multiple custom fields
SELECT * FROM contacts
WHERE custom_fields @> '{"industry": "SaaS", "company_size": "50"}';
```

## Migration from Hardcoded Fields

The migrations automatically create custom field definitions for:
- Contact `gender` → custom field
- Company `sector` → custom field
- Company `size` → custom field

You can continue using the hardcoded columns for backward compatibility, or migrate the data:

```sql
-- Migrate company sector to custom_fields
UPDATE companies
SET custom_fields = custom_fields || jsonb_build_object('sector', sector)
WHERE sector IS NOT NULL;

-- Migrate company size to custom_fields
UPDATE companies
SET custom_fields = custom_fields || jsonb_build_object('size', size)
WHERE size IS NOT NULL;
```

## Best Practices

1. **Initialize custom_fields**: Always initialize as empty object `{}`
2. **Use FormProvider**: Wrap forms with `FormProvider` from react-hook-form
3. **Validation**: Custom field validation is handled automatically based on `is_required`
4. **Performance**: GIN indexes ensure fast queries on custom fields
5. **Naming**: Use snake_case for field keys (e.g., `lead_score`, not `leadScore`)
6. **Admin Access**: Only administrators can create/modify custom field definitions

## TypeScript Types

```typescript
import type { CustomFieldDefinition, CustomFieldEntityType } from "../types";

// Custom field value (stored in entity.custom_fields)
type CustomFieldValues = Record<string, any>;

// Example usage
const contact: Contact = {
  first_name: "John",
  last_name: "Doe",
  custom_fields: {
    industry: "SaaS",
    lead_score: 85,
    tags: ["hot-lead", "enterprise"],
  },
};
```
