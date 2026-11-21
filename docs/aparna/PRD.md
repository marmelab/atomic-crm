# PRD.md — Aparna's English Coaching CRM (v1)

**Status:** PRIMARY (WHAT we build). Binds once ratified at Gate A. Changes after Gate A need an entry in `decisions.md`.
**Role:** Answers "what does the product do, for whom, and how do we know it works". HOW it is built lives in `ARCHITECTURE.md`. ORDER of work lives in `project_plan.md`. Machine-checkable acceptance lives in `features.json`.

---

## 1. Problem

Aparna's English Coaching is a fully online English coaching business (since 2005) serving families worldwide.

Facts from discovery (20 Nov 2026):

1. About 150 active students, 10 teachers.
2. About 6–7 new enquiries per day (about 180–210 per month).
3. Journey: enquiry → trial class → follow-up → enrolment → payment (Razorpay already set up). It takes 7–10 days.
4. One counsellor handles all parents before and after admission, and connects new students with teachers.
5. Everything runs on WhatsApp, unorganised. Things get stuck at every step: missed calls, follow-ups, fee reminders and parent updates.

What the numbers mean:

1. **Leak, not lack.** About 200 enquiries per month but only about 150 students in total means low conversion, high churn, or both. More leads will not help until the funnel holds water.
2. **Impossible load.** A 7–10 day cycle × 6–7 leads per day = 40–70 families mid-funnel at any time, plus 150 current families, plus 10 teachers, on one WhatsApp, from memory.
3. **Time zones.** Parents are global. Night enquiries (IST) wait hours and go cold.
4. **Data ownership.** Leads that live in one person's chat history are not owned by the business.

## 2. Goals and success metrics

Phase 0 measures the baseline first. Targets are set against the baseline at Gate A.

| ID | Metric | How measured | Starting target |
|---|---|---|---|
| M1 | Time to first response | `messages` first outbound minus lead `created_at` | < 5 minutes, 24×7 |
| M2 | Leads with no next action | Admissions in an open stage with `next_action_at` null or overdue > 24 h | 0 |
| M3 | Enquiry → trial booked | % of leads with a trial within 72 h | Baseline + 30% |
| M4 | Trial show rate | attended / booked | ≥ 80% |
| M5 | Trial → enrolled | enrolled / attended | Baseline + 25% |
| M6 | Days enquiry → paid | median | ≤ 4 days (from 7–10) |
| M7 | Fees paid on time | invoices paid by due date / due | ≥ 90% |
| M8 | Monthly churn | enrolments ended this month / active at start | Baseline − 30% |
| M9 | Counsellor admin time | self-reported hours per day on reminders and chasing | − 50% |

## 3. Non-goals (v1)

1. No parent login or parent app. Parents use WhatsApp and payment links.
2. No learning platform, homework, video hosting or class recordings.
3. No replacement of the WhatsApp chat itself. Human chats stay in the WhatsApp Business app (Coexistence). The CRM sends automated messages and logs them.
4. No AI chatbot in v1. Deterministic rules only. (Phase 3 candidate.)
5. No telephony, IVR or missed-call capture in v1. (Phase 3 candidate.)
6. No multi-branch, multi-currency accounting or GST invoicing.
7. No marketing campaigns or bulk broadcasts in v1.

## 4. Users and roles

| Role | Who | Main job in the CRM | Device |
|---|---|---|---|
| Owner | Founder | See numbers, configure courses, fees, templates, staff | Laptop + phone |
| Counsellor | Admissions and parent-relations staff (1 now, more later) | Work the Today list, move admissions, book trials, send payment links, handle fees | Laptop |
| Teacher | 10 teachers | Trial feedback, attendance, monthly progress notes for own batches | Phone first |

Permission matrix (✓ = full, R = read, — = none):

| Data | Owner | Counsellor | Teacher |
|---|---|---|---|
| Parents (contacts), admissions, notes, tasks | ✓ | ✓ | R (only students in own batches and own trials) |
| Students | ✓ | ✓ | R (own batches and own trials) |
| Trials | ✓ | ✓ | Update feedback on own trials |
| Courses, batches | ✓ | R | R (own batches) |
| Enrolments | ✓ | ✓ | R (own batches) |
| Attendance | ✓ | R | ✓ (own batches) |
| Progress notes | ✓ | R | ✓ (own students) |
| Invoices and payments | ✓ | ✓ | — |
| Messages log | ✓ | ✓ | — |
| Settings, staff, templates | ✓ | — | — |
| Dashboard (metrics) | ✓ | R | — |

