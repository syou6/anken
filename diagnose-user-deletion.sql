-- ユーザー削除の問題を診断するSQL

-- 1. RLSが有効か確認
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'users';

-- 2. usersテーブルのRLSポリシーを確認
SELECT * FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'users';

-- 3. ユーザーに関連する外部キー制約を確認
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND ccu.table_name = 'users';

-- 4. 特定のユーザーに関連するデータを確認（USER_IDを実際のIDに置き換えてください）
-- 例: 'a1234567-89ab-cdef-0123-456789abcdef'
/*
-- Groups
SELECT COUNT(*) as group_memberships 
FROM groups 
WHERE 'USER_ID_HERE' = ANY(members);

-- Schedules
SELECT COUNT(*) as created_schedules 
FROM schedules 
WHERE created_by = 'USER_ID_HERE' OR updated_by = 'USER_ID_HERE';

SELECT COUNT(*) as participant_schedules 
FROM schedules 
WHERE 'USER_ID_HERE' = ANY(participants);

-- Leave requests
SELECT COUNT(*) as leave_requests 
FROM leave_requests 
WHERE user_id = 'USER_ID_HERE';

-- Vehicles
SELECT COUNT(*) as vehicles 
FROM vehicles 
WHERE created_by = 'USER_ID_HERE';

-- Rooms
SELECT COUNT(*) as rooms 
FROM rooms 
WHERE created_by = 'USER_ID_HERE';
*/

-- 5. 削除を試みる（実際のエラーメッセージを確認）
-- DELETE FROM users WHERE id = 'USER_ID_HERE';

-- 6. 関連データを含めて強制削除する場合（危険！）
/*
BEGIN;
-- グループメンバーシップから削除
UPDATE groups SET members = array_remove(members, 'USER_ID_HERE');

-- スケジュール参加者から削除
UPDATE schedules SET participants = array_remove(participants, 'USER_ID_HERE');

-- 作成者・更新者をNULLに設定
UPDATE schedules SET created_by = NULL WHERE created_by = 'USER_ID_HERE';
UPDATE schedules SET updated_by = NULL WHERE updated_by = 'USER_ID_HERE';
UPDATE vehicles SET created_by = NULL WHERE created_by = 'USER_ID_HERE';
UPDATE rooms SET created_by = NULL WHERE created_by = 'USER_ID_HERE';
UPDATE groups SET created_by = NULL WHERE created_by = 'USER_ID_HERE';

-- leave_requestsは ON DELETE CASCADE なので自動削除される

-- ユーザーを削除
DELETE FROM users WHERE id = 'USER_ID_HERE';

COMMIT;
*/