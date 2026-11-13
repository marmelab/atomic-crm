INSERT INTO favicons_excluded_domains (domain) VALUES
    ('gmail.com'),
    ('yahoo.com'),
    ('hotmail.com'),
    ('aol.com'),
    ('hotmail.co.uk'),
    ('hotmail.fr'),
    ('msn.com'),
    ('yahoo.fr'),
    ('wanadoo.fr'),
    ('orange.fr'),
    ('comcast.net'),
    ('yahoo.co.uk'),
    ('yahoo.com.br'),
    ('yahoo.co.in'),
    ('live.com'),
    ('rediffmail.com'),
    ('free.fr'),
    ('gmx.de'),
    ('web.de'),
    ('yandex.ru'),
    ('ymail.com'),
    ('libero.it'),
    ('outlook.com'),
    ('uol.com.br'),
    ('bol.com.br'),
    ('mail.ru'),
    ('cox.net'),
    ('hotmail.it'),
    ('sbcglobal.net'),
    ('sfr.fr'),
    ('live.fr'),
    ('verizon.net'),
    ('live.co.uk'),
    ('googlemail.com'),
    ('yahoo.es'),
    ('ig.com.br'),
    ('live.nl'),
    ('bigpond.com'),
    ('terra.com.br'),
    ('yahoo.it'),
    ('neuf.fr'),
    ('yahoo.de'),
    ('alice.it'),
    ('rocketmail.com'),
    ('att.net'),
    ('laposte.net'),
    ('facebook.com'),
    ('bellsouth.net'),
    ('yahoo.in'),
    ('hotmail.es'),
    ('charter.net'),
    ('yahoo.ca'),
    ('yahoo.com.au'),
    ('rambler.ru'),
    ('hotmail.de'),
    ('tiscali.it'),
    ('shaw.ca'),
    ('yahoo.co.jp'),
    ('sky.com'),
    ('earthlink.net'),
    ('optonline.net'),
    ('freenet.de'),
    ('t-online.de'),
    ('aliceadsl.fr'),
    ('virgilio.it'),
    ('home.nl'),
    ('qq.com'),
    ('telenet.be'),
    ('me.com'),
    ('yahoo.com.ar'),
    ('tiscali.co.uk'),
    ('yahoo.com.mx'),
    ('voila.fr'),
    ('gmx.net'),
    ('mail.com'),
    ('planet.nl'),
    ('tin.it'),
    ('live.it'),
    ('ntlworld.com'),
    ('arcor.de'),
    ('yahoo.co.id'),
    ('frontiernet.net'),
    ('hetnet.nl'),
    ('live.com.au'),
    ('yahoo.com.sg'),
    ('zonnet.nl'),
    ('club-internet.fr'),
    ('juno.com'),
    ('optusnet.com.au'),
    ('blueyonder.co.uk'),
    ('bluewin.ch'),
    ('skynet.be'),
    ('sympatico.ca'),
    ('windstream.net'),
    ('mac.com'),
    ('centurytel.net'),
    ('chello.nl'),
    ('live.ca'),
    ('aim.com'),
    ('bigpond.net.au'),
    ('online.de'),
    ('apple.com');

--
-- Demo business (local development only)
-- All sample data lives in its own business, so it can be removed at once with
-- delete_business(). The first user to sign up becomes its owner (handle_new_user).
--

-- Skip the triggers while seeding: they would fetch avatars and favicons over
-- the network for every row. The rows below are consistent by construction.
set session_replication_role = replica;

-- A Ukrainian business with sample requisites (valid check digits; the IBAN
-- is the National Bank of Ukraine documentation example).
insert into public.businesses (id, name, is_demo, country_code, requisites)
values (
    '00000000-0000-4000-8000-000000000001', 'Demo', true, 'UA',
    '{"edrpou": "40000006", "iban": "UA213223130000026007233566001"}'
);

insert into public.configuration (id) values ('00000000-0000-4000-8000-000000000001');

insert into public.tags (name, color, business_id) values
    ('VIP', '#eddcd2', '00000000-0000-4000-8000-000000000001'),
    ('Partner', '#d6e2e9', '00000000-0000-4000-8000-000000000001'),
    ('Wholesale', '#fff1e6', '00000000-0000-4000-8000-000000000001'),
    ('Recurring', '#dbe7e4', '00000000-0000-4000-8000-000000000001');

insert into public.companies (name, sector, size, website, phone_number, city, country, description, business_id)
select
    c.name, c.sector, c.size, c.website, c.phone, c.city, 'UA', c.description,
    '00000000-0000-4000-8000-000000000001'