## 5. Domain model (glossary)

| Term | Meaning | Stored as |
|---|---|---|
| Parent | The adult we talk to. One per family. Has WhatsApp number, country, time zone, opt-in. | `contacts` (existing table) |
| Student | The learner (child or adult). Belongs to a parent. An adult learner is their own parent record. | `students` (new) |
| Admission | One attempt to enrol one student in one course. Moves through stages. | `deals` (existing table). UI label: "Admission" |
| Trial | A free trial class for an admission. Can be rescheduled. | `trials` (new) |
| Course | What we sell (e.g. Grammar IV–XII). Has a fee plan. | `courses` (new) |
| Batch | A recurring live class of one course with one teacher. | `batches` (new) |
| Enrolment | A student's membership in a batch. Active, paused or ended. | `enrolments` (new) |
| Invoice | A fee due for an enrolment period. Paid via a Razorpay payment link. | `invoices` (new) |
| Attendance | Present or absent per student per class date. | `attendance` (new) |
| Progress note | Monthly teacher note sent to the parent. | `progress_notes` (new) |
| Message | Every automated WhatsApp send or inbound event, with status. | `messages` (new outbox + log) |
| Task | A to-do with a due time, for a person. | `tasks` (existing) |

## 6. State machines

### 6.1 Admission stage (Kanban columns)

```
enquiry → trial_booked → trial_done → payment_pending → enrolled
   ↓            ↓             ↓              ↓
  lost         lost          lost           lost        (lost needs a reason)
trial_booked → enquiry   (no-show: back to enquiry with reschedule task)
```

Rules:

1. Every admission in an open stage (`enquiry`, `trial_booked`, `trial_done`, `payment_pending`) MUST have `next_action_at`. The UI blocks saving without it.
2. `lost` requires `lost_reason` from a fixed list: no response, price, timing, chose competitor, level mismatch, not interested, duplicate, other.
3. `enrolled` is set by the system when the first payment succeeds (or manually by Owner with a note).

### 6.2 Trial

`booked → attended | no_show | cancelled`. Attended requires teacher feedback (level, recommended batch, comment).

### 6.3 Enrolment

`active → paused → active` and `active | paused → ended` (ended requires `end_reason`).

### 6.4 Invoice

`draft → sent → paid | overdue → paid | void`.

### 6.5 Message (outbox)

`queued → sent → delivered → read`, or `queued → skipped` (guard failed), or `queued → failed` (provider error; retried up to 3 times).

## 7. Screens

### Counsellor and Owner

