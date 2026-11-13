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
insert into public.businesses (id, name, is_demo, country_code, currency, timezone, requisites)
values (
    '00000000-0000-4000-8000-000000000001', 'Demo', true, 'UA', 'UAH', 'Europe/Kyiv',
    '{"edrpou": "40000006", "iban": "UA213223130000026007233566001"}'
);

insert into public.configuration (id) values ('00000000-0000-4000-8000-000000000001');

insert into public.tags (name, color, business_id) values
    ('VIP', '#eddcd2', '00000000-0000-4000-8000-000000000001'),
    ('Партнер', '#d6e2e9', '00000000-0000-4000-8000-000000000001'),
    ('Опт', '#fff1e6', '00000000-0000-4000-8000-000000000001'),
    ('Постійний', '#dbe7e4', '00000000-0000-4000-8000-000000000001');

insert into public.companies (name, sector, size, website, phone_number, city, country, description, business_id)
select
    c.name, c.sector, c.size, c.website, c.phone, c.city, 'UA', c.description,
    '00000000-0000-4000-8000-000000000001'
from (values
    ('Студія краси «Квітка»', 'consumer-discretionary', 10, 'https://kvitka.example', '+380 44 123 45 01', 'Київ', 'Салон краси, 6 майстрів'),
    ('СТО «Дніпро Авто»', 'industrials', 10, 'https://dnipro-auto.example', '+380 56 123 45 02', 'Дніпро', 'Ремонт авто й шиномонтаж'),
    ('Львівська кавова обсмажувальня', 'consumer-staples', 50, 'https://lviv-coffee.example', '+380 32 123 45 03', 'Львів', 'Обсмаження кави й опт'),
    ('Одеська меблева майстерня', 'industrials', 10, 'https://odesa-mebli.example', '+380 48 123 45 04', 'Одеса', 'Меблі на замовлення'),
    ('Харків IT Аутсорс', 'information-technology', 50, 'https://kharkiv-it.example', '+380 57 123 45 05', 'Харків', 'Розробка програм для малого бізнесу'),
    ('Стоматологія «Здоровʼя»', 'health-care', 10, 'https://zdorovia.example', '+380 44 123 45 06', 'Київ', 'Сімейна стоматологія'),
    ('Полтава Агропостач', 'materials', 50, 'https://poltava-agro.example', '+380 53 123 45 07', 'Полтава', 'Насіння й добрива, дистрибуція'),
    ('Вінницький друкарський дім', 'communication-services', 10, 'https://vin-print.example', '+380 43 123 45 08', 'Вінниця', 'Друк і пакування')
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
    ('Олена', 'Коваленко', 'female', 'Власниця', 'hot', 'Студія краси «Квітка»', '+380 67 000 00 01', 40, 'VIP'),
    ('Ірина', 'Шевченко', 'female', 'Адміністраторка', 'warm', 'Студія краси «Квітка»', '+380 67 000 00 02', 35, null),
    ('Андрій', 'Мельник', 'male', 'Директор', 'warm', 'СТО «Дніпро Авто»', '+380 67 000 00 03', 60, 'Постійний'),
    ('Тарас', 'Бондаренко', 'male', 'Старший механік', 'cold', 'СТО «Дніпро Авто»', '+380 67 000 00 04', 55, null),
    ('Софія', 'Ткаченко', 'female', 'Менеджерка із закупівель', 'hot', 'Львівська кавова обсмажувальня', '+380 67 000 00 05', 20, 'Опт'),
    ('Максим', 'Кравченко', 'male', 'Директор', 'in-contract', 'Львівська кавова обсмажувальня', '+380 67 000 00 06', 90, 'VIP'),
    ('Наталія', 'Олійник', 'female', 'Дизайнерка', 'warm', 'Одеська меблева майстерня', '+380 67 000 00 07', 15, null),
    ('Дмитро', 'Шевчук', 'male', 'Власник', 'cold', 'Одеська меблева майстерня', '+380 67 000 00 08', 70, null),
    ('Юлія', 'Поліщук', 'female', 'Проєктна менеджерка', 'hot', 'Харків IT Аутсорс', '+380 67 000 00 09', 10, 'Партнер'),
    ('Олександр', 'Лисенко', 'male', 'Технічний директор', 'warm', 'Харків IT Аутсорс', '+380 67 000 00 10', 45, 'Партнер'),
    ('Катерина', 'Мороз', 'female', 'Головна лікарка', 'in-contract', 'Стоматологія «Здоровʼя»', '+380 67 000 00 11', 120, 'Постійний'),
    ('Віктор', 'Савченко', 'male', 'Офіс-менеджер', 'cold', 'Стоматологія «Здоровʼя»', '+380 67 000 00 12', 30, null),
    ('Галина', 'Руденко', 'female', 'Бухгалтерка', 'warm', 'Полтава Агропостач', '+380 67 000 00 13', 25, 'Опт'),
    ('Сергій', 'Марченко', 'male', 'Директор з продажів', 'hot', 'Полтава Агропостач', '+380 67 000 00 14', 8, 'Опт'),
    ('Оксана', 'Павленко', 'female', 'Власниця', 'warm', 'Вінницький друкарський дім', '+380 67 000 00 15', 50, null),
    ('Роман', 'Карпенко', 'male', 'Начальник виробництва', 'cold', 'Вінницький друкарський дім', '+380 67 000 00 16', 65, null)
) as p(first_name, last_name, gender, title, status, company, phone, days_ago, tag);

