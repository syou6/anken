import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Calendar, User, LogIn, Key } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { mockUsers } from '../data/mockData';
import { User as UserType } from '../types';

export default function Login() {
  const [loginMode, setLoginMode] = useState<'select' | 'manual'>('select');
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<UserType[]>([]);
  const navigate = useNavigate();
  const { login, switchUser } = useAuth();
  
  // Load users for selection
  useEffect(() => {
    fetchUsers();
  }, []);
  
  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name');
      
      if (error) {
        console.error('Error fetching users:', error);
        setUsers(mockUsers);
      } else {
        const convertedUsers: UserType[] = data?.map(u => ({
          id: u.id,
          employeeId: u.employee_id,
          name: u.name,
          nameKana: u.name_kana,
          email: u.email,
          phone: u.phone,
          department: u.department,
          role: u.role,
          defaultWorkDays: u.default_work_days || []
        })) || [];
        // Merge users and remove duplicates based on email
        const uniqueUsers = [...convertedUsers];
        mockUsers.forEach(mockUser => {
          if (!uniqueUsers.find(u => u.email === mockUser.email)) {
            uniqueUsers.push(mockUser);
          }
        });
        setUsers(uniqueUsers);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers(mockUsers);
    }
  };

  const handleSelectLogin = async (user: UserType) => {
    setError('');
    setIsLoading(true);
    
    try {
      console.log('ユーザー選択ログイン開始:', user.name);
      // For user selection mode, directly switch to the selected user
      switchUser(user);
      console.log('ユーザー切り替え完了');
      navigate('/');
    } catch (err) {
      setError('ログイン中にエラーが発生しました');
      console.error('ユーザー選択ログインエラー:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('メールアドレスとパスワードを入力してください');
      return;
    }
    
    setError('');
    setIsLoading(true);
    
    try {
      console.log('手動ログイン開始:', email);
      const success = await login(email, password);
      console.log('ログイン結果:', success);
      if (success) {
        console.log('ログイン成功、リダイレクト中');
        navigate('/');
      } else {
        setError('メールアドレスまたはパスワードが正しくありません');
      }
    } catch (err) {
      setError('ログイン中にエラーが発生しました');
      console.error('手動ログインエラー:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Calendar className="h-12 w-12 text-blue-600" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          グループスケジュール管理システム
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {/* Login Mode Selector */}
          <div className="mb-6">
            <div className="flex justify-center space-x-4">
              <button
                type="button"
                onClick={() => setLoginMode('select')}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium ${
                  loginMode === 'select'
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <User className="h-4 w-4 mr-2" />
                ユーザー選択
              </button>
              <button
                type="button"
                onClick={() => setLoginMode('manual')}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium ${
                  loginMode === 'manual'
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Key className="h-4 w-4 mr-2" />
                手動入力
              </button>
            </div>
          </div>
          
          {loginMode === 'select' ? (
            /* User Selection Mode */
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 text-center">ユーザーを選択してください</h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {users.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleSelectLogin(user)}
                    disabled={isLoading}
                    className="w-full flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                  >
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-600 font-medium text-sm">
                        {user.name.charAt(0)}
                      </span>
                    </div>
                    <div className="ml-3 flex-1 text-left">
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      <div className="text-xs text-gray-500">
                        {user.department} • {user.role === 'president' ? '社長' : user.role === 'admin' ? '管理者' : '社員'}
                      </div>
                    </div>
                    <LogIn className="h-4 w-4 text-gray-400" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Manual Login Mode */
            <form className="space-y-6" onSubmit={handleManualSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                メールアドレス
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                パスワード
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isLoading ? '読み込み中...' : 'ログイン'}
              </button>
            </div>
          </form>
          )}

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">または</span>
              </div>
            </div>

            <div className="mt-6">
              <Link
                to="/register"
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                新規アカウント登録
              </Link>
            </div>

            <div className="mt-4 text-sm text-center">
              <p className="text-gray-600">
                デモ用アカウント: yamada@terao-f.co.jp (社長)
              </p>
              <p className="text-gray-600">
                パスワードは任意の文字列を入力してください
              </p>
              <button
                type="button"
                onClick={() => {
                  setEmail('yamada@terao-f.co.jp');
                  setPassword('demo123');
                }}
                className="mt-2 text-blue-600 hover:text-blue-500 underline text-sm"
              >
                デモアカウントで自動入力
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}