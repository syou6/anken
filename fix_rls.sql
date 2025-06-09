-- 一時的にRLSを無効化（開発・テスト用）
-- 本番環境では適切な認証システムと組み合わせてRLSを有効にしてください

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE sample_equipment DISABLE ROW LEVEL SECURITY;
ALTER TABLE schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE sample_reservations DISABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests DISABLE ROW LEVEL SECURITY;

-- sample_equipmentテーブルのtype制約を更新（「サンプル作成」タイプを追加）
ALTER TABLE sample_equipment DROP CONSTRAINT IF EXISTS sample_equipment_type_check;
ALTER TABLE sample_equipment ADD CONSTRAINT sample_equipment_type_check 
  CHECK (type IN ('サンプル作成', 'CAD・マーキング', 'サンプル裁断', 'サンプル縫製', 'サンプル内職', 'プレス', '仕上げ・梱包'));

-- groupsテーブルのtype制約を更新（business タイプを追加）
ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_type_check;
ALTER TABLE groups ADD CONSTRAINT groups_type_check 
  CHECK (type IN ('department', 'business', 'leave'));