from (values
    ('Kvitka Beauty Studio', 'consumer-discretionary', 10, 'https://kvitka.example', '+380 44 123 45 01', 'Kyiv', 'Beauty salon, 6 masters'),
    ('Dnipro Auto Service', 'industrials', 10, 'https://dnipro-auto.example', '+380 56 123 45 02', 'Dnipro', 'Car repair and tyre service'),
    ('Lviv Coffee Roasters', 'consumer-staples', 50, 'https://lviv-coffee.example', '+380 32 123 45 03', 'Lviv', 'Coffee roasting and wholesale'),
    ('Odesa Furniture Workshop', 'industrials', 10, 'https://odesa-mebli.example', '+380 48 123 45 04', 'Odesa', 'Custom furniture production'),
    ('Kharkiv IT Outsourcing', 'information-technology', 50, 'https://kharkiv-it.example', '+380 57 123 45 05', 'Kharkiv', 'Software development for SMBs'),
    ('Zdorovia Dental Clinic', 'health-care', 10, 'https://zdorovia.example', '+380 44 123 45 06', 'Kyiv', 'Family dental clinic'),
    ('Poltava Agro Supply', 'materials', 50, 'https://poltava-agro.example', '+380 53 123 45 07', 'Poltava', 'Seeds and fertilizer distributor'),
    ('Vinnytsia Print House', 'communication-services', 10, 'https://vin-print.example', '+380 43 123 45 08', 'Vinnytsia', 'Printing and packaging')
) as c(name, sector, size, website, phone, city, description);

insert into public.contacts (first_name, last_name, gender, title, status, company_id, email_jsonb, phone_jsonb, first_seen, last_seen, has_newsletter, tags, business_id)
select
    p.first_name, p.last_name, p.gender, p.title, p.status,
    (select id from public.companies where name = p.company and business_id = '00000000-0000-4000-8000-000000000001'),
    jsonb_build_array(jsonb_build_object('email', lower(p.first_name || '.' || p.last_name || '@example.com'), 'type', 'Work')),
    jsonb_build_array(jsonb_build_object('number', p.phone, 'type', 'Work')),
    now() - make_interval(days => p.days_ago),
    now() - make_interval(days => p.days_ago / 3),
    false,
    case when p.tag is null then '{}'::bigint[]
         else array[(select id from public.tags where name = p.tag and business_id = '00000000-0000-4000-8000-000000000001')] end,
    '00000000-0000-4000-8000-000000000001'
from (values
    ('Olena', 'Kovalenko', 'female', 'Owner', 'hot', 'Kvitka Beauty Studio', '+380 67 000 00 01', 40, 'VIP'),
    ('Iryna', 'Shevchenko', 'female', 'Administrator', 'warm', 'Kvitka Beauty Studio', '+380 67 000 00 02', 35, null),
    ('Andrii', 'Melnyk', 'male', 'Director', 'warm', 'Dnipro Auto Service', '+380 67 000 00 03', 60, 'Recurring'),
    ('Taras', 'Bondarenko', 'male', 'Head mechanic', 'cold', 'Dnipro Auto Service', '+380 67 000 00 04', 55, null),
    ('Sofiia', 'Tkachenko', 'female', 'Purchasing manager', 'hot', 'Lviv Coffee Roasters', '+380 67 000 00 05', 20, 'Wholesale'),
    ('Maksym', 'Kravchenko', 'male', 'CEO', 'in-contract', 'Lviv Coffee Roasters', '+380 67 000 00 06', 90, 'VIP'),
    ('Nataliia', 'Oliinyk', 'female', 'Designer', 'warm', 'Odesa Furniture Workshop', '+380 67 000 00 07', 15, null),
    ('Dmytro', 'Shevchuk', 'male', 'Owner', 'cold', 'Odesa Furniture Workshop', '+380 67 000 00 08', 70, null),
    ('Yuliia', 'Polishchuk', 'female', 'Project manager', 'hot', 'Kharkiv IT Outsourcing', '+380 67 000 00 09', 10, 'Partner'),
    ('Oleksandr', 'Lysenko', 'male', 'CTO', 'warm', 'Kharkiv IT Outsourcing', '+380 67 000 00 10', 45, 'Partner'),
    ('Kateryna', 'Moroz', 'female', 'Chief doctor', 'in-contract', 'Zdorovia Dental Clinic', '+380 67 000 00 11', 120, 'Recurring'),
    ('Viktor', 'Savchenko', 'male', 'Office manager', 'cold', 'Zdorovia Dental Clinic', '+380 67 000 00 12', 30, null),
    ('Halyna', 'Rudenko', 'female', 'Accountant', 'warm', 'Poltava Agro Supply', '+380 67 000 00 13', 25, 'Wholesale'),
    ('Serhii', 'Marchenko', 'male', 'Sales director', 'hot', 'Poltava Agro Supply', '+380 67 000 00 14', 8, 'Wholesale'),
    ('Oksana', 'Pavlenko', 'female', 'Owner', 'warm', 'Vinnytsia Print House', '+380 67 000 00 15', 50, null),
    ('Roman', 'Karpenko', 'male', 'Production lead', 'cold', 'Vinnytsia Print House', '+380 67 000 00 16', 65, null)
) as p(first_name, last_name, gender, title, status, company, phone, days_ago, tag);

