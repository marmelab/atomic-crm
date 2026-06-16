# Graph Report - .  (2026-06-18)

## Corpus Check
- 374 files · ~112,473 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1480 nodes · 4503 edges · 83 communities (81 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.81)
- Token cost: 62,286 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Admin Fields & Column Selector|Admin Fields & Column Selector]]
- [[_COMMUNITY_Settings Profile & Inputs|Settings Profile & Inputs]]
- [[_COMMUNITY_App Sidebar & Navigation|App Sidebar & Navigation]]
- [[_COMMUNITY_Company & Sales Forms|Company & Sales Forms]]
- [[_COMMUNITY_Theme, Locale & Mobile Nav|Theme, Locale & Mobile Nav]]
- [[_COMMUNITY_Activity Log Feed|Activity Log Feed]]
- [[_COMMUNITY_Company Detail View|Company Detail View]]
- [[_COMMUNITY_Fake Data Generators|Fake Data Generators]]
- [[_COMMUNITY_Admin Form Inputs|Admin Form Inputs]]
- [[_COMMUNITY_Confirm & Delete Dialogs|Confirm & Delete Dialogs]]
- [[_COMMUNITY_Reference & Guesser Inputs|Reference & Guesser Inputs]]
- [[_COMMUNITY_Company Inputs & Filters|Company Inputs & Filters]]
- [[_COMMUNITY_File Input & Attachments|File Input & Attachments]]
- [[_COMMUNITY_Data Table|Data Table]]
- [[_COMMUNITY_Core Types & Constants|Core Types & Constants]]
- [[_COMMUNITY_Filter Forms|Filter Forms]]
- [[_COMMUNITY_FakeRest Data Provider|FakeRest Data Provider]]
- [[_COMMUNITY_Contact Create & Edit|Contact Create & Edit]]
- [[_COMMUNITY_Tag Management|Tag Management]]
- [[_COMMUNITY_Supabase Data Provider|Supabase Data Provider]]
- [[_COMMUNITY_JSON Import|JSON Import]]
- [[_COMMUNITY_Task List & Filters|Task List & Filters]]
- [[_COMMUNITY_Bulk Actions Toolbar|Bulk Actions Toolbar]]
- [[_COMMUNITY_Admin Display Fields|Admin Display Fields]]
- [[_COMMUNITY_Notes Mobile & Markdown|Notes Mobile & Markdown]]
- [[_COMMUNITY_Breadcrumb & Drawer UI|Breadcrumb & Drawer UI]]
- [[_COMMUNITY_Simple List|Simple List]]
- [[_COMMUNITY_Admin Array & Record Fields|Admin Array & Record Fields]]
- [[_COMMUNITY_Autocomplete & Command|Autocomplete & Command]]
- [[_COMMUNITY_CreateEdit Sheets|Create/Edit Sheets]]
- [[_COMMUNITY_Reference Array Fields|Reference Array Fields]]
- [[_COMMUNITY_Reference Fields|Reference Fields]]
- [[_COMMUNITY_Deal Show & Notes|Deal Show & Notes]]
- [[_COMMUNITY_Contact Inputs & Aside|Contact Inputs & Aside]]
- [[_COMMUNITY_Contact Show Tests|Contact Show Tests]]
- [[_COMMUNITY_Company List|Company List]]
- [[_COMMUNITY_CRM Root & Config|CRM Root & Config]]
- [[_COMMUNITY_Export & Deal List|Export & Deal List]]
- [[_COMMUNITY_Header & User Menu|Header & User Menu]]
- [[_COMMUNITY_Buttons & SSO Auth|Buttons & SSO Auth]]
- [[_COMMUNITY_i18n Translations|i18n Translations]]
- [[_COMMUNITY_Contact CreateEdit Tests|Contact Create/Edit Tests]]
- [[_COMMUNITY_Settings Page|Settings Page]]
- [[_COMMUNITY_Item UI & Pagination|Item UI & Pagination]]
- [[_COMMUNITY_Auth, Loading & Errors|Auth, Loading & Errors]]
- [[_COMMUNITY_Layout & Notifications|Layout & Notifications]]
- [[_COMMUNITY_Avatar & Image Editor|Avatar & Image Editor]]
- [[_COMMUNITY_FakeRest Filter Transforms|FakeRest Filter Transforms]]
- [[_COMMUNITY_Import Page UI|Import Page UI]]
- [[_COMMUNITY_Contact CSV Import|Contact CSV Import]]
- [[_COMMUNITY_Contact Avatar & Favicon|Contact Avatar & Favicon]]
- [[_COMMUNITY_Deals Chart & Utils|Deals Chart & Utils]]
- [[_COMMUNITY_Create & Edit Views|Create & Edit Views]]
- [[_COMMUNITY_List Guesser|List Guesser]]
- [[_COMMUNITY_Empty States & Stepper|Empty States & Stepper]]
- [[_COMMUNITY_Count & Show Layout|Count & Show Layout]]
- [[_COMMUNITY_Date Time Input|Date Time Input]]
- [[_COMMUNITY_Deal Stages & Pipeline|Deal Stages & Pipeline]]
- [[_COMMUNITY_Dashboard & Login|Dashboard & Login]]
- [[_COMMUNITY_Admin Root|Admin Root]]
- [[_COMMUNITY_Tech Stack Docs|Tech Stack Docs]]
- [[_COMMUNITY_Text & Search Inputs|Text & Search Inputs]]
- [[_COMMUNITY_Contact List Tests|Contact List Tests]]
- [[_COMMUNITY_Note Inputs Mobile Tests|Note Inputs Mobile Tests]]
- [[_COMMUNITY_Notes Iterator Mobile|Notes Iterator Mobile]]
- [[_COMMUNITY_Edit & Show Buttons|Edit & Show Buttons]]
- [[_COMMUNITY_Error & Accordion UI|Error & Accordion UI]]
- [[_COMMUNITY_Theme Provider|Theme Provider]]
- [[_COMMUNITY_Note Inputs Tests|Note Inputs Tests]]
- [[_COMMUNITY_Field Toggle & Switch|Field Toggle & Switch]]
- [[_COMMUNITY_Contact List Filters|Contact List Filters]]
- [[_COMMUNITY_Contact Tasks & Task Sheet|Contact Tasks & Task Sheet]]
- [[_COMMUNITY_Password Reset Pages|Password Reset Pages]]
- [[_COMMUNITY_Contact List Mobile|Contact List Mobile]]
- [[_COMMUNITY_Create Suggestion Hook|Create Suggestion Hook]]
- [[_COMMUNITY_Alert UI|Alert UI]]
- [[_COMMUNITY_Spinner UI|Spinner UI]]
- [[_COMMUNITY_Badge Field|Badge Field]]
- [[_COMMUNITY_Contact Merge Logic|Contact Merge Logic]]
- [[_COMMUNITY_Bulk Export Hook|Bulk Export Hook]]
- [[_COMMUNITY_React Logo Asset|React Logo Asset]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 288 edges
2. `Button()` - 74 edges
3. `useConfigurationContext()` - 59 edges
4. `useIsMobile()` - 53 edges
5. `Contact` - 35 edges
6. `Card()` - 26 edges
7. `Db` - 23 edges
8. `useGetSalesName()` - 21 edges
9. `ReferenceField()` - 19 edges
10. `Company` - 19 edges

## Surprising Connections (you probably didn't know these)
- `BulkExportButton()` --calls--> `useBulkExport()`  [INFERRED]
  src/components/admin/bulk-export-button.tsx → src/hooks/useBulkExport.tsx
- `ArrayInput()` --calls--> `sanitizeInputRestProps()`  [INFERRED]
  src/components/admin/array-input.tsx → src/lib/sanitizeInputRestProps.ts
- `AuthError()` --calls--> `cn()`  [EXTRACTED]
  src/components/admin/authentication.tsx → src/lib/utils.ts
- `BooleanField()` --calls--> `cn()`  [EXTRACTED]
  src/components/admin/boolean-field.tsx → src/lib/utils.ts
- `CreateView()` --calls--> `cn()`  [EXTRACTED]
  src/components/admin/create.tsx → src/lib/utils.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Shadcn Admin Kit underlying tech stack** — admin_readme_tanstack_query, admin_readme_react_hook_form, admin_readme_react_router, admin_readme_ra_core, admin_readme_radix_ui, admin_readme_shadcn_ui [EXTRACTED 1.00]

## Communities (83 total, 2 thin omitted)

### Community 0 - "Admin Fields & Column Selector"
Cohesion: 0.06
Nodes (41): BooleanField(), BooleanFieldProps, ColumnsButton(), ColumnsButtonProps, ColumnsSelector(), ColumnsSelectorItem(), ColumnsSelectorItemProps, ColumnsSelectorProps (+33 more)

### Community 1 - "Settings Profile & Inputs"
Cohesion: 0.07
Nodes (27): SelectInputProps, StatusSelector(), StatusSelectorProps, ProfilePage(), SettingsPageMobile(), Pagination(), PaginationContent(), PaginationEllipsis() (+19 more)

### Community 2 - "App Sidebar & Navigation"
Cohesion: 0.10
Nodes (40): AppSidebar(), Layout(), cn(), NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink() (+32 more)

### Community 3 - "Company & Sales Forms"
Cohesion: 0.10
Nodes (24): CancelButton(), FormToolbar(), FormToolbarProps, SimpleForm(), SimpleFormProps, SalesFormData, CompanyAside(), CompanyCreate() (+16 more)

### Community 4 - "Theme, Locale & Mobile Nav"
Cohesion: 0.08
Nodes (25): LocalesMenuButton(), ThemeModeToggle(), useTheme(), ContactEditSheet(), ContactEditSheetProps, MobileNavigation(), NavigationButton(), EditSheet() (+17 more)

### Community 5 - "Activity Log Feed"
Cohesion: 0.15
Nodes (22): ActivityLog(), ActivityLogProps, ActivityLogCompanyCreated(), ActivityLogCompanyCreatedProps, ActivityLogContactCreated(), ActivityLogContactCreatedProps, ActivityLogContactNoteCreated(), ActivityLogContactNoteCreatedProps (+14 more)

### Community 6 - "Company Detail View"
Cohesion: 0.11
Nodes (19): TextField(), AdditionalInfo(), AddressInfo(), CompanyAsideProps, CompanyInfo(), ContextInfo(), DealsIterator(), ContactBackgroundInfo() (+11 more)

### Community 7 - "Fake Data Generators"
Cohesion: 0.14
Nodes (20): ContactNote, Deal, Task, contactGender, generateCompanies(), sizes, generateContactNotes(), generateContacts() (+12 more)

### Community 8 - "Admin Form Inputs"
Cohesion: 0.13
Nodes (23): ArrayInputProps, BooleanInputProps, convertDateToString(), DateInput(), DateInputProps, defaultFormat(), FormControl(), FormDescription() (+15 more)

### Community 9 - "Confirm & Delete Dialogs"
Cohesion: 0.13
Nodes (19): Confirm(), ConfirmProps, DeleteButton(), DeleteButtonProps, AddSavedQueryDialogProps, RemoveSavedQueryDialogProps, ContactMergeButton(), ContactMergeDialogProps (+11 more)

### Community 10 - "Reference & Guesser Inputs"
Cohesion: 0.10
Nodes (17): AutocompleteArrayInput(), AutocompleteInput(), editFieldTypes, EditGuesserProps, NumberInput(), defaultFilter, ReferenceArrayInput(), ReferenceArrayInputProps (+9 more)

### Community 11 - "Company Inputs & Filters"
Cohesion: 0.10
Nodes (13): ArrayInput(), getIsSelected(), ToggleFilterButton(), CompanyContextInputs(), CompanyListFilter(), companySizeTranslationKeys, defaultCompanySizeLabels, getTranslatedCompanySizeLabel() (+5 more)

### Community 12 - "File Input & Attachments"
Cohesion: 0.14
Nodes (14): FileFieldProps, FileInput(), FileInputPreview(), FileInputPreviewProps, FileInputProps, TransformedFile, AttachmentField(), isImageMimeType() (+6 more)

### Community 13 - "Data Table"
Cohesion: 0.10
Nodes (18): DataTable(), DataTableCell(), DataTableColumnProps, DataTableHeadCell(), DataTableNumberColumn(), DataTableNumberColumnProps, DataTableProps, DataTableRow() (+10 more)

### Community 14 - "Core Types & Constants"
Cohesion: 0.14
Nodes (21): COMPANY_CREATED, CONTACT_CREATED, CONTACT_NOTE_CREATED, DEAL_CREATED, DEAL_NOTE_CREATED, Activity, ActivityCompanyCreated, ActivityContactCreated (+13 more)

### Community 15 - "Filter Forms"
Cohesion: 0.10
Nodes (18): emptyRecord, FilterButton(), FilterButtonMenuItem, FilterButtonMenuItemProps, FilterButtonProps, FilterForm(), FilterFormBaseProps, FilterFormInput() (+10 more)

### Community 16 - "FakeRest Data Provider"
Cohesion: 0.15
Nodes (12): Company, SignUpData, getCompanyAvatar(), authProvider, DEFAULT_USER, convertFileToBase64(), createDataProvider(), CreateFakeRestDataProviderOptions (+4 more)

### Community 17 - "Contact Create & Edit"
Cohesion: 0.15
Nodes (18): ContactGender, ContactCreate(), ContactCreateSheetProps, ContactEdit(), ContactEditContent(), normalizeContactArrayFields(), ContactInputs(), ContactList() (+10 more)

### Community 18 - "Tag Management"
Cohesion: 0.17
Nodes (15): Tag, BulkTagButton(), BulkTagDialogMode, TagsListEdit(), TagChip(), TagChipProps, TagCreateModal(), TagCreateModalProps (+7 more)

### Community 19 - "Supabase Data Provider"
Cohesion: 0.18
Nodes (16): canAccess(), CanAccessParams, clearCache(), getAuthProvider(), getBaseAuthProvider(), getIsInitialized(), getLocalStorage(), getSale() (+8 more)

### Community 20 - "JSON Import"
Cohesion: 0.09
Nodes (14): CompanyImport, ContactImport, defaultFailedImports, defaultStats, ImportFromJsonIdleState, ImportFromJsonImportingState, ImportFromJsonStats, ImportFromJsonSuccessState (+6 more)

### Community 21 - "Task List & Filters"
Cohesion: 0.17
Nodes (16): TasksIterator(), TasksListByDueDate(), TaskListFilter(), TaskListProps, createTask(), iso(), today, isBeforeFriday() (+8 more)

### Community 22 - "Bulk Actions Toolbar"
Cohesion: 0.14
Nodes (11): BulkActionsToolbar(), BulkActionsToolbarChildren(), BulkDeleteButton(), BulkDeleteButtonProps, BulkExportButton(), BulkExportButtonProps, sanitizeRestProps(), SelectAllButton() (+3 more)

### Community 23 - "Admin Display Fields"
Cohesion: 0.14
Nodes (11): EmailField, EmailFieldImpl(), EmailFieldProps, NumberField(), NumberFieldProps, SelectFieldProps, TextFieldProps, UrlField (+3 more)

### Community 24 - "Notes Mobile & Markdown"
Cohesion: 0.16
Nodes (11): MobileContent(), MobileHeader(), Markdown(), MarkdownProps, urlExtension, Status(), NoteAttachments(), NoteShowPage() (+3 more)

### Community 25 - "Breadcrumb & Drawer UI"
Cohesion: 0.16
Nodes (17): BreadcrumbProps, Breadcrumb(), BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage(), BreadcrumbSeparator() (+9 more)

### Community 26 - "Simple List"
Cohesion: 0.14
Nodes (15): ListNoResults(), ListNoResultsProps, ListPlaceholder(), ListPlaceholderProps, SimpleList(), SimpleListProps, FunctionLinkType, FunctionToElement (+7 more)

### Community 27 - "Admin Array & Record Fields"
Cohesion: 0.12
Nodes (11): ArrayField(), ArrayFieldProps, emptyArray, DateField, DateFieldProps, toLocaleStringSupportsLocales, NoInfer, RecordField() (+3 more)

### Community 28 - "Autocomplete & Command"
Cohesion: 0.18
Nodes (11): Command(), CommandEmpty(), CommandGroup(), CommandInput(), CommandItem(), CommandList(), CommandSeparator(), CommandShortcut() (+3 more)

### Community 29 - "Create/Edit Sheets"
Cohesion: 0.21
Nodes (12): SaveButton(), SearchInput(), CreateSheetProps, EditSheetProps, Sheet(), SheetClose(), SheetContent(), SheetFooter() (+4 more)

### Community 30 - "Reference Array Fields"
Cohesion: 0.18
Nodes (10): PureReferenceArrayFieldView, ReferenceArrayField(), ReferenceArrayFieldProps, ReferenceArrayFieldViewProps, SingleFieldList(), emptyArray, TextArrayInputProps, ColoredBadge() (+2 more)

### Community 31 - "Reference Fields"
Cohesion: 0.16
Nodes (8): ReferenceField(), ReferenceFieldProps, ReferenceFieldViewProps, ReferenceManyField(), ReferenceManyFieldProps, ReferenceManyFieldViewProps, SelectField, CompanyAvatar()

### Community 32 - "Deal Show & Notes"
Cohesion: 0.16
Nodes (9): Avatar(), ContactList(), DealShow(), AsideSectionProps, InfinitePagination(), Note(), NoteCreate(), NotesIterator() (+1 more)

### Community 33 - "Contact Inputs & Aside"
Cohesion: 0.15
Nodes (8): ContactAside(), ContactPersonalInformationInputs(), ContactStatusSelector(), translateContactGenderLabel(), translatePersonalInfoTypeLabel(), ContactPersonalInfo(), ExportVCardButton(), AsideSection()

### Community 34 - "Contact Show Tests"
Cohesion: 0.17
Nodes (9): ContactShow(), MobileSuccess(), successContacts, successContacts, mockIsMobile, defaultData, Mobile(), baseSale (+1 more)

### Community 35 - "Company List"
Cohesion: 0.16
Nodes (9): CreateButton(), CreateButtonProps, ListPagination(), CompanyCard(), CompanyEmpty(), CompanyList(), ImageList(), LoadingGridList() (+1 more)

### Community 36 - "CRM Root & Config"
Cohesion: 0.16
Nodes (9): DealList, CRM(), CRMProps, defaultStore, defaultCompanySectors, defaultDealCategories, defaultDealPipelineStatuses, defaultDealStages (+1 more)

### Community 37 - "Export & Deal List"
Cohesion: 0.17
Nodes (7): ExportButton(), ExportButtonProps, List(), DealList(), TopToolbar(), TopToolbarProps, filters

### Community 38 - "Header & User Menu"
Cohesion: 0.17
Nodes (12): RefreshButton(), UserMenu(), UserMenuContext, UserMenuContextValue, useUserMenu(), ChangelogMenuItem(), Header(), ImportFromJsonMenuItem() (+4 more)

### Community 39 - "Buttons & SSO Auth"
Cohesion: 0.22
Nodes (9): ShowButton(), ShowButtonProps, SSOAuthButton(), SSOAuthButtonProps, RoundButton(), TagForm(), TagFormProps, Button() (+1 more)

### Community 40 - "i18n Translations"
Cohesion: 0.17
Nodes (12): CrmMessages, DeepPartial, englishCrmMessages, MessageSchema, PartialCrmMessages, englishCatalog, frenchCatalog, getInitialLocale() (+4 more)

### Community 41 - "Contact Create/Edit Tests"
Cohesion: 0.24
Nodes (9): ContactCreateBasic(), ContactCreateBasicWithError(), ContactEditBasic(), ContactEditWithEmailsAndPhones(), ContactEditWithError(), ContactEditBasic(), ContactEditWithEmailsAndPhones(), ContactEditWithError() (+1 more)

### Community 42 - "Settings Page"
Cohesion: 0.17
Nodes (10): toSlug(), useConfigurationUpdater(), defaultConfiguration, ensureValues(), SECTIONS, SettingsForm(), SettingsPage(), transformFormValues() (+2 more)

### Community 43 - "Item UI & Pagination"
Cohesion: 0.17
Nodes (14): defaultOptions, InfinitePaginationProps, Item(), ItemActions(), ItemContent(), ItemDescription(), ItemFooter(), ItemGroup() (+6 more)

### Community 44 - "Auth, Loading & Errors"
Cohesion: 0.18
Nodes (10): AuthCallback(), AuthError(), AuthErrorProps, Loading(), LoadingProps, NotFound(), loaderVariants, Spinner() (+2 more)

### Community 45 - "Layout & Notifications"
Cohesion: 0.28
Nodes (8): Error(), Notification(), Layout(), MobileLayout(), ConfirmationRequired(), SignupPage(), useConfigurationLoader(), CrmDataProvider

### Community 46 - "Avatar & Image Editor"
Cohesion: 0.24
Nodes (9): UserMenuProps, ImageEditorDialogProps, ImageEditorFieldProps, Avatar(), AvatarFallback(), AvatarImage(), colorClasses, getAvatarColorClass() (+1 more)

### Community 47 - "FakeRest Filter Transforms"
Cohesion: 0.29
Nodes (7): parseList(), CONTAINS_FILTER_REGEX, transformContainsFilter(), transformFilter(), IN_FILTER_REGEX, transformInFilter(), transformOrFilter()

### Community 48 - "Import Page UI"
Cohesion: 0.15
Nodes (8): hasFailedImports(), ImportFromJsonSuccess(), ImportPage(), ImportFromJsonErrorState, ImportFromJsonFailures, ImportFromJsonFunction, ImportFromJsonState, useImportFromJson()

### Community 49 - "Contact CSV Import"
Cohesion: 0.21
Nodes (9): FileField(), ContactImportDialog(), ContactImportModalProps, millisecondsToTime(), ContactImportSchema, useContactImport(), Import, usePapaParse() (+1 more)

### Community 50 - "Contact Avatar & Favicon"
Cohesion: 0.25
Nodes (10): Contact, EmailAndType, getContactAvatar(), getFaviconUrl(), getGravatarUrl(), hash(), processContactAvatar(), FetchParams (+2 more)

### Community 51 - "Deals Chart & Utils"
Cohesion: 0.21
Nodes (10): DealsChart, multiplier, threeMonthsAgo, DealCard(), DealColumn(), DealShowContent(), findDealLabel(), formatISODateString() (+2 more)

### Community 52 - "Create & Edit Views"
Cohesion: 0.18
Nodes (9): Breadcrumb(), Create(), CreateProps, CreateView(), CreateViewProps, EditProps, EditView(), EditViewProps (+1 more)

### Community 53 - "List Guesser"
Cohesion: 0.22
Nodes (6): GuesserEmpty(), GuesserEmptyProps, listFieldTypes, ListProps, ListView(), ListViewProps

### Community 54 - "Empty States & Stepper"
Cohesion: 0.29
Nodes (8): ContactCreateSheet(), ContactEmpty(), ContactImportButton(), DashboardStepper(), DealCreate(), DealEmpty(), useAppBarHeight(), Progress()

### Community 55 - "Count & Show Layout"
Cohesion: 0.17
Nodes (4): CountProps, ImageField(), ImageFieldProps, ReferenceManyCountProps

### Community 56 - "Date Time Input"
Cohesion: 0.24
Nodes (8): convertDateToString(), DateTimeInput(), DateTimeInputProps, formatDateTime(), leftPad2, leftPad4, useForkRef(), Input()

### Community 57 - "Deal Stages & Pipeline"
Cohesion: 0.30
Nodes (7): DealStage, LabeledValue, NoteStatus, DealListContent(), DealsByStage, getDealsByStage(), ConfigurationContextValue

### Community 58 - "Dashboard & Login"
Cohesion: 0.23
Nodes (8): DealsPipeline(), MobileDashboard(), Wrapper(), Welcome(), LoginPage(), LoginSkeleton(), StartPage(), useConfigurationContext()

### Community 59 - "Admin Root"
Cohesion: 0.24
Nodes (5): Admin(), defaultStore, LoginPage(), Ready(), i18nProvider

### Community 60 - "Tech Stack Docs"
Cohesion: 0.24
Nodes (11): Admin Components (Shadcn Admin Kit), Mutable Dependency Customization Pattern, ra-core, Radix UI, React Hook Form, React Router, Shadcn Admin Kit, Shadcn UI (+3 more)

### Community 61 - "Text & Search Inputs"
Cohesion: 0.29
Nodes (6): BooleanInput(), SearchInputProps, TextInput(), TextInputProps, SalesInputs(), Textarea()

### Community 62 - "Contact List Tests"
Cohesion: 0.31
Nodes (7): BulkTagButton(), dataForBulkAddTag, DesktopEmpty(), DesktopError(), DesktopLoading(), DesktopSuccess(), successContacts

### Community 63 - "Note Inputs Mobile Tests"
Cohesion: 0.20
Nodes (7): NoteInputsMobile(), Default, NoteInputsMobileStoryProps, Story, WithAttachmentDefault, WithSelectContact, { Default, WithAttachmentDefault, WithSelectContact }

### Community 64 - "Notes Iterator Mobile"
Cohesion: 0.22
Nodes (3): NotesIteratorMobile(), singleNote, ImmediateIntersectionObserver

### Community 65 - "Edit & Show Buttons"
Cohesion: 0.28
Nodes (5): EditButton(), EditButtonProps, ShowProps, ShowView(), ShowViewProps

### Community 66 - "Error & Accordion UI"
Cohesion: 0.33
Nodes (6): ErrorProps, InternalErrorProps, Accordion(), AccordionContent(), AccordionItem(), AccordionTrigger()

### Community 67 - "Theme Provider"
Cohesion: 0.31
Nodes (6): initialState, Theme, ThemeProviderContext, ThemeProviderState, ThemeProvider(), ThemeProviderProps

### Community 68 - "Note Inputs Tests"
Cohesion: 0.25
Nodes (7): Default, NoteInputsStory(), NoteInputsStoryProps, Story, WithAttachmentDefault, WithSaveButton, { Default, WithAttachmentDefault, WithSaveButton }

### Community 69 - "Field Toggle & Switch"
Cohesion: 0.36
Nodes (4): FieldToggleProps, OnlyMineInput(), Label(), Switch()

### Community 70 - "Contact List Filters"
Cohesion: 0.32
Nodes (5): ContactListFilter(), ContactListFilterSummary(), ActiveFilterButton(), getIsSelected(), ResponsiveFilters()

### Community 71 - "Contact Tasks & Task Sheet"
Cohesion: 0.32
Nodes (5): ContactTasksList(), CreateSheet(), TaskCreateSheet(), TaskCreateSheetProps, Skeleton()

### Community 72 - "Password Reset Pages"
Cohesion: 0.32
Nodes (5): ForgotPasswordPage(), FormData, Layout(), SetPasswordFormData, SetPasswordPage()

### Community 74 - "Create Suggestion Hook"
Cohesion: 0.29
Nodes (5): CreateSuggestionContext, CreateSuggestionContextValue, OnCreateHandler, SupportCreateSuggestionOptions, UseSupportCreateValue

### Community 75 - "Alert UI"
Cohesion: 0.50
Nodes (4): Alert(), AlertDescription(), AlertTitle(), alertVariants

### Community 76 - "Spinner UI"
Cohesion: 0.60
Nodes (4): loaderVariants, Spinner(), SpinnerContentProps, spinnerVariants

### Community 77 - "Badge Field"
Cohesion: 0.67
Nodes (3): BadgeField(), BadgeFieldProps, BadgeProps

### Community 78 - "Contact Merge Logic"
Cohesion: 0.83
Nodes (3): mergeArraysUnique(), mergeContacts(), mergeObjectArraysUnique()

### Community 79 - "Bulk Export Hook"
Cohesion: 0.50
Nodes (3): ResourceInformation, useBulkExport(), UseBulkExportProps

## Knowledge Gaps
- **223 isolated node(s):** `defaultStore`, `ArrayFieldProps`, `emptyArray`, `ArrayInputProps`, `AuthErrorProps` (+218 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `App Sidebar & Navigation` to `Admin Fields & Column Selector`, `Settings Profile & Inputs`, `Company & Sales Forms`, `Theme, Locale & Mobile Nav`, `Company Detail View`, `Admin Form Inputs`, `Confirm & Delete Dialogs`, `Reference & Guesser Inputs`, `Company Inputs & Filters`, `File Input & Attachments`, `Data Table`, `Filter Forms`, `Bulk Actions Toolbar`, `Admin Display Fields`, `Notes Mobile & Markdown`, `Breadcrumb & Drawer UI`, `Simple List`, `Admin Array & Record Fields`, `Autocomplete & Command`, `Create/Edit Sheets`, `Reference Array Fields`, `Deal Show & Notes`, `Contact Inputs & Aside`, `Company List`, `Export & Deal List`, `Buttons & SSO Auth`, `Item UI & Pagination`, `Auth, Loading & Errors`, `Avatar & Image Editor`, `Import Page UI`, `Contact CSV Import`, `Create & Edit Views`, `List Guesser`, `Empty States & Stepper`, `Count & Show Layout`, `Date Time Input`, `Text & Search Inputs`, `Edit & Show Buttons`, `Error & Accordion UI`, `Field Toggle & Switch`, `Contact List Filters`, `Contact Tasks & Task Sheet`, `Alert UI`, `Spinner UI`?**
  _High betweenness centrality (0.261) - this node is a cross-community bridge._
- **Why does `Button()` connect `Buttons & SSO Auth` to `Admin Fields & Column Selector`, `Settings Profile & Inputs`, `App Sidebar & Navigation`, `Company & Sales Forms`, `Theme, Locale & Mobile Nav`, `Activity Log Feed`, `Company Detail View`, `Admin Form Inputs`, `Confirm & Delete Dialogs`, `Company Inputs & Filters`, `File Input & Attachments`, `Data Table`, `Filter Forms`, `Tag Management`, `Bulk Actions Toolbar`, `Notes Mobile & Markdown`, `Breadcrumb & Drawer UI`, `Simple List`, `Autocomplete & Command`, `Create/Edit Sheets`, `Deal Show & Notes`, `Contact Inputs & Aside`, `Export & Deal List`, `Header & User Menu`, `Settings Page`, `Auth, Loading & Errors`, `Layout & Notifications`, `Avatar & Image Editor`, `Import Page UI`, `Contact CSV Import`, `Empty States & Stepper`, `Admin Root`, `Text & Search Inputs`, `Error & Accordion UI`, `Contact List Filters`, `Contact Tasks & Task Sheet`, `Password Reset Pages`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Why does `useIsMobile()` connect `Activity Log Feed` to `Admin Fields & Column Selector`, `Settings Profile & Inputs`, `App Sidebar & Navigation`, `Company & Sales Forms`, `Theme, Locale & Mobile Nav`, `Company Detail View`, `Reference & Guesser Inputs`, `Company Inputs & Filters`, `Contact Create & Edit`, `Task List & Filters`, `Breadcrumb & Drawer UI`, `Create/Edit Sheets`, `Deal Show & Notes`, `Contact Inputs & Aside`, `Contact Show Tests`, `CRM Root & Config`, `Header & User Menu`, `Create & Edit Views`, `Empty States & Stepper`, `Contact List Filters`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **What connects `defaultStore`, `ArrayFieldProps`, `emptyArray` to the rest of the system?**
  _223 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Admin Fields & Column Selector` be split into smaller, more focused modules?**
  _Cohesion score 0.06168831168831169 - nodes in this community are weakly interconnected._
- **Should `Settings Profile & Inputs` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Should `App Sidebar & Navigation` be split into smaller, more focused modules?**
  _Cohesion score 0.0966183574879227 - nodes in this community are weakly interconnected._