## v1.5.0 - 2026-03-10

Read about the updates online: [Atomic CRM March 2026 Updates](https://marmelab.com/blog/2026/03/13/atomic-crm-march-updates.html)

## Breaking Change

* table `contactNotes` has been renamed `contact_notes`
* table `dealNotes` has been renamed `deal_notes`
* column `stateAbbr` in table `companies` has been renamed `state_abbr`

You must run the migration to update your database schema:

```
make supabase-migrate-database
```

## What's Changed

* Replace React Admin with Shadcn Admin Kit by @Madeorsk in #104
* Add SSO support and documentation by @djhi in #159, #161
* Add Settings page by @fzaninotto in #162
* Add mail forwarding by @ThieryMichel in #185
* Add ability to import data from another CRM by @djhi in #133
* Add support for attachments in inbound emails by @slax57 in #158
* Add mobile app by @slax57 in #134
* Add support for multiple emails and phone numbers per contact by @slax57 in #80
* Add new fields to JSON import by @slax57 in #179
* Add ability to load older notes on demand by @ThieryMichel in #177
* Add custom telemetry by @djhi in #79
* Add a confirmation page when the first user needs to confirm their email by @Madeorsk in #155
* Add access control by @djhi in #70
* Fix consistency in table and field names by @djhi in #136
* Fix dates sometimes appearing shifted by 1 day by @ThieryMichel in #190
* Fix error message when user creation fails by @Madeorsk in #151
* Fix note list performance on mobile by @fzaninotto in #160
* Fix attachment previews by @djhi in #154
* Fix RLS policies on the sales table by @djhi in #74
* Fix on-the-fly company creation by @fzaninotto in #120
* Fix Deal list error by @djhi in #122
* Fix New Task dialog closing even if task is invalid by @fzaninotto in #85
* Fix signup error notification not being displayed by @WiXSL in #132
* Fix password recovery email sent notification not showing by @WiXSL in #165
* Fix Supabase authentication system for edge functions by @Madeorsk in #152
* Fix JWT locally by @Madeorsk in #153
* Fix mobile sheets height on Google Pixel devices by @slax57 in #172
* Fix mobile note/task/contact headers to use ellipsis by @WiXSL in #176
* Fix contact edit sheet header truncation on mobile by @WiXSL in #178
* Fix DateInput and DateTimeInput on mobile Safari by @slax57 in #180
* Fix ContactInput options cannot be scrolled on mobile by @slax57 in #181
* Fix note attachment deletion on note remove by @WiXSL in #171
* Fix remote init script by asking for org and region by @ThieryMichel in #191
* Fix supabase-remote-init and prod-start scripts by @slax57 in #143
* Fix Atomic registry components imports by @djhi in #118
* Fix registry.json missing files and dependencies by @slax57 in #197
* Fix UI contact component search input and icon contact filter by @mpsalunggg in #107
* Fix typos and remove unused imports by @eithe in #69
* Bump various dependencies (rollup, vitest, hono, lodash, dompurify, qs, devalue, storybook, minimatch, @modelcontextprotocol/sdk) by @dependabot[bot] in #67, #87, #130, #135, #137, #138, #142, #148, #149, #157, #166, #173, #174, #186, #187,  #188, #189, #194, #196
* [Doc] Improve documentation about initial production setup by @djhi in #77
* [Doc] Document email setup by @djhi in #71
* [Doc] Add Starlight documentation by @jonathanarnault in #110
* [Doc] Fix documentation links by @main-uk in #116, @djhi in #127
* [Doc] Add getting started link to menu and fix logo size by @jonathanarnault in #111
* [Chore] Refactor remote init script by @djhi in #76
* [Chore] Add registry file for Atomic CRM by @jonathanarnault in #115
* [Chore] Add a build-lib command to publish an atomic-crm node module by @ThieryMichel in #66
* [Chore] Allow TS sourcemaps in production by @djhi in #88
* [Chore] Improve GitHub community standards by @arimet in #73

## New Contributors
* @dependabot[bot] made their first contribution in https://github.com/marmelab/atomic-crm/pull/67
* @eithe made their first contribution in https://github.com/marmelab/atomic-crm/pull/69
* @djhi made their first contribution in https://github.com/marmelab/atomic-crm/pull/70
* @SxMShaDoW made their first contribution in https://github.com/marmelab/atomic-crm/pull/78
* @fzaninotto made their first contribution in https://github.com/marmelab/atomic-crm/pull/85
* @anthonycmain made their first contribution in https://github.com/marmelab/atomic-crm/pull/86
* @0xflotus made their first contribution in https://github.com/marmelab/atomic-crm/pull/93
* @erwanMarmelab made their first contribution in https://github.com/marmelab/atomic-crm/pull/96
* @Madeorsk made their first contribution in https://github.com/marmelab/atomic-crm/pull/104
* @mpsalunggg made their first contribution in https://github.com/marmelab/atomic-crm/pull/107
* @main-uk made their first contribution in https://github.com/marmelab/atomic-crm/pull/116
* @CMiksche made their first contribution in https://github.com/marmelab/atomic-crm/pull/123
* @WiXSL made their first contribution in https://github.com/marmelab/atomic-crm/pull/132

**Full Changelog**: https://github.com/marmelab/atomic-crm/compare/v1.0.0...v1.5.0

## v1.0.0 - 2026-03-10

## What's Changed
* Fix(ops): Upgrade packages by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/1
* Feat(signup): Add user signup support by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/3
* Feat(upload): Send files to storage supabase by @arimet in https://github.com/marmelab/atomic-crm/pull/4
* Fix(db): Add missing row policies to database by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/5
* Feat(crm): Backport demo features to atomic-crm by @arimet in https://github.com/marmelab/atomic-crm/pull/7
* Feat(database): Update columns to match the CRM demo types by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/2
* Feat(supabase): Update init project script by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/6
* Feat(atomic): Create view for companies and contact + ban users by @arimet in https://github.com/marmelab/atomic-crm/pull/10
* Feat(crm): Add supabase deploy scripts by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/9
* Feat(ops): Add deploy script by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/8
* Feat(ops): Add CI/CD pipeline by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/11
* Fix(init): Remove login required notification if crm is not initialized by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/13
* Feat(crm): Set isImage into dataProvider by @arimet in https://github.com/marmelab/atomic-crm/pull/12
* Fix(crm): Handle tags for Contact export by @arimet in https://github.com/marmelab/atomic-crm/pull/15
* Fix(crm): Set phone number into split fields + update getCompanyAvatar by @arimet in https://github.com/marmelab/atomic-crm/pull/14
* Fix(contacts): Return all sales in sales selector by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/16
* Fix(crm): Date validation + refactor uploadToBucket by @arimet in https://github.com/marmelab/atomic-crm/pull/19
* Fix(contact): Display LinkedIn profile as URL label in contact aside by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/18
* Fix(ops): GitHub pages were not pushed as expected by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/22
* Fix(crm): Apply suggestions from reviews by @arimet in https://github.com/marmelab/atomic-crm/pull/21
* Fix(ops): Github pages were not pushed as expected by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/24
* Fix(setting): Update current user information in supabase by @arimet in https://github.com/marmelab/atomic-crm/pull/23
* Feat(auth): Add reset-password for Sales by @arimet in https://github.com/marmelab/atomic-crm/pull/26
* Fix(crm): Handle deploy for Browser Router by @arimet in https://github.com/marmelab/atomic-crm/pull/30
* Fix(views): Add security invokers to views to avoid data leak by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/29
* Fix(deploy) by @arimet in https://github.com/marmelab/atomic-crm/pull/31
* Fix(deploy): Add supabase project url and anon key to CI/CD by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/32
* Fix(login): Fix admin base name by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/33
* Fix: Search contact + improve import contact. by @arimet in https://github.com/marmelab/atomic-crm/pull/28
* Feat(task): Associate task to an sales_id + improve documentation by @arimet in https://github.com/marmelab/atomic-crm/pull/25
* Fix(migrations): recreate contact_summary view in remove acquisition migration by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/35
* Feat(crm): Replace browserRouter with HashRouter and handle reset cal… by @arimet in https://github.com/marmelab/atomic-crm/pull/36
* Feat(auth): Update supabase password via CRM UI by @arimet in https://github.com/marmelab/atomic-crm/pull/34
* Feat(dataProvider): Add supabase to fakerest filter adapter by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/20
* Fix(deals): Company name was not displayed in deal show modal by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/38
* Fix(macOS): Update package lock to include rollup native binaries by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/41
* Add fake rest provider by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/27
* Feat(ops): Add option to deploy to another repository by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/37
* Feat(UI): Improve Dashboard and display Empty Pages only if no filters are present by @arimet in https://github.com/marmelab/atomic-crm/pull/40
* Feat(doc): Add linked supabase configuration guide by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/39
* Fix(ux): Reduce initial loading time by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/42
* Feat(mail): Add contact note via email by @slax57 in https://github.com/marmelab/atomic-crm/pull/17
* Fix(perf): Logout user if db has been reset and improve login page load performance by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/45
* Sec(init_state): init_state view is no longer leaking sales count by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/46
* fix(crm): Fix signup page logo color by @slax57 in https://github.com/marmelab/atomic-crm/pull/44
* Fix(avatar): Avatar upload does not fail anymore if no change in file… by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/48
* Feat(auth): Handle resetPassword and Invite user by @arimet in https://github.com/marmelab/atomic-crm/pull/43
* Feat(auth): For reseting user password, send reset email by @arimet in https://github.com/marmelab/atomic-crm/pull/47
* Fix(ops): Update cross deploy documentation by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/50
* Fix(import): tags and companies are no loger duplicated during imports by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/53
* fix(mail): Support recipient with empty Name by @slax57 in https://github.com/marmelab/atomic-crm/pull/52
* Feat(crm): Update mail templates by @arimet in https://github.com/marmelab/atomic-crm/pull/51
* fix(login): Fix user is not automatically logged in after signup by @slax57 in https://github.com/marmelab/atomic-crm/pull/49
* Fix(note): Improve note spacing by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/55
* Fix(mail): Add debug log when creating a user and add documentation about email rate limit by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/56
* Feat(task): Display Tasks for curent calendar week and not for seven … by @arimet in https://github.com/marmelab/atomic-crm/pull/54
* Feat(setting): Display inboud email for user by @arimet in https://github.com/marmelab/atomic-crm/pull/59
* Fix(avatar): Avatar deletion is now persisted as expected by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/57
* Fix(contact): Update last_seen when a note is added to the contact by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/58
* Feat(mailing): Add support for multiple recipients and fix some typos in mails by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/60
* Feat(tasks): Update contact last seen when creating a task by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/61
* Feat(task): Add task edit support by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/63
* Feat(doc): Improve documentation by @jonathanarnault in https://github.com/marmelab/atomic-crm/pull/64
* skip gh action task when needed secrets are missing by @ThieryMichel in https://github.com/marmelab/atomic-crm/pull/65


**Full Changelog**: https://github.com/marmelab/atomic-crm/commits/v1.0.0

