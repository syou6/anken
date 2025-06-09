import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: '',
    name: '',
    nameKana: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    department: '',
    role: 'employee' as 'employee' | 'admin' | 'president'
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('パスワードが一致しません');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('パスワードは6文字以上で入力してください');
      return;
    }

    setIsLoading(true);

    try {
      // まず、メールアドレスが既に登録されているかチェック
      const { data: existingUsers } = await supabase
        .from('users')
        .select('id')
        .or(`email.eq.${formData.email},employee_id.eq.${formData.employeeId}`)
        .limit(1);

      if (existingUsers && existingUsers.length > 0) {
        toast.error('このメールアドレスまたは社員番号は既に登録されています');
        setIsLoading(false);
        return;
      }

      // Supabase Authでユーザーを作成
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            employee_id: formData.employeeId
          }
        }
      });

      if (authError) {
        throw authError;
      }

      if (!authData.user) {
        throw new Error('ユーザーの作成に失敗しました');
      }

      // usersテーブルにユーザー情報を保存
      const { error: dbError } = await supabase
        .from('users')
        .insert([{
          id: authData.user.id,
          employee_id: formData.employeeId,
          name: formData.name,
          name_kana: formData.nameKana,
          email: formData.email,
          phone: formData.phone || null,
          department: formData.department,
          role: formData.role,
          default_work_days: []
        }]);

      if (dbError) {
        console.error('Database error:', dbError);
        throw dbError;
      }

      // 登録成功メッセージ
      if (authData.user.confirmed_at) {
        // メール確認が不要な場合
        toast.success('登録が完了しました');
        // 自動的にログイン
        const loginSuccess = await login(formData.email, formData.password);
        if (loginSuccess) {
          navigate('/');
        }
      } else {
        // メール確認が必要な場合
        toast.success('登録が完了しました。メールをご確認ください');
        navigate('/login');
      }
      
    } catch (error: any) {
      console.error('Registration error:', error);
      
      // エラーメッセージの詳細な処理
      if (error.message?.includes('already registered') || error.message?.includes('already exists')) {
        toast.error('このメールアドレスは既に登録されています');
      } else if (error.message?.includes('rate limit') || error.message?.includes('security purposes')) {
        const seconds = error.message.match(/\d+/)?.[0] || '60';
        toast.error(`セキュリティのため、${seconds}秒後に再度お試しください`);
      } else if (error.message?.includes('Invalid email')) {
        toast.error('有効なメールアドレスを入力してください');
      } else if (error.message?.includes('Password')) {
        toast.error('パスワードは6文字以上で入力してください');
      } else if (error.code === '23505') {
        // PostgreSQLの重複エラー
        toast.error('この社員番号またはメールアドレスは既に使用されています');
      } else {
        toast.error('登録に失敗しました。しばらく待ってから再度お試しください');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            新規アカウント登録
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            既にアカウントをお持ちの方は{' '}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
              ログイン
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="employeeId" className="sr-only">
                社員番号
              </label>
              <input
                id="employeeId"
                name="employeeId"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="社員番号"
                value={formData.employeeId}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label htmlFor="name" className="sr-only">
                氏名
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="氏名"
                value={formData.name}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label htmlFor="nameKana" className="sr-only">
                氏名（カナ）
              </label>
              <input
                id="nameKana"
                name="nameKana"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="氏名（カナ）"
                value={formData.nameKana}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label htmlFor="email" className="sr-only">
                メールアドレス
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="メールアドレス"
                value={formData.email}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                パスワード
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="パスワード（6文字以上）"
                value={formData.password}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="sr-only">
                パスワード（確認）
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="パスワード（確認）"
                value={formData.confirmPassword}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label htmlFor="phone" className="sr-only">
                電話番号
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="電話番号（任意）"
                value={formData.phone}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label htmlFor="department" className="sr-only">
                部署
              </label>
              <input
                id="department"
                name="department"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="部署"
                value={formData.department}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label htmlFor="role" className="sr-only">
                権限
              </label>
              <select
                id="role"
                name="role"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                value={formData.role}
                onChange={handleInputChange}
              >
                <option value="employee">一般社員</option>
                <option value="admin">管理者</option>
                <option value="president">社長</option>
              </select>
            </div>
          </div>

          <div className="text-sm text-gray-600 bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p className="font-medium text-yellow-800">ご注意</p>
            <p className="mt-1">登録にはメール認証が必要な場合があります。有効なメールアドレスをご使用ください。</p>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '登録中...' : '登録する'}
            </button>
          </div>

          <div className="mt-4 text-sm text-center text-gray-600">
            <p>レート制限エラーが出る場合は、異なるメールアドレスをお試しください。</p>
            <p className="mt-2">または、既存のテストアカウントでログインしてください：</p>
            <p className="font-mono bg-gray-100 p-2 mt-1 rounded">yamada@terao-f.co.jp</p>
          </div>
        </form>
      </div>
    </div>
  );
}