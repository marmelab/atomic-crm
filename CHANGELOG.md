## v1.6.0 - 2026-09-22

## What's Changed

* Add i18n support by @WiXSL in #183
* Turn mobile settings dialog into a page by @fzaninotto in #206
* Make currency configurable by @fzaninotto in #210
* Improve font legibility by @fzaninotto in #211
* Add infinite pagination to the activity log by @fzaninotto in #212
* Add declarative database schemas by @fzaninotto in #213
* Add bulk contact tagging by @WiXSL in #224
* Add contact status sidebar by @WiXSL in #239
* Add infinite scroll to contact and deal notes by @WiXSL in #241
* Add grow on focus to the note input in contact show view by @fzaninotto in #253
* Add a Task list MCP app by @fzaninotto in #274
* Add a changelog page by @erwanMarmelab in #281
* Add ability to filter contacts by any account manager by @pysnooLab in #344
* Attach forwarded emails sent from a sale's secondary address by @pysnooLab in #345
* Add ability to import data from a CSV file by @erwanMarmelab in #348
* Add pull-to-refresh on mobile by @erwanMarmelab in #349
* Fix Supabase security advisor warnings about views and functions by @slax57 in #199
* Fix companies being created from blacklisted mail provider addresses on inbound mail by @ThieryMichel in #200
* Fix note form initialization by @ThieryMichel in #202
* Fix contact names extracted from inbound email not being capitalized by @ThieryMichel in #214
* Fix notes pagination race condition on mobile by @WiXSL in #216
* Fix ContactShow task count translation flicker by @WiXSL in #217
* Fix inbound email contact matching to be case-insensitive and improve company creation by @slax57 in #219
* Fix phone/email default values not clearing on submit when untouched by @ThieryMichel in #220
* Fix missing i18n keys by @slax57 in #221
* Fix supabase-remote-init project status check by @ThieryMichel in #229
* Fix empty notes being allowed by @WiXSL in #230
* Fix missing markdown styles by @slax57 in #231
* Fix deal Kanban bug by @ThieryMichel in #235
* Fix autocomplete input filtering with cmdk by adding a keyword field by @ThieryMichel in #237
* Fix choice list scrolling to the bottom while filtering by @ThieryMichel in #240
* Fix company selector overflow in the Deal form by @slax57 in #245
* Fix mobile note edition user experience by @fzaninotto in #252
* Fix missing grants for views in migrations by @jonathanarnault in #292
* Fix add-note button overflowing in French by @jonathanarnault in #295
* Fix initial Login page shows username/password fields even though VITE_DISABLE_EMAIL_PASSWORD_AUTHENTICATION is true by @fzaninotto in #334
* Fix invalid logo URL during OAuth by @fzaninotto in #335
* Bump various dependencies (hono, devalue, h3, flatted, smol-toml, astro, dompurify) by @dependabot[bot] in #203, #205, #222, #223, #227, #233, #234, #238, #254, #256, #257, #270, #271, #279, #282, #283, #300
* Bump Playwright to the latest version by @erwanMarmelab in #290
* [Doc] Add documentation about the Supabase REST API by @ThieryMichel in #195
* [Doc] Document how to use a custom SMTP server by @slax57 in #201
* [Doc] Add developer documentation for the agentic harness by @pysnooLab in #314
* [Doc] Add an asciinema recording for the harness by @pysnooLab in #319
* [Doc] Add a User Profile page to the user documentation by @pysnooLab in #339
* [Doc] Document the Shadcn registry for users and contributors by @pysnooLab in #346
* [Chore] Add browser-based integration tests and Storybook by @WiXSL in #198
* [Chore] Set up e2e tests by @ThieryMichel in #204
* [Chore] Refactor integration tests by @fzaninotto in #225
* [Chore] Update NoteInputs stories to use the new StoryWrapper by @ThieryMichel in #236
* [Chore] Reduce unit test verbosity by @ThieryMichel in #243
* [Chore] Speed up e2e tests by @ThieryMichel in #244
* [Chore] Fix the dismiss-toast e2e helper targeting the wrong close button by @jonathanarnault in #287
* [Chore] Add Claude agents, skills, and rules by @jonathanarnault in #289
* [Chore] Add a delete-resource skill by @erwanMarmelab in #294
* [Chore] Upgrade Shadcn Admin Kit to v1.6.0 by @fzaninotto in #296
* [Chore] Add the update-branding skill by @erwanMarmelab in #297
* [Chore] Improve Claude hooks code quality by @jonathanarnault in #298
* [Chore] Improve the agentic factory by @erwanMarmelab in #299
* [Chore] Use subagents instead of agent teams to reduce costs by @jonathanarnault in #302
* [Chore] Add the Ponytail plugin by @erwanMarmelab in #304
* [Chore] Improve dev containers by @jonathanarnault in #306
* [Chore] Improve agents and efforts by @erwanMarmelab in #308
* [Chore] Allow committing on branches other than main by @jonathanarnault in #309
* [Chore] Add a TypeScript LSP for Claude by @jonathanarnault in #310
* [Chore] Rewrite skills by @pysnooLab in #311
* [Chore] Simplify CLAUDE.md and add a way to bypass the harness for development by @pysnooLab in #312
* [Chore] Add Docker-in-Docker support for dev containers by @jonathanarnault in #313
* [Chore] Use Playwright with agents by @erwanMarmelab in #315
* [Chore] Fix harness regressions by @pysnooLab in #316
* [Chore] Remove graphify reference by @jonathanarnault in #317
* [Chore] Add harness command support by @pysnooLab in #321
* [Chore] Consolidate the harness by @pysnooLab in #331

## New Contributors
* @pysnooLab made their first contribution in https://github.com/marmelab/atomic-crm/pull/312

**Full Changelog**: https://github.com/marmelab/atomic-crm/compare/v1.5.0...v1.6.0

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

