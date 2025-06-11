import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface User {
  id: string;
  name: string;
  nameKana?: string;
  department: string;
  role: string;
}

interface Group {
  id: string;
  name: string;
  type: 'department' | 'business' | 'leave';
  description: string;
  members: string[];
}

interface ParticipantSelectorProps {
  selectedParticipants: string[];
  onChange: (participants: string[]) => void;
  showBusinessGroups?: boolean; // 業務グループを表示するか
  showLeaveGroups?: boolean;    // 休暇申請グループを表示するか
  readOnlyLeaveGroup?: boolean; // 休暇申請グループを読み取り専用にするか
}

export default function ParticipantSelector({
  selectedParticipants,
  onChange,
  showBusinessGroups = true,
  showLeaveGroups = false,
  readOnlyLeaveGroup = false
}: ParticipantSelectorProps) {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // ユーザー一覧を取得
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, name_kana, department, role')
        .order('name_kana');

      if (!usersError && usersData) {
        const convertedUsers = usersData.map(u => ({
          ...u,
          nameKana: u.name_kana
        }));
        setUsers(convertedUsers);
      }

      // グループ一覧を取得
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('*')
        .order('type, name');

      if (!groupsError && groupsData) {
        // フィルタリング
        let filteredGroups = groupsData;
        
        if (!showBusinessGroups) {
          filteredGroups = filteredGroups.filter(g => g.type !== 'business');
        }
        
        if (!showLeaveGroups) {
          filteredGroups = filteredGroups.filter(g => g.type !== 'leave');
        }

        // 業務グループは自分が関連している場合のみ表示
        if (showBusinessGroups && currentUser) {
          filteredGroups = filteredGroups.filter(g => 
            g.type !== 'business' || g.members.includes(currentUser.id)
          );
        }

        setGroups(filteredGroups);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroupExpansion = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const handleUserToggle = (userId: string) => {
    const newParticipants = selectedParticipants.includes(userId)
      ? selectedParticipants.filter(id => id !== userId)
      : [...selectedParticipants, userId];
    onChange(newParticipants);
  };

  const handleGroupSelectAll = (group: Group, selectAll: boolean) => {
    const groupUserIds = group.members.filter(id => users.find(u => u.id === id));
    
    if (selectAll) {
      // グループの全員を追加
      const newParticipants = [...new Set([...selectedParticipants, ...groupUserIds])];
      onChange(newParticipants);
    } else {
      // グループの全員を削除
      const newParticipants = selectedParticipants.filter(id => !groupUserIds.includes(id));
      onChange(newParticipants);
    }
  };

  const isGroupFullySelected = (group: Group) => {
    const groupUserIds = group.members.filter(id => users.find(u => u.id === id));
    return groupUserIds.length > 0 && groupUserIds.every(id => selectedParticipants.includes(id));
  };

  const getGroupTypeLabel = (type: string) => {
    switch (type) {
      case 'department': return '所属';
      case 'business': return '業務グループ';
      case 'leave': return '休暇申請グループ';
      default: return '';
    }
  };

  const getSelectedUsers = () => {
    return users.filter(user => selectedParticipants.includes(user.id));
  };

  if (loading) {
    return <div className="text-center py-4">読み込み中...</div>;
  }

  const groupsByType = groups.reduce((acc, group) => {
    if (!acc[group.type]) acc[group.type] = [];
    acc[group.type].push(group);
    return acc;
  }, {} as Record<string, Group[]>);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左側: グループ選択 */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">グループから選択</h4>
          <div className="border border-gray-200 rounded-lg max-h-80 overflow-y-auto">
            {Object.entries(groupsByType).map(([type, typeGroups]) => (
              <div key={type} className="border-b border-gray-100 last:border-b-0">
                <div className="bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600 uppercase">
                  {getGroupTypeLabel(type)}
                </div>
                {typeGroups.map(group => {
                  const isExpanded = expandedGroups.has(group.id);
                  const isFullySelected = isGroupFullySelected(group);
                  const groupUsers = users.filter(u => group.members.includes(u.id));
                  const isReadOnly = readOnlyLeaveGroup && group.type === 'leave';

                  return (
                    <div key={group.id} className="border-b border-gray-100 last:border-b-0">
                      <div className="flex items-center px-3 py-2 hover:bg-gray-50">
                        <button
                          onClick={() => toggleGroupExpansion(group.id)}
                          className="flex items-center mr-2 text-gray-400 hover:text-gray-600"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        <label className="flex items-center flex-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isFullySelected}
                            onChange={(e) => handleGroupSelectAll(group, e.target.checked)}
                            disabled={isReadOnly}
                            className="mr-2 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                          />
                          <span className="text-sm text-gray-900">{group.name}</span>
                          <span className="ml-2 text-xs text-gray-500">({groupUsers.length}名)</span>
                        </label>
                      </div>
                      
                      {isExpanded && (
                        <div className="pl-8 pb-2">
                          <div className="mb-2">
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={isFullySelected}
                                onChange={(e) => handleGroupSelectAll(group, e.target.checked)}
                                disabled={isReadOnly}
                                className="mr-2 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                              />
                              <span className="text-sm text-gray-700 font-medium">全員を選択</span>
                            </label>
                          </div>
                          <div className="space-y-1">
                            {groupUsers
                              .sort((a, b) => (a.nameKana || a.name).localeCompare(b.nameKana || b.name, 'ja'))
                              .map(user => (
                                <label key={user.id} className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={selectedParticipants.includes(user.id)}
                                    onChange={() => handleUserToggle(user.id)}
                                    disabled={isReadOnly}
                                    className="mr-2 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                                  />
                                  <span className="text-sm text-gray-700">{user.name}</span>
                                  <span className="ml-1 text-xs text-gray-500">({user.department})</span>
                                </label>
                              ))
                            }
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* 右側: 選択された参加者 */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            選択された参加者 ({selectedParticipants.length}名)
          </h4>
          <div className="border border-gray-200 rounded-lg p-3 max-h-80 overflow-y-auto">
            {getSelectedUsers().length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">参加者が選択されていません</p>
              </div>
            ) : (
              <div className="space-y-2">
                {getSelectedUsers()
                  .sort((a, b) => (a.nameKana || a.name).localeCompare(b.nameKana || b.name, 'ja'))
                  .map(user => (
                    <div key={user.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div>
                        <span className="text-sm font-medium text-gray-900">{user.name}</span>
                        <span className="ml-2 text-xs text-gray-500">({user.department})</span>
                      </div>
                      <button
                        onClick={() => handleUserToggle(user.id)}
                        className="text-red-600 hover:text-red-800 text-xs"
                      >
                        削除
                      </button>
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}