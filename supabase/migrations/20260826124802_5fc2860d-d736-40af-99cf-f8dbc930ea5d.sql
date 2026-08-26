create type public.app_role as enum ('admin','reviewer','user');

create table public.profiles (
  id uuid primary key,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'user');
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create policy "own profile" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin')) with check (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "read roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin manage roles" on public.user_roles for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.locations (
  id bigint generated always as identity primary key,
  name text not null unique,
  sort_order int not null default 0
);
grant select, insert, update, delete on public.locations to authenticated;
grant all on public.locations to service_role;
alter table public.locations enable row level security;
create policy "read locations" on public.locations for select to authenticated using (true);
create policy "admin write locations" on public.locations for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.items (
  id bigint generated always as identity primary key,
  code text not null,
  name text not null,
  notes text,
  sort_order int not null default 0
);
grant select, insert, update, delete on public.items to authenticated;
grant all on public.items to service_role;
alter table public.items enable row level security;
create policy "read items" on public.items for select to authenticated using (true);
create policy "admin write items" on public.items for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.opening_balances (
  item_id bigint not null references public.items(id) on delete cascade,
  location_id bigint not null references public.locations(id) on delete cascade,
  qty integer not null default 0,
  primary key (item_id, location_id)
);
grant select, insert, update, delete on public.opening_balances to authenticated;
grant all on public.opening_balances to service_role;
alter table public.opening_balances enable row level security;
create policy "read opening" on public.opening_balances for select to authenticated using (true);
create policy "admin write opening" on public.opening_balances for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.movements (
  id uuid primary key default gen_random_uuid(),
  moved_on date not null default current_date,
  item_id bigint not null references public.items(id) on delete restrict,
  qty integer not null check (qty > 0),
  from_location_id bigint references public.locations(id),
  to_location_id bigint references public.locations(id),
  security_from text,
  security_to text,
  employee_name text,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.movements to authenticated;
grant all on public.movements to service_role;
alter table public.movements enable row level security;
create policy "read movements" on public.movements for select to authenticated using (true);
create policy "editors insert movements" on public.movements for insert to authenticated with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'user'));
create policy "editors update movements" on public.movements for update to authenticated using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'user')) with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'user'));
create policy "editors delete movements" on public.movements for delete to authenticated using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'user'));

create or replace function public.movement_valid()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.from_location_id is null and new.to_location_id is null then
    raise exception 'يجب تحديد مكان المصدر أو مكان الوجهة على الأقل';
  end if;
  if new.from_location_id = new.to_location_id then
    raise exception 'لا يمكن النقل من وإلى نفس المكان';
  end if;
  return new;
end;
$$;
create trigger movements_valid before insert or update on public.movements
for each row execute function public.movement_valid();

create view public.v_distribution
with (security_invoker = true) as
with base as (
  select item_id, location_id, qty from public.opening_balances
  union all
  select item_id, to_location_id as location_id, qty from public.movements where to_location_id is not null
  union all
  select item_id, from_location_id as location_id, -qty from public.movements where from_location_id is not null
)
select item_id, location_id, sum(qty)::int as qty
from base group by item_id, location_id;
grant select on public.v_distribution to authenticated;

insert into public.locations (name, sort_order)
select x.name, x.ord from unnest(array['مدير الفرع','مكتب itida','المكتب الادارى','قاعة الاجتماعات','مكتب المعيدين 1','مدير التدريب','غرفة المراقبة','مكتب المعيدين 2','ITI Freelance','ITIDA Freelance','LAB 6 NTI','LAB 7 ITI','LAB 8 ITI','LAB 9 NTI','ITI Room','ITIDA Room','قاعة مؤاتمرت','LAB 1 IOT','LAB 2 NTI','LAB 3ITIDA','LAB4 FAB LAB','LAB 5 ITI','الكافتريا','الاستقبال','اوفيس 1','اوفيس 2','طرقة 1','طرقة 2','التراس','داتا ارضى','داتا 1','داتا 2','كهرباء ارضى','كهرباء1','كهرباء2','حمام رجالى ارضى','حمام حريمى ارضى','حمام معاقين','حمام رجالى 1','حمام حريمى1','حمام رجالى 2','حمام حريمى 2','مصلى رجالى','مخزن الدعم الفني','مخزن خامات النظافة','الهالك','غرفة النظافة','غرفة الصيانة','غرفة الامن الخارجية']) with ordinality as x(name, ord);