1. **Today** (home for the counsellor). Sections, each a short list with one-tap actions:
   - New enquiries not yet contacted (with a "minutes since enquiry" timer).
   - Overdue next actions.
   - Trials today and tomorrow (in IST and the parent's local time).
   - Trials done, waiting for decision.
   - Payment links sent, not paid.
   - Fees overdue.
   - Students absent twice in a row.
2. **Admissions board.** Kanban by stage (reuses the deals Kanban). Filters: source, country, course, owner, overdue. List view with CSV export.
3. **Admission detail.** Parent + student card, stage, next action, timeline (notes, stage changes, messages, trials, payments). Quick actions: WhatsApp chat (click-to-chat link), book trial, send payment link, mark lost.
4. **Parents** (contacts list and detail). Reuses contacts. Adds country, time zone, WhatsApp opt-in, students list.
5. **Students.** List and detail: enrolments, attendance %, invoices, progress notes.
6. **Batches.** List and detail: course, teacher, schedule, class link, roster, capacity.
7. **Fees.** Invoices list: due, overdue, paid. Actions: send or resend payment link, mark paid manually (Owner only), void.
8. **Messages.** Log of all automated sends with status and failure reason. Template list (read only for Counsellor).
9. **Import.** CSV upload for parents+students, admissions, batches, enrolments. Column mapping, dry run with errors, duplicate check by phone, then commit.
10. **Dashboard** (Owner). M1–M8 cards, funnel by week, leads by source and country, revenue collected vs due.
11. **Settings** (Owner). Staff and roles, courses and fee plans, message templates (mapping to approved WhatsApp template names), automation on/off switches, quiet hours.

### Teacher (phone-first, 3 screens max)

1. **My classes.** Today's batches and trials. One tap opens class link.
2. **Attendance.** Roster with one tap per student (present by default, tap to mark absent), then Save.
3. **Trial feedback.** Attended or no-show, level, recommended batch, short comment. Monthly **progress note** form for each student (3 ratings + comment).

## 8. App flows

Each flow lists who does what. "System" = automation.

### F1 New enquiry

1. Parent fills the website form, or sends a WhatsApp message, or the counsellor adds it by hand.
2. System normalises the phone to E.164 and checks for duplicates. If the parent exists, it links to the existing record and adds a note.
3. System creates an admission in `enquiry` with source, course interest and `next_action_at = now + 2 h`.
4. System sends the instant welcome message (any hour): thanks, what happens next, question asking preferred trial time and the parent's city.
5. Counsellor sees it at the top of Today with a timer.

### F2 Book trial

1. Counsellor picks a trial slot (teacher + time) from the admission.
2. System sets stage `trial_booked`, creates the trial, and sends the parent a confirmation showing the time in the parent's time zone with the class link.
3. System queues reminders at T−24 h and T−1 h. It notifies the teacher with the student profile.

### F3 Trial outcome

1. After the trial end time, the teacher's Today shows "feedback due".
2. Teacher submits attended + level + recommended batch + comment, or no-show.
3. Attended: stage → `trial_done`. System sends the parent the teacher's feedback and the recommended batch, then creates `next_action_at = now + 4 h` for the counsellor call.
4. No-show: stage → `enquiry`, system sends a reschedule message, counsellor task tomorrow.

### F4 Convert

1. Counsellor talks to the parent and clicks "Send payment link" (course, batch, amount, currency).
2. System creates a Razorpay payment link, stage → `payment_pending`, sends it on WhatsApp.
3. Follow-ups at day 1, day 3 and day 5 (each re-checks that the link is still unpaid before sending).
4. Day 10 with no payment: system moves to `lost` with reason "no response" and tells the counsellor. The counsellor can reopen.

### F5 Payment and handover

1. Razorpay webhook confirms payment.
2. System marks the invoice paid, stage → `enrolled`, creates the enrolment in the chosen batch.
3. System sends the parent a welcome message: batch days and time in the parent's time zone, class link, teacher name, first class date.
4. System notifies the teacher: new student, level, trial notes.

### F6 Fee cycle

1. System creates the next invoice 7 days before the period ends (monthly or quarterly per fee plan).
2. Sends the payment link at D−3, reminder at D0 and D+3 if unpaid. D+7 unpaid → counsellor task, invoice `overdue`.

### F7 Attendance and absence

1. Teacher marks attendance after class.
2. One absence: no message. Two consecutive absences: system sends the parent a caring check-in message and creates a counsellor task.
3. Not marked within 24 h of class: reminder to the teacher.

### F8 Monthly progress note

1. On the 25th, teachers get a task per student.
2. On submit, the system sends the note to the parent on WhatsApp.

### F9 Leaving

1. Counsellor ends an enrolment with a reason (fees, time, moved, satisfied, unhappy, other).
2. Reasons feed the churn metric (M8).

## 9. Automation rules

All rules are deterministic. Each send goes through the outbox and **re-checks a guard at send time**. If the guard fails, the message is `skipped`, never sent.

| ID | Trigger | Guard at send time | Action | Timing |
|---|---|---|---|---|
| AR1 | New lead (form or inbound WhatsApp) | parent not opted out | Welcome message | Immediately (any hour) |
| AR2 | Trial booked | trial still `booked` | Confirmation | Immediately |
| AR3 | Trial booked | trial still `booked` | Reminders | T−24 h, T−1 h |
| AR4 | Trial booked | — | Teacher notification | Immediately |
| AR5 | Trial feedback submitted (attended) | admission still `trial_done` | Feedback to parent | Immediately (quiet hours apply) |
| AR6 | Trial no-show | trial still `no_show` | Reschedule message | Next 10:00 parent local |
| AR7 | Payment link sent | invoice unpaid | Follow-ups | D+1, D+3, D+5 |
| AR8 | Payment link unpaid 10 days | invoice unpaid | Stage → lost (no response), counsellor notified | D+10 |
| AR9 | Payment captured | — | Enrol, welcome, teacher notification | Immediately |
| AR10 | Invoice created | invoice unpaid | Payment link + reminders | D−3, D0, D+3 |
| AR11 | Two consecutive absences | enrolment active | Parent check-in + counsellor task | Next day 10:00 parent local |
| AR12 | Progress note submitted | — | Note to parent | Immediately (quiet hours apply) |
| AR13 | Inbound "STOP" | — | Set opt-out, confirm once | Immediately |

Quiet hours: no business-initiated sends between 20:00 and 09:00 in the parent's time zone. Replies to an inbound message within 24 h are exempt.

Every rule has an on/off switch in Settings.

## 10. Data import and export

1. Import from CSV (Settings → Import, and on list pages): parents+students, admissions, batches, enrolments.
2. Steps: upload → map columns → dry run (row-level errors, duplicates by phone) → commit → summary.
3. Every imported row records `import_id` so a bad import can be found and removed.
4. Sample CSV files are downloadable from the import dialog.
5. Every list exports to CSV.

## 11. Message templates (WhatsApp)

Business-initiated messages need Meta-approved templates. Names are stable keys used in code.

| Key | Category | Variables |
|---|---|---|
| `welcome_enquiry` | utility | parent name, business name |
| `trial_confirmed` | utility | student, date-time (parent tz), class link |
| `trial_reminder` | utility | student, date-time, class link |
| `trial_feedback` | utility | student, teacher comment, recommended batch |
| `trial_reschedule` | utility | student |
| `payment_link` | utility | student, course, amount, link |
| `payment_followup` | utility | student, link |
| `enrol_welcome` | utility | student, batch time (parent tz), class link, teacher |
| `fee_due` | utility | student, period, amount, link |
| `absence_checkin` | utility | student |
| `progress_note` | utility | student, month, note |
| `teacher_new_trial` / `teacher_new_student` | utility | student, details |

Template wording is owned by the Owner and approved in Meta before go-live.

## 12. Non-functional requirements

1. **Time:** store all times as UTC (`timestamptz`). Show IST for staff and the parent's time zone for parents. Batch schedules are defined in IST.
2. **Privacy:** collect the minimum child data (first name, age or grade, board). Record parent consent and WhatsApp opt-in at capture. Follow India's DPDP Act 2023 for children's data (verifiable parental consent; no tracking or targeted ads to children). Export and delete-on-request for a family (Owner action).
3. **Security:** RLS on every table, role-based. Teachers never see fees or other teachers' students. Webhooks verify signatures. Secrets only in Supabase secrets.
4. **Reliability:** outbox retries up to 3 times; failed sends are visible on Messages and Today. Idempotent webhooks (store provider event id).
5. **Performance:** Today loads in < 2 s with 2,000 parents and 500 open admissions.
6. **Mobile:** teacher screens usable on a 375 px wide phone.
7. **Audit:** stage changes, payments and message sends appear on the admission timeline.
8. **Language:** UI in English.

## 13. Release plan

| Release | Contains | Exit (see `features.json`) |
|---|---|---|
| R0 Baseline | Phase 0 sheet + WhatsApp Business hygiene + website fix (outside this repo) | Baseline numbers for M1–M8 exist |
| R1 Admissions | F1–F4 without WhatsApp sends (manual click-to-chat), Today, import | Counsellor runs all new leads in the CRM for 1 week |
| R2 Automation | WhatsApp outbox AR1–AR8, AR13, Razorpay links + webhook F5 | M1 < 5 min in production; no lead without next action |
| R3 Retention | Fees F6, attendance F7, progress notes F8, leaving F9, dashboard | One full fee cycle run in the CRM |

## 14. Open questions (must close before the matching slice)

1. Q1: Joins and leavers per month (baseline for M5, M8). Before Gate A.
2. Q2: Fee plans: amounts, currency, monthly or quarterly, sibling discounts? Before S7.
3. Q3: Trials: group or 1-to-1? Who teaches them? Fixed trial slots? Before S3.
4. Q4: Is the enquiry WhatsApp a business number? Who owns the Meta Business account? Before S4.
5. Q5: Razorpay: is international payment enabled? Payment Links on the account? Before S5.
6. Q6: Lead sources and countries (for source list and time-zone defaults). Before S1.
7. Q7: Class platform (Zoom or Meet) and whether each batch has a fixed link. Before S2.

## Provenance & audit

Sources: discovery answers from the founder (20 Nov 2026); public website, Facebook and Instagram audit (20 Nov 2026); upstream Atomic CRM schema (`supabase/schemas/01_tables.sql`); Meta WhatsApp pricing and Coexistence docs (Nov 2026).
Checked: every flow F1–F9 maps to features in `features.json`; every automation AR1–AR13 has a guard column; every screen in §7 maps to a slice in `project_plan.md`; permission matrix matches RLS plan in `ARCHITECTURE.md` §4; no staff personal names in this file.
