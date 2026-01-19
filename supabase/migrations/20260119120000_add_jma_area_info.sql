-- system_locations テーブルの拡張（エリア情報）
ALTER TABLE system_locations ADD COLUMN IF NOT EXISTS jma_area_name TEXT;
ALTER TABLE system_locations ADD COLUMN IF NOT EXISTS jma_area_code TEXT;

-- user_locations テーブルの拡張（エリア情報）
ALTER TABLE user_locations ADD COLUMN IF NOT EXISTS jma_area_name TEXT;
ALTER TABLE user_locations ADD COLUMN IF NOT EXISTS jma_area_code TEXT;

-- コメント追加
COMMENT ON COLUMN system_locations.jma_area_name IS '気象庁の細分区域名（例: 宮城県中部）';
COMMENT ON COLUMN user_locations.jma_area_name IS '気象庁の細分区域名';
