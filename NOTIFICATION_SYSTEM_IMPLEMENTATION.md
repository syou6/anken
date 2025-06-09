# 通知システム実装ガイド

このドキュメントでは、スケジュール管理アプリケーションに実装された包括的な通知システムについて説明します。

## 実装された機能

### 1. データベース設計
- **notification_preferences**: ユーザーの通知設定を管理
- **email_templates**: 各種通知のメールテンプレート
- **notification_logs**: 送信された通知の履歴
- **scheduled_notifications**: スケジュールされたリマインダー通知

### 2. 通知サービス

#### NotificationService (`src/services/notificationService.ts`)
- メール送信
- プッシュ通知送信
- 通知設定の管理
- 通知ログの記録

#### SchedulerService (`src/services/schedulerService.ts`)
- リマインダー通知の自動送信
- バックグラウンド処理
- スケジュール済み通知の管理

### 3. Supabase Edge Functions

#### send-email (`supabase/functions/send-email/index.ts`)
- メールテンプレートの処理
- Resend API経由でのメール送信
- 開発環境での代替実装

#### send-push (`supabase/functions/send-push/index.ts`)
- Web Push APIを使用したプッシュ通知
- VAPID認証
- サブスクリプション管理

### 4. フロントエンド機能

#### 通知設定UI (`src/pages/settings/NotificationSettings.tsx`)
- メール/プッシュ通知の有効/無効
- 通知カテゴリ別の設定
- リマインダー時間の設定
- おやすみ時間の設定

#### 通知ベル (`src/components/NotificationBell.tsx`)
- リアルタイム通知表示
- 未読通知数の表示
- 通知履歴の確認
- 通知クリック時のナビゲーション

#### テストコンポーネント (`src/components/NotificationTest.tsx`)
- 各種通知機能のテスト
- 開発・デバッグ用

### 5. Service Worker (`public/sw.js`)
- プッシュ通知の受信処理
- 通知クリック時の処理
- バックグラウンド同期

## セットアップ手順

### 1. データベース設定

1. **通知システム用テーブルの作成**:
   ```sql
   -- database-notifications.sql を実行
   psql -h your-supabase-host -d postgres -f database-notifications.sql
   ```

### 2. 環境変数設定

1. **Supabase環境変数**:
   ```env
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   VITE_APP_URL=http://localhost:5173
   ```

2. **VAPID キー**（プッシュ通知用）:
   ```env
   VITE_VAPID_PUBLIC_KEY=your-vapid-public-key
   VITE_VAPID_PRIVATE_KEY=your-vapid-private-key
   VAPID_SUBJECT=mailto:support@company.com
   ```

3. **メールサービス**（本番環境）:
   ```env
   RESEND_API_KEY=your-resend-api-key
   ```

### 3. Supabase Edge Functions のデプロイ

```bash
# Supabase CLIのインストール
npm install -g supabase

# プロジェクトにリンク
supabase link --project-ref your-project-ref

# Edge Functions のデプロイ
supabase functions deploy send-email
supabase functions deploy send-push

# 環境変数の設定
supabase secrets set RESEND_API_KEY=your-resend-api-key
supabase secrets set VAPID_PUBLIC_KEY=your-vapid-public-key
supabase secrets set VAPID_PRIVATE_KEY=your-vapid-private-key
supabase secrets set VAPID_SUBJECT=mailto:support@company.com
```

### 4. 通知アイコンの設定

以下のアイコンファイルを `/public/` ディレクトリに配置:
- `icon-192x192.png`: 通知用アイコン（192x192px）
- `badge-72x72.png`: バッジ用アイコン（72x72px）

## 通知の種類

### 1. スケジュール通知
- **作成通知**: 新しいスケジュールが作成された時
- **更新通知**: スケジュールが変更された時
- **削除通知**: スケジュールが削除された時
- **リマインダー**: 設定時間前の自動通知

### 2. 休暇申請通知
- **申請通知**: 新しい休暇申請が提出された時
- **承認通知**: 申請が承認された時
- **却下通知**: 申請が却下された時

## 使用方法

### 1. 通知設定の変更
1. サイドバーから「通知設定」をクリック
2. メール/プッシュ通知の有効/無効を設定
3. 通知カテゴリ別の詳細設定
4. 「設定を保存」をクリック

### 2. プッシュ通知の有効化
1. 「プッシュ通知を有効にする」をチェック
2. ブラウザの通知許可ダイアログで「許可」をクリック
3. テスト通知が表示されることを確認

### 3. 通知の確認
1. ヘッダーの通知ベルアイコンをクリック
2. 未読通知数とリストを確認
3. 通知をクリックして詳細ページに移動

## トラブルシューティング

### 1. メール通知が送信されない
- 環境変数 `RESEND_API_KEY` が設定されているか確認
- 開発環境ではコンソールログを確認
- Supabase Functions のログを確認

### 2. プッシュ通知が表示されない
- ブラウザが通知をサポートしているか確認
- 通知許可が有効になっているか確認
- VAPID キーが正しく設定されているか確認
- Service Worker が正しく登録されているか確認

### 3. リマインダーが送信されない
- スケジューラーサービスが起動しているか確認
- データベースの `scheduled_notifications` テーブルを確認
- ブラウザのタブが開いているか確認（スケジューラーはクライアントサイドで動作）

## 開発・デバッグ

### 1. テスト機能の使用
1. 通知設定ページの「通知システムテスト」セクションを使用
2. 各種通知のテスト送信
3. ブラウザのコンソールログとDevToolsで動作確認

### 2. ログの確認
- **クライアント**: ブラウザのコンソール
- **Supabase Functions**: Supabase ダッシュボードのFunction Logs
- **データベース**: notification_logs テーブル

### 3. 開発環境での注意事項
- メール送信は実際には行われず、コンソールにログ出力
- プッシュ通知のテストにはHTTPS環境が必要（localhost では動作）
- Service Worker はHTTPS環境でのみ完全に機能

## 拡張可能性

このシステムは以下の機能拡張に対応できるよう設計されています：

1. **SMS通知**: 新しい通知タイプとして追加可能
2. **Slack/Teams連携**: 外部サービスとの統合
3. **通知テンプレートのカスタマイズ**: 管理者による編集機能
4. **通知スケジューリングの高度化**: cron式による複雑なスケジュール
5. **A/Bテスト**: 通知内容の効果測定

## セキュリティ考慮事項

1. **RLS（Row Level Security）**: すべてのテーブルでRLSが有効
2. **VAPID認証**: プッシュ通知の認証
3. **メール送信の制限**: レート制限とスパム対策
4. **個人情報保護**: 通知ログの定期削除

このシステムにより、ユーザーは重要なスケジュール情報を見逃すことなく、効率的に業務を管理できるようになります。