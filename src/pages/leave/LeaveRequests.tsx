import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Plus, Clock, CheckCircle, XCircle, X, Users } from 'lucide-react';
import { mockLeaveRequests, mockUsers, mockGroups } from '../../data/mockData';
import { useAuth } from '../../contexts/AuthContext';
import { LeaveRequest, LeaveType, LeaveStatus, User } from '../../types';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import ParticipantSelector from '../../components/ParticipantSelector';

export default function LeaveRequests() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'my' | 'pending' | 'approved'>('my');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<LeaveRequest>>({});

  // State for leave requests
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [leaveApprovalGroups, setLeaveApprovalGroups] = useState<any[]>([]);
  const [additionalApprovers, setAdditionalApprovers] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Fetch leave requests and related data from Supabase
  useEffect(() => {
    fetchLeaveRequests();
    fetchLeaveApprovalGroups();
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
        const convertedUsers: User[] = data?.map(u => ({
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
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers(mockUsers);
    }
  };
  
  const fetchLeaveApprovalGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('type', 'leave')
        .order('name');
      
      if (error) {
        console.error('Error fetching leave groups:', error);
        setLeaveApprovalGroups(mockGroups.filter(g => g.type === 'leave'));
      } else {
        setLeaveApprovalGroups(data || []);
      }
    } catch (error) {
      console.error('Error fetching leave groups:', error);
      setLeaveApprovalGroups(mockGroups.filter(g => g.type === 'leave'));
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch leave requests:', error);
        // Fallback to mock data only
        console.warn('Using mock data for leave requests');
        setLeaveRequests(mockLeaveRequests);
      } else if (data) {
        const convertedRequests: LeaveRequest[] = data.map(request => ({
          id: request.id,
          type: request.type,
          userId: request.user_id,
          date: new Date(request.date),
          reason: request.reason,
          status: request.status,
          approvers: request.approvers || [],
          createdAt: new Date(request.created_at)
        }));
        setLeaveRequests(convertedRequests);
      }
    } catch (err) {
      console.error('Error fetching leave requests:', err);
      console.warn('Using mock data for leave requests');
      setLeaveRequests(mockLeaveRequests);
    } finally {
      setIsLoading(false);
    }
  };

  // Get all required approvers (leave approval groups + additional approvers)
  const getRequiredApprovers = () => {
    const requiredApprovers = new Set<string>();
    
    // Add all members from leave approval groups
    leaveApprovalGroups.forEach(group => {
      group.members?.forEach((memberId: string) => {
        requiredApprovers.add(memberId);
      });
    });
    
    // Add additional approvers
    additionalApprovers.forEach(approverId => {
      requiredApprovers.add(approverId);
    });
    
    return Array.from(requiredApprovers)
      .map(id => users.find(user => user.id === id))
      .filter((user): user is User => user !== undefined);
  };
  
  const approvers = getRequiredApprovers();
  
  // Get president for final approval
  const president = users.find(user => user.role === 'president');

  // Note: No longer saving to localStorage - only Supabase

  // Filter leave requests based on the active tab
  const filteredRequests = leaveRequests.filter(request => {
    if (activeTab === 'my') {
      return request.userId === currentUser?.id;
    } else if (activeTab === 'pending') {
      return request.approvers.some(
        approver => approver.userId === currentUser?.id && approver.status === 'pending'
      );
    } else if (activeTab === 'approved') {
      return request.approvers.some(
        approver => approver.userId === currentUser?.id && approver.status !== 'pending'
      );
    }
    return false;
  });

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.date) {
      toast.error('日付を選択してください');
      return;
    }
    
    if (!formData.reason?.trim()) {
      toast.error('理由を入力してください');
      return;
    }

    try {
      // Create workflow: Group Approvers -> President -> Final Status
      const allApprovers = [
        // Step 1: Group approvers (required + additional)
        ...approvers.map(approver => ({
          userId: approver.id,
          status: 'pending' as const,
          timestamp: null,
          step: 1
        })),
        // Step 2: President approval (if president exists and is not already in approvers)
        ...(president && !approvers.find(a => a.id === president.id) ? [{
          userId: president.id,
          status: 'pending' as const,
          timestamp: null,
          step: 2
        }] : [])
      ];
      
      // Save to Supabase
      const { data, error } = await supabase
        .from('leave_requests')
        .insert([{
          type: formData.type as LeaveType || 'vacation',
          user_id: currentUser?.id || '',
          date: new Date(formData.date || new Date()).toISOString().split('T')[0],
          reason: formData.reason || '',
          status: 'pending',
          approvers: allApprovers
        }])
        .select()
        .single();

      if (error) {
        console.error('Error saving leave request:', error);
        toast.error('休暇申請の保存に失敗しました');
        return;
      } else if (data) {
        const newRequest: LeaveRequest = {
          id: data.id,
          type: data.type,
          userId: data.user_id,
          date: new Date(data.date),
          reason: data.reason,
          status: data.status,
          approvers: data.approvers || [],
          createdAt: new Date(data.created_at)
        };
        setLeaveRequests([...leaveRequests, newRequest]);
        toast.success('休暇申請を作成しました');
      }

      setIsModalOpen(false);
      setFormData({});
      setAdditionalApprovers([]);
    } catch (err) {
      console.error('Error:', err);
      toast.error('休暇申請の作成中にエラーが発生しました');
    }
  };

  // Handle approval/rejection with step-based workflow
  const handleApproval = async (requestId: string, approved: boolean) => {
    const request = leaveRequests.find(r => r.id === requestId);
    if (!request) return;

    const updatedApprovers = request.approvers.map((approver: any) => {
      if (approver.userId === currentUser?.id) {
        return {
          ...approver,
          status: approved ? 'approved' : 'rejected' as const,
          timestamp: new Date(),
        };
      }
      return approver;
    });

    // Check workflow progress
    const step1Approvers = updatedApprovers.filter((a: any) => a.step === 1);
    const step2Approvers = updatedApprovers.filter((a: any) => a.step === 2);
    
    const step1AllApproved = step1Approvers.length > 0 && step1Approvers.every((a: any) => a.status === 'approved');
    const step1AnyRejected = step1Approvers.some((a: any) => a.status === 'rejected');
    const step2AllApproved = step2Approvers.length === 0 || step2Approvers.every((a: any) => a.status === 'approved');
    const step2AnyRejected = step2Approvers.some((a: any) => a.status === 'rejected');
    
    let newStatus: LeaveStatus = 'pending';
    
    if (step1AnyRejected || step2AnyRejected) {
      newStatus = 'rejected';
    } else if (step1AllApproved && step2AllApproved) {
      newStatus = 'approved';
    } else {
      newStatus = 'pending';
    }

    try {
      // Update in Supabase
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: newStatus,
          approvers: updatedApprovers
        })
        .eq('id', requestId);

      if (error) {
        console.error('Error updating leave request:', error);
        toast.error('承認状態の更新に失敗しました');
      } else {
        // Update local state
        const updatedRequests = leaveRequests.map(r => {
          if (r.id === requestId) {
            return {
              ...r,
              status: newStatus,
              approvers: updatedApprovers,
            };
          }
          return r;
        });
        setLeaveRequests(updatedRequests);
        
        if (approved) {
          if (newStatus === 'approved') {
            toast.success('申請が最終承認されました');
          } else {
            toast.success('申請を承認しました（次の承認者待ち）');
          }
        } else {
          toast.success('申請を却下しました');
        }
      }
    } catch (err) {
      console.error('Error:', err);
      toast.error('承認処理中にエラーが発生しました');
    }
  };

  // Handle cancellation
  const handleCancel = async (requestId: string) => {
    if (confirm('この申請をキャンセルしてもよろしいですか？')) {
      try {
        const { error } = await supabase
          .from('leave_requests')
          .delete()
          .eq('id', requestId);

        if (error) {
          console.error('Error deleting leave request:', error);
          toast.error('申請のキャンセルに失敗しました');
        } else {
          const updatedRequests = leaveRequests.filter(request => request.id !== requestId);
          setLeaveRequests(updatedRequests);
          toast.success('申請をキャンセルしました');
        }
      } catch (err) {
        console.error('Error:', err);
        toast.error('キャンセル処理中にエラーが発生しました');
      }
    }
  };

  const getStatusBadge = (status: LeaveStatus) => {
    if (status === 'approved') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="h-4 w-4 mr-1" />
          承認済み
        </span>
      );
    } else if (status === 'rejected') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircle className="h-4 w-4 mr-1" />
          却下
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <Clock className="h-4 w-4 mr-1" />
          承認待ち
        </span>
      );
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold text-gray-900">休暇・遅刻・早退申請</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500"
        >
          <Plus className="h-5 w-5 mr-1" />
          新規申請
        </button>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('my')}
              className={`w-1/3 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                activeTab === 'my'
                  ? 'border-rose-500 text-rose-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              自分の申請
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`w-1/3 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                activeTab === 'pending'
                  ? 'border-rose-500 text-rose-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              承認待ち
            </button>
            <button
              onClick={() => setActiveTab('approved')}
              className={`w-1/3 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                activeTab === 'approved'
                  ? 'border-rose-500 text-rose-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              承認済み
            </button>
          </nav>
        </div>

        <div className="overflow-auto">
          {isLoading ? (
            <div className="px-6 py-10 text-center text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600 mx-auto mb-4"></div>
              データを読み込み中...
            </div>
          ) : filteredRequests.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col\" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    申請者
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    種別
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    日付
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    理由
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ステータス
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    申請日
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">アクション</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRequests.map((request) => {
                  const requestUser = users.find(user => user.id === request.userId);
                  return (
                    <tr key={request.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {requestUser?.name || '不明なユーザー'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {requestUser?.department}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          request.type === 'vacation' ? 'bg-blue-100 text-blue-800' : 
                          request.type === 'late' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {request.type === 'vacation' ? '休暇' : 
                           request.type === 'late' ? '遅刻' : '早退'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {format(new Date(request.date), 'yyyy/MM/dd')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{request.reason}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(request.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(request.createdAt), 'yyyy/MM/dd')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {activeTab === 'pending' && (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleApproval(request.id, true)}
                              className="text-green-600 hover:text-green-900"
                            >
                              承認
                            </button>
                            <button
                              onClick={() => handleApproval(request.id, false)}
                              className="text-red-600 hover:text-red-900"
                            >
                              却下
                            </button>
                          </div>
                        )}
                        {activeTab === 'my' && request.status === 'pending' && (
                          <button
                            onClick={() => handleCancel(request.id)}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            キャンセル
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-10 text-center text-gray-500">
              表示するデータがありません
            </div>
          )}
        </div>
      </div>

      {/* New Request Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                新規申請
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">種別</label>
                <select
                  value={formData.type || 'vacation'}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as LeaveType })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="vacation">休暇</option>
                  <option value="late">遅刻</option>
                  <option value="early">早退</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">日付</label>
                <input
                  type="date"
                  value={formData.date ? format(new Date(formData.date), 'yyyy-MM-dd') : ''}
                  onChange={(e) => setFormData({ ...formData, date: new Date(e.target.value) })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">理由</label>
                <textarea
                  value={formData.reason || ''}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              {/* 必須承認者（休暇申請グループ） */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">必須承認者（休暇申請グループ）</label>
                <div className="space-y-2 bg-gray-50 p-3 rounded-md max-h-32 overflow-y-auto">
                  {leaveApprovalGroups.length === 0 ? (
                    <p className="text-sm text-gray-500">休暇申請グループが設定されていません</p>
                  ) : (
                    leaveApprovalGroups.flatMap(group => 
                      group.members?.map((memberId: string) => {
                        const user = users.find(u => u.id === memberId);
                        return user ? (
                          <div key={user.id} className="flex items-center">
                            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-rose-100 flex items-center justify-center">
                              <span className="text-sm font-medium text-rose-600">
                                {user.name.charAt(0)}
                              </span>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-gray-900">{user.name}</p>
                              <p className="text-xs text-gray-500">{user.department}</p>
                            </div>
                          </div>
                        ) : null;
                      })
                    ).filter(Boolean)
                  )}
                  {president && (
                    <div className="border-t pt-2 mt-2">
                      <p className="text-xs text-gray-500 mb-2">最終承認者（社長）</p>
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-purple-600">
                            {president.name.charAt(0)}
                          </span>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">{president.name}</p>
                          <p className="text-xs text-gray-500">{president.department}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* 任意承認者追加 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">任意承認者追加</label>
                <ParticipantSelector
                  selectedParticipants={additionalApprovers}
                  onChange={setAdditionalApprovers}
                  showBusinessGroups={true}
                  showLeaveGroups={false}
                />
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
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500"
                >
                  申請する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}