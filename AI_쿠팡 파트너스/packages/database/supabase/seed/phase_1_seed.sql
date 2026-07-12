insert into public.affiliate_providers (code, name)
values ('COUPANG', '쿠팡 파트너스')
on conflict (code) do update set name = excluded.name, is_active = true;