-- Amounts in the table below are whole hryvnias, stored in kopecks
insert into public.deals (name, company_id, contact_ids, categories, stage, description, amount, currency, created_at, updated_at, expected_closing_date, index, business_id)
select
    d.name,
    co.id,
    array(select c.id from public.contacts c where c.company_id = co.id order by c.id limit 1),
    array[d.category], d.stage, d.description, d.amount * 100, 'UAH',
    now() - make_interval(days => d.days_ago),
    now() - make_interval(days => d.days_ago / 2),
    (now() + make_interval(days => 30 - d.days_ago))::date,
    d.idx,
    '00000000-0000-4000-8000-000000000001'
from (values
    ('Онлайн-запис для салону', 'Студія краси «Квітка»', 'website-design', 'opportunity', 'Віджет запису й нагадування', 18000, 5, 0),
    ('Друк карток лояльності', 'Вінницький друкарський дім', 'print-project', 'opportunity', '5 000 карток лояльності', 9500, 12, 1),
    ('Ребрендинг кавʼярні', 'Львівська кавова обсмажувальня', 'ui-design', 'proposal-sent', 'Нове пакування й меню', 42000, 20, 0),
    ('CRM для СТО', 'СТО «Дніпро Авто»', 'other', 'proposal-sent', 'База клієнтів і нагадування', 25000, 18, 1),
    ('Сайт клініки', 'Стоматологія «Здоровʼя»', 'website-design', 'in-negociation', 'Сайт з онлайн-записом', 60000, 25, 0),
    ('Оптовий прайс-лист', 'Полтава Агропостач', 'copywriting', 'in-negociation', 'Тексти каталогу на 300 товарів', 15000, 9, 1),
    ('Каталог для шоуруму', 'Одеська меблева майстерня', 'print-project', 'won', 'Друкований каталог, 40 сторінок', 31000, 40, 0),
    ('Портал для партнерів', 'Харків IT Аутсорс', 'website-design', 'won', 'Дизайн порталу для партнерів', 75000, 50, 1),
    ('Літні флаєри', 'Студія краси «Квітка»', 'print-project', 'lost', 'Програли за ціною', 6000, 60, 0),
    ('Макети мобільного застосунку', 'Харків IT Аутсорс', 'ui-design', 'delayed', 'Перенесли на наступний квартал', 54000, 30, 0)
) as d(name, company, category, stage, description, amount, days_ago, idx)
join public.companies co on co.name = d.company and co.business_id = '00000000-0000-4000-8000-000000000001';

insert into public.tasks (contact_id, type, text, due_date, business_id)
select
    c.id, t.type, t.text,
    date_trunc('day', now()) + make_interval(days => t.due_in_days, hours => 10),
    '00000000-0000-4000-8000-000000000001'
from (values
    ('Коваленко', 'call', 'Подзвонити щодо віджета запису', 0),
    ('Ткаченко', 'email', 'Надіслати прайс-лист', 0),
    ('Мороз', 'meeting', 'Обговорити структуру сайту', 1),
    ('Марченко', 'follow-up', 'Нагадати про тексти каталогу', -2),
    ('Мельник', 'demo', 'Показати демо CRM', 3),
    ('Поліщук', 'call', 'Підтвердити дату запуску порталу', -1),
    ('Павленко', 'email', 'Надіслати макет на погодження', 2),
    ('Олійник', 'meeting', 'Візит до шоуруму', 5)
) as t(last_name, type, text, due_in_days)
join public.contacts c on c.last_name = t.last_name and c.business_id = '00000000-0000-4000-8000-000000000001';

insert into public.contact_notes (contact_id, text, date, status, business_id)
select c.id, n.text, now() - make_interval(days => n.days_ago), n.status, '00000000-0000-4000-8000-000000000001'
from (values
    ('Коваленко', 'Хоче, щоб клієнти записувалися онлайн і отримували SMS-нагадування.', 3, 'hot'),
    ('Кравченко', 'Підписали річний договір на обсмаження.', 15, 'in-contract'),
    ('Мороз', 'Просить кошторис до кінця місяця.', 6, 'warm'),
    ('Марченко', 'Потрібні тексти каталогу українською та англійською.', 2, 'hot')
) as n(last_name, text, days_ago, status)
join public.contacts c on c.last_name = n.last_name and c.business_id = '00000000-0000-4000-8000-000000000001';

insert into public.deal_notes (deal_id, type, text, date, business_id)
select d.id, 'email', n.text, now() - make_interval(days => n.days_ago), '00000000-0000-4000-8000-000000000001'
from (values
    ('Сайт клініки', 'Надіслали другу версію пропозиції.', 4),
    ('Ребрендинг кавʼярні', 'Клієнту сподобався мудборд.', 10)
) as n(deal, text, days_ago)
join public.deals d on d.name = n.deal and d.business_id = '00000000-0000-4000-8000-000000000001';

set session_replication_role = origin;