insert into public.deals (name, company_id, contact_ids, categories, stage, description, amount, created_at, updated_at, expected_closing_date, index, business_id)
select
    d.name,
    co.id,
    array(select c.id from public.contacts c where c.company_id = co.id order by c.id limit 1),
    array[d.category], d.stage, d.description, d.amount,
    now() - make_interval(days => d.days_ago),
    now() - make_interval(days => d.days_ago / 2),
    (now() + make_interval(days => 30 - d.days_ago))::date,
    d.idx,
    '00000000-0000-4000-8000-000000000001'
from (values
    ('Online booking for salon', 'Kvitka Beauty Studio', 'website-design', 'opportunity', 'Booking widget and reminders', 18000, 5, 0),
    ('Loyalty cards print run', 'Vinnytsia Print House', 'print-project', 'opportunity', '5,000 loyalty cards', 9500, 12, 1),
    ('Coffee shop rebranding', 'Lviv Coffee Roasters', 'ui-design', 'proposal-sent', 'New packaging and menu design', 42000, 20, 0),
    ('Service station CRM rollout', 'Dnipro Auto Service', 'other', 'proposal-sent', 'Customer base and reminders', 25000, 18, 1),
    ('Clinic website', 'Zdorovia Dental Clinic', 'website-design', 'in-negociation', 'Website with online appointments', 60000, 25, 0),
    ('Wholesale price list', 'Poltava Agro Supply', 'copywriting', 'in-negociation', 'Catalogue texts for 300 products', 15000, 9, 1),
    ('Showroom catalogue', 'Odesa Furniture Workshop', 'print-project', 'won', 'Printed catalogue, 40 pages', 31000, 40, 0),
    ('Developer portal', 'Kharkiv IT Outsourcing', 'website-design', 'won', 'Partner portal design', 75000, 50, 1),
    ('Summer promo flyers', 'Kvitka Beauty Studio', 'print-project', 'lost', 'Lost on price', 6000, 60, 0),
    ('Mobile app mockups', 'Kharkiv IT Outsourcing', 'ui-design', 'delayed', 'Postponed to next quarter', 54000, 30, 0)
) as d(name, company, category, stage, description, amount, days_ago, idx)
join public.companies co on co.name = d.company and co.business_id = '00000000-0000-4000-8000-000000000001';

insert into public.tasks (contact_id, type, text, due_date, business_id)
select
    c.id, t.type, t.text,
    date_trunc('day', now()) + make_interval(days => t.due_in_days, hours => 10),
    '00000000-0000-4000-8000-000000000001'
from (values
    ('Kovalenko', 'call', 'Call about the booking widget', 0),
    ('Tkachenko', 'email', 'Send the price list', 0),
    ('Moroz', 'meeting', 'Discuss the website structure', 1),
    ('Marchenko', 'follow-up', 'Follow up on the catalogue texts', -2),
    ('Melnyk', 'demo', 'Show the CRM demo', 3),
    ('Polishchuk', 'call', 'Confirm the portal launch date', -1),
    ('Pavlenko', 'email', 'Send the print proof', 2),
    ('Oliinyk', 'meeting', 'Showroom visit', 5)
) as t(last_name, type, text, due_in_days)
join public.contacts c on c.last_name = t.last_name and c.business_id = '00000000-0000-4000-8000-000000000001';

insert into public.contact_notes (contact_id, text, date, status, business_id)
select c.id, n.text, now() - make_interval(days => n.days_ago), n.status, '00000000-0000-4000-8000-000000000001'
from (values
    ('Kovalenko', 'Wants clients to book online and get SMS reminders.', 3, 'hot'),
    ('Kravchenko', 'Signed the annual roasting contract.', 15, 'in-contract'),
    ('Moroz', 'Asked for an estimate before the end of the month.', 6, 'warm'),
    ('Marchenko', 'Needs the catalogue texts in Ukrainian and English.', 2, 'hot')
) as n(last_name, text, days_ago, status)
join public.contacts c on c.last_name = n.last_name and c.business_id = '00000000-0000-4000-8000-000000000001';

insert into public.deal_notes (deal_id, type, text, date, business_id)
select d.id, 'email', n.text, now() - make_interval(days => n.days_ago), '00000000-0000-4000-8000-000000000001'
from (values
    ('Clinic website', 'Sent the second version of the proposal.', 4),
    ('Coffee shop rebranding', 'Client liked the moodboard.', 10)
) as n(deal, text, days_ago)
join public.deals d on d.name = n.deal and d.business_id = '00000000-0000-4000-8000-000000000001';

set session_replication_role = origin;
