# UI Components

The components in this directory come from [shadcn/ui](https://ui.shadcn.com/). They are low-level building blocks for creating user interfaces, including:

- Badges
- Buttons
- Cards
- Dialogs
- Forms Inputs
- Navigation MMenus
- Tables
- Tabs
- Tooltips
- And more...

These components are built on top of [Radix UI](https://www.radix-ui.com/) and styled using [Tailwind CSS](https://tailwindcss.com/).

## Documentation

You can find the documentation for these components on the [shadcn/ui website](https://ui.shadcn.com/docs).

## Customization

In Atomic CRM, these components are sometimes slightly modified to fit the look and feel of the application. You can customize them further by editing the source files in this directory.

## Updates

Shadcn/ui components are actively maintained and updated. To add or update a UI component in Atomic CRM, type the following command:

```
npx shadcn@latest add [component-name]
```

The admin components have a dependency on some ui components, so if you update the admin components, this will also update the ui components. Check [the admin components readme](../admin/Readme.md) for the command to update them.