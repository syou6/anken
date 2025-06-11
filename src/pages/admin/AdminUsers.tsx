import { useState, useEffect } from 'react';
import { User, Department, UserRole } from '../../types';
import { mockUsers } from '../../data/mockData';
import { Plus, Pencil, Trash2, UserPlus, X, HelpCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import UserDeleteHelper from '../../components/UserDeleteHelper';

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({});
  const [loading, setLoading] = useState(true);
  const [deleteHelperUser, setDeleteHelperUser] = useState<User | null>(null);

  // Load users from Supabase
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name_kana');
      
      if (error) {
        console.error('Error fetching users:', error);
        setUsers(mockUsers);
      } else {
        const convertedUsers: User[] = data?.map(u => ({
          id: u.id,
          employeeId: u.employee_id,
          name: u.name,
          nameKana: u.name_kana,
          email: u.email,
          phone: u.phone,
          department: u.department,
          role: u.role,
          defaultWorkDays: u.default_work_days || [
            { day: 1, startTime: '09:00', endTime: '18:00' },
            { day: 2, startTime: '09:00', endTime: '18:00' },
            { day: 3, startTime: '09:00', endTime: '18:00' },
            { day: 4, startTime: '09:00', endTime: '18:00' },
            { day: 5, startTime: '09:00', endTime: '18:00' },
          ]
        })) || [];
        setUsers(convertedUsers);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers(mockUsers);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Enhanced Validation
    const errors = [];
    
    if (!formData.name?.trim()) {
      errors.push('名前を入力してください');
    }
    
    if (!formData.email?.trim()) {
      errors.push('メールアドレスを入力してください');
    } else if (!formData.email.endsWith('@terao-f.co.jp')) {
      errors.push('メールアドレスは@terao-f.co.jpドメインである必要があります');
    }
    
    if (!formData.employeeId?.trim()) {
      errors.push('社員番号を入力してください');
    }
    
    if (!formData.department) {
      errors.push('所属を選択してください');
    }
    
    if (!formData.role) {
      errors.push('権限を選択してください');
    }
    
    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }
    
    try {
      const defaultWorkDays = [
        { day: 1, startTime: '09:00', endTime: '18:00' },
        { day: 2, startTime: '09:00', endTime: '18:00' },
        { day: 3, startTime: '09:00', endTime: '18:00' },
        { day: 4, startTime: '09:00', endTime: '18:00' },
        { day: 5, startTime: '09:00', endTime: '18:00' },
      ];

      if (editingUser) {
        // Update user
        const { error } = await supabase
          .from('users')
          .update({
            employee_id: formData.employeeId || '',
            name: formData.name || '',
            name_kana: formData.nameKana || '',
            email: formData.email || '',
            phone: formData.phone || '',
            department: formData.department || '所属なし',
            role: formData.role || 'employee',
            default_work_days: formData.defaultWorkDays || defaultWorkDays,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingUser.id);
        
        if (error) throw error;
        toast.success('ユーザーを更新しました');
      } else {
        // Create user
        const { error } = await supabase
          .from('users')
          .insert([{
            employee_id: formData.employeeId || '',
            name: formData.name || '',
            name_kana: formData.nameKana || '',
            email: formData.email || '',
            phone: formData.phone || '',
            department: formData.department || '所属なし',
            role: formData.role || 'employee',
            default_work_days: defaultWorkDays
          }]);
        
        if (error) throw error;
        toast.success('ユーザーを作成しました');
      }

      // Refresh data
      await fetchUsers();
      
      setIsModalOpen(false);
      setEditingUser(null);
      setFormData({});
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error('保存中にエラーが発生しました');
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData(user);
    setIsModalOpen(true);
  };

  const handleDelete = async (userId: string) => {
    if (confirm('このユーザーを削除してもよろしいですか？')) {
      try {
        // First, check if this user has any associated data
        const userToDelete = users.find(u => u.id === userId);
        if (!userToDelete) {
          toast.error('ユーザーが見つかりません');
          return;
        }

        // Log the deletion attempt
        console.log('Attempting to delete user:', {
          id: userId,
          name: userToDelete.name,
          role: userToDelete.role
        });

        const { error } = await supabase
          .from('users')
          .delete()
          .eq('id', userId);
        
        if (error) {
          console.error('Detailed deletion error:', error);
          
          // Check for specific error types
          if (error.code === '23503') {
            toast.error('このユーザーは他のデータで使用されているため削除できません');
          } else if (error.code === '42501') {
            toast.error('削除権限がありません');
          } else if (error.message?.includes('row-level security')) {
            toast.error('セキュリティポリシーにより削除が制限されています');
          } else {
            toast.error(`削除エラー: ${error.message || '不明なエラー'}`);
          }
          
          // Provide more specific error messages
          if (error.code === '23503') {
            toast.error('このユーザーには関連データが存在するため削除できません。先に関連データを削除してください。');
          } else if (error.code === '42501') {
            toast.error('権限エラー: このユーザーを削除する権限がありません。');
          } else if (error.message?.includes('row-level security')) {
            toast.error('セキュリティポリシーによりこのユーザーを削除できません。');
          } else {
            toast.error(`削除エラー: ${error.message || '不明なエラーが発生しました'}`);
          }
          return;
        }
        
        toast.success('ユーザーを削除しました');
        await fetchUsers(); // Refresh data
      } catch (error: any) {
        console.error('Unexpected error deleting user:', error);
        toast.error(`予期しないエラー: ${error?.message || '削除中にエラーが発生しました'}`);
      }
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">ユーザーデータを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold text-gray-900">ユーザー管理</h1>
        <button 
          onClick={() => {
            setEditingUser(null);
            setFormData({});
            setIsModalOpen(true);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <UserPlus className="h-5 w-5 mr-1" />
          ユーザー作成
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                社員情報
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                所属
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                権限
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                連絡先
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">アクション</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      <span className="text-indigo-700 font-medium text-sm">
                        {user.name.charAt(0)}
                      </span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-500">{user.nameKana}</div>
                      <div className="text-xs text-gray-400">{user.employeeId}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{user.department}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    user.role === 'president' ? 'bg-purple-100 text-purple-800' :
                    user.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {user.role === 'president' ? '社長' :
                     user.role === 'admin' ? '管理者' : '社員'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div>{user.email}</div>
                  <div>{user.phone}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button 
                    onClick={() => handleEdit(user)}
                    className="text-indigo-600 hover:text-indigo-900 mr-3"
                    title="編集"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => setDeleteHelperUser(user)}
                    className="text-yellow-600 hover:text-yellow-900 mr-3"
                    title="削除前チェック"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(user.id)}
                    className="text-red-600 hover:text-red-900"
                    title="削除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingUser ? 'ユーザー編集' : 'ユーザー作成'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">社員番号</label>
                <input
                  type="text"
                  value={formData.employeeId || ''}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">名前</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">フリガナ</label>
                <input
                  type="text"
                  value={formData.nameKana || ''}
                  onChange={(e) => setFormData({ ...formData, nameKana: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">メールアドレス</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="example@terao-f.co.jp"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">@terao-f.co.jpドメインのみ使用可能です</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">電話番号</label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">所属</label>
                <select
                  value={formData.department || ''}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value as Department })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="本社（１階）">本社（１階）</option>
                  <option value="本社（２階）">本社（２階）</option>
                  <option value="本社（３階）">本社（３階）</option>
                  <option value="仕上げ・プレス">仕上げ・プレス</option>
                  <option value="CAD-CAM">CAD-CAM</option>
                  <option value="WEB">WEB</option>
                  <option value="所属なし">所属なし</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">権限</label>
                <select
                  value={formData.role || ''}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="employee">社員</option>
                  <option value="admin">管理者</option>
                  <option value="president">社長</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {editingUser ? '更新' : '作成'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Delete Helper Modal */}
      {deleteHelperUser && (
        <UserDeleteHelper
          user={deleteHelperUser}
          onClose={() => setDeleteHelperUser(null)}
        />
      )}
    </div>
  );
}