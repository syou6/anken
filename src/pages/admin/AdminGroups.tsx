import { useState, useEffect } from 'react';
import { Group, GroupType } from '../../types';
import { mockGroups } from '../../data/mockData';
import { Plus, Pencil, Trash2, Users, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export default function AdminGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [formData, setFormData] = useState<Partial<Group>>({});
  const [loading, setLoading] = useState(true);

  // Load groups from Supabase
  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .order('type, name');
      
      if (error) {
        console.error('Error fetching groups:', error);
        setGroups(mockGroups);
      } else {
        const convertedGroups: Group[] = data?.map(g => ({
          id: g.id,
          name: g.name,
          type: g.type,
          members: g.members || [],
          createdBy: g.created_by,
          createdAt: new Date(g.created_at)
        })) || [];
        setGroups(convertedGroups);
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
      setGroups(mockGroups);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingGroup) {
        // Update group
        const { error } = await supabase
          .from('groups')
          .update({
            name: formData.name || '',
            type: formData.type || 'department',
            members: formData.members || [],
            updated_at: new Date().toISOString()
          })
          .eq('id', editingGroup.id);
        
        if (error) throw error;
        toast.success('グループを更新しました');
      } else {
        // Create group
        const { error } = await supabase
          .from('groups')
          .insert([{
            name: formData.name || '',
            type: formData.type as GroupType || 'department',
            members: formData.members || [],
            created_by: '550e8400-e29b-41d4-a716-446655440001' // Default user ID
          }]);
        
        if (error) throw error;
        toast.success('グループを作成しました');
      }

      // Refresh data
      await fetchGroups();
      
      setIsModalOpen(false);
      setEditingGroup(null);
      setFormData({});
    } catch (error) {
      console.error('Error saving group:', error);
      toast.error('保存中にエラーが発生しました');
    }
  };

  const handleEdit = (group: Group) => {
    setEditingGroup(group);
    setFormData(group);
    setIsModalOpen(true);
  };

  const handleDelete = async (groupId: string) => {
    if (confirm('このグループを削除してもよろしいですか？')) {
      try {
        const { error } = await supabase
          .from('groups')
          .delete()
          .eq('id', groupId);
        
        if (error) throw error;
        
        toast.success('グループを削除しました');
        await fetchGroups(); // Refresh data
      } catch (error) {
        console.error('Error deleting group:', error);
        toast.error('削除中にエラーが発生しました');
      }
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">グループデータを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold text-gray-900">グループ管理</h1>
        <button 
          onClick={() => {
            setEditingGroup(null);
            setFormData({});
            setIsModalOpen(true);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <Users className="h-5 w-5 mr-1" />
          グループ作成
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                グループ名
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                種別
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                メンバー数
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                作成日
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">アクション</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {groups.map((group) => (
              <tr key={group.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      <Users className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{group.name}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    group.type === 'department' ? 'bg-green-100 text-green-800' :
                    group.type === 'business' ? 'bg-blue-100 text-blue-800' :
                    'bg-purple-100 text-purple-800'
                  }`}>
                    {group.type === 'department' ? '所属' :
                     group.type === 'business' ? '業務' : '休暇申請'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {group.members.length}名
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(group.createdAt).toLocaleDateString('ja-JP')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button 
                    onClick={() => handleEdit(group)}
                    className="text-indigo-600 hover:text-indigo-900 mr-3"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(group.id)}
                    className="text-red-600 hover:text-red-900"
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
                {editingGroup ? 'グループ編集' : 'グループ作成'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">グループ名</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">種別</label>
                <select
                  value={formData.type || ''}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as GroupType })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="department">所属</option>
                  <option value="business">業務</option>
                  <option value="leave">休暇申請</option>
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
                  {editingGroup ? '更新' : '作成'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}