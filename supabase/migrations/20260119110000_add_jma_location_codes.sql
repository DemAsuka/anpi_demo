-- system_locations テーブルの拡張
ALTER TABLE system_locations ADD COLUMN IF NOT EXISTS jma_code TEXT;
ALTER TABLE system_locations ADD COLUMN IF NOT EXISTS jma_name TEXT;

-- user_locations テーブルの拡張
ALTER TABLE user_locations ADD COLUMN IF NOT EXISTS jma_code TEXT;
ALTER TABLE user_locations ADD COLUMN IF NOT EXISTS jma_name TEXT;

-- コメント追加
COMMENT ON COLUMN system_locations.jma_code IS '気象庁の地域コード（例: 0410100）';
COMMENT ON COLUMN system_locations.jma_name IS '気象庁の正式な地点名称（例: 仙台市青葉区）';
COMMENT ON COLUMN user_locations.jma_code IS '気象庁の地域コード';
COMMENT ON COLUMN user_locations.jma_name IS '気象庁の正式な地点名称';
