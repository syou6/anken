import { useState, Fragment, useEffect } from 'react';
import { LogOut, User, X, LogIn } from 'lucide-react';
import { Menu, Transition } from '@headlessui/react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { User as UserType } from '../types';

export default function UserSwitcher() {
  const { currentUser, logout, switchUser } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<UserType[]>([]);
  
  useEffect(() => {
    if (isModalOpen) {
      fetchUsers();
    }
  }, [isModalOpen]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name');

      if (error) {
        console.error('ユーザーデータ取得エラー:', error);
        return;
      }

      // DBデータをアプリのUser型に変換
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

      setUsers(convertedUsers);
    } catch (err) {
      console.error('fetchUsers エラー:', err);
    }
  };

  const handleUserSwitch = async (user: UserType) => {
    setIsLoading(true);
    try {
      console.log('ユーザー切り替え:', user.name);
      switchUser(user);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to switch user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    console.log('ログアウト実行');
    logout();
    // React Routerを使用してナビゲート
    window.location.replace('/user-switch');
  };

  return (
    <>
      <Menu as="div" className="ml-3 relative">
        {({ open }) => (
          <>
            <div>
              <Menu.Button className="max-w-xs bg-white flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                <span className="sr-only">ユーザーメニュー</span>
                <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white">
                  {currentUser?.name.charAt(0)}
                </div>
              </Menu.Button>
            </div>
            <Transition
              show={open}
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items
                static
                className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none"
              >
                <div className="px-4 py-2">
                  <p className="text-sm font-medium text-gray-900">{currentUser?.name}</p>
                  <p className="text-xs text-gray-500 truncate">{currentUser?.email}</p>
                </div>
                <div className="border-t border-gray-100"></div>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className={`${
                        active ? 'bg-gray-100' : ''
                      } flex w-full px-4 py-2 text-sm text-gray-700`}
                    >
                      <User className="mr-3 h-5 w-5 text-gray-400" aria-hidden="true" />
                      <span>ユーザー切替</span>
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={handleLogout}
                      className={`${
                        active ? 'bg-gray-100' : ''
                      } flex w-full px-4 py-2 text-sm text-gray-700`}
                    >
                      <LogOut className="mr-3 h-5 w-5 text-gray-400" aria-hidden="true" />
                      <span>ログアウト</span>
                    </button>
                  )}
                </Menu.Item>
              </Menu.Items>
            </Transition>
          </>
        )}
      </Menu>
      
      {/* User Switch Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">ユーザー切り替え</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-2">
              {users
                .filter(user => user.id !== currentUser?.id)
                .map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleUserSwitch(user)}
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
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}