insert into public.items (code, name, sort_order)
select c.code, n.name, n.ord from unnest(array['0201990106','0201660107','0201990108','0201990137','0201990109','0201990110','0201990111','0201990112','0201990113','0201990114','0201990115','0201990116','0201990117','0201990118','0201990119','0201990120','0201990122','0201990122','0201990123','0201990124','0201990125','0201990125','0201990126','0201990127','0201990128','0201990129','0201990130','0201990131','0201990132','0201990133','0201990134','0201990135','0201990135','0201990135','0201990136','0201990136','0201990136','بدون','بدون']) with ordinality as c(code, ord)
join unnest(array['كاونتر استقبال من الخشب والمعدن مقاس 320 × 60 سم','كاونتر استقبال من الخشب والمعدن مقاس 200 × 60 سم','مكتب حرف L بالسايد ووحدة الادراج أرجل معدنية مقاس 150 × 170 × 75 سم','كاردينزا ( مكتبة جانبية خلف مكتب المدير )','مكتب معامل ترين مقاس 160 × 60 ×75 سم','مكتب معامل ترين 90 × 60 ×75 سم','منصة خطابة 100 × 60 سم ارتفاع 75 سم','منصة رئيسية 400 سم  عمق 60 سم ارتفاع 75 سم','مكتب ترين 140 × 70 سم وارتفاع 75 سم شامل الواجهة والسبريتور ( الفاصل ) ارتفاع 80 سم','ترابيزة إجتماعات القرصة مستطيلة سمك 25 مم مقاس 650 × 200 × 75 سم لعدد 16 فرد','ترابيزة إجتماعات القرصة مستطيلة مقاس 120 × 150 سم لعدد 5 فرد','منضدة طعام قرصة مربعة مقاس 90 × 90 سم تستند على أرجل اسطوانية من المنتصف','طاولة قهوة من الخشب مربعة على شاسيه معدن مقاس 50 × 50 × 40 سم','ترابيزة ضيافة مستطيلة مقاس 80 × 50 سم','مكتب خشب بالواجهة مقاس 140 × 70 × 75 سم','وحدة إدراج من الخشب 3 درج','دولاب 2 ضلفة خشب وجسم معدن مقاس 102 × 45 × 97','دولاب 2 ضلفة خشب وجسم معدن مقاس 163 × 45 × 98','كرسى موظف هيدروليكى على نجمة بعجل خماسي ظهر متوسط جلد صناعي','كرسى انتظار ظهر منخفض حرف U','فوتيه فردي من القماش مقاس 80 × 75 × 85 سم ( أحمر )','فوتيه فردي من القماش مقاس 80 × 75 × 85 سم ( تريكواز )','كنبة 2 مقعد من القماش مقاس 80 × 75 × 85 سم','كنبة دائرية القاعدة رمادى والظهر جزء أحمر وجزء تريكواز  بمسند كتابة','كنبة شبة دائرية القاعدة قماش رمادي والظهر 10 قماش أحمر و 10 قماش تريكواز + مسند كتابى','كرسي على شاسيه معدني جلد صناعي اورانج','كرسي بمسند كتابة على شاسيه معدني جلد صناعي أحمر','كرسي للمطعم أرجل معدنية والقاعدة والظهر من الابلاكاش المضغوط والمكسو قشرة طبيعية','كرسى إستكبول بمسند كتابة','كرسى إستكبول إسود','كرسى إستكبول احمر','أحمر   BEAN  BAGS','أورانج   BEAN  BAGS','أزرق   BEAN  BAGS','بوف  أحمر','بوف  تريكواز','بوف  رمادى','دولاب خشب 2 دلفه اللون رمادي','كرسى كوان موظف ظهر شبك']) with ordinality as n(name, ord) on n.ord = c.ord;

insert into public.opening_balances (item_id, location_id, qty)
select it.id, lo.id, split_part(t,':',3)::int
from unnest(string_to_array('1:24:1,2:27:1,2:28:1,3:1:1,3:2:1,3:6:1,4:1:1,5:9:3,5:11:13,5:12:14,5:13:14,5:14:13,5:15:1,5:16:2,5:18:14,5:19:12,5:20:11,5:21:9,5:22:12,6:11:4,6:12:3,6:13:2,6:14:3,6:18:2,6:19:4,6:21:3,6:22:4,6:35:2,7:17:1,8:17:1,9:3:12,9:8:4,10:4:1,11:1:1,11:10:2,12:23:8,12:24:1,12:29:1,13:1:2,13:3:2,13:6:3,14:1:1,14:3:1,14:6:1,14:28:1,15:3:1,15:5:3,15:7:1,15:10:1,15:13:1,15:14:1,15:18:1,15:19:1,15:21:1,15:22:1,16:3:12,16:5:3,16:8:4,16:10:1,16:11:1,16:12:1,16:13:1,16:14:1,16:15:1,16:16:1,16:18:1,16:19:1,16:21:1,16:24:2,16:35:2,17:3:2,17:6:2,17:12:1,18:2:1,18:3:2,18:5:2,18:8:1,18:10:1,18:11:1,18:14:1,18:19:1,18:21:1,18:35:1,18:45:2,18:47:1,19:1:6,19:2:1,19:3:10,19:4:22,19:5:3,19:8:4,19:9:8,19:10:10,19:11:31,19:12:31,19:13:28,19:14:32,19:15:3,19:16:11,19:17:4,19:18:30,19:19:28,19:20:13,19:21:22,19:22:30,19:24:3,19:26:1,19:27:1,19:28:1,19:35:2,19:46:10,20:1:2,20:2:2,20:6:2,20:7:1,20:9:2,21:2:2,21:6:4,21:9:1,22:1:4,22:9:2,22:10:1,23:9:2,23:10:2,24:1:1,25:9:2,25:10:1,26:10:5,26:20:2,27:9:7,28:23:21,28:26:1,28:27:4,28:28:3,28:29:4,28:34:1,28:43:2,28:45:1,28:47:3,29:4:18,29:15:102,29:16:71,29:20:29,30:3:5,30:17:158,30:26:1,30:27:1,30:28:3,30:35:1,30:46:1,31:5:2,31:8:4,31:17:44,32:29:1,33:45:1,34:27:3,35:2:2,36:9:1,36:10:1,37:9:1,37:10:1,38:3:3,38:21:1,38:27:1,38:49:1,39:3:3', ',')) as t
join public.items it on it.sort_order = split_part(t,':',1)::int
join public.locations lo on lo.sort_order = split_part(t,':',2)::int;