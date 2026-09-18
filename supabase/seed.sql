-- Seed 7 toko sesuai MASTER_DASHBOARD.md §1.
-- Jalankan SEKALI setelah migration, lewat Supabase SQL Editor.

insert into brands (name) values
  ('Exclusive Interior'),
  ('Sora & Soul'),
  ('Rise & Wars'),
  ('Fashionable Daily'),
  ('Websensial')
on conflict (name) do nothing;

insert into stores (brand_id, channel, display_name, sort_order)
select b.id, s.channel::channel_code, s.display_name, s.sort_order
from (values
  ('Exclusive Interior', 'shopee',  'Exclusive Interior (Shopee)',   1),
  ('Sora & Soul',         'shopee',  'Sora & Soul (Shopee)',          2),
  ('Sora & Soul',         'lazada',  'Sora & Soul (Lazada)',          3),
  ('Sora & Soul',         'tiktok',  'Sora & Soul (TikTok Shop)',     4),
  ('Rise & Wars',         'shopee',  'Rise & Wars (Shopee)',          5),
  ('Fashionable Daily',   'tiktok',  'Fashionable Daily (TikTok Shop)', 6),
  ('Websensial',          'etsy',    'Websensial (Etsy)',             7)
) as s(brand_name, channel, display_name, sort_order)
join brands b on b.name = s.brand_name
on conflict (brand_id, channel, display_name) do nothing;
