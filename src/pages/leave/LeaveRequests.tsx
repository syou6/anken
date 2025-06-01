import { useState } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Plus, Clock, CheckCircle, XCircle, X } from 'lucide-react';
import { mockLeaveRequests, mockUsers, mockGroups } from '../../data/mockData';
import { useAuth } from '../../contexts/AuthContext';
import { LeaveRequest, LeaveType, LeaveStatus, User } from '../../types';

export default function LeaveRequests() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'my' | 'pending' | 'approved'>('my');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<LeaveRequest>>({});

  // Get leave requests from localStorage or use mock data
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => {
    const savedRequests = localStorage.getItem('leaveRequests');
    return savedRequests ? JSON.parse(savedRequests) : mockLeaveRequests;
  });

  // Get the leave approval group
  const leaveApprovalGroup = mockGroups.find(group => group.type === 'leave');
  const approvers = leaveApprovalGroup ? leaveApprovalGroup.members.map(id => 
    mockUsers.find(user => user.id === id)
  ).filter((user): user is User => user !== undefined) : [];

  // Save leave requests
  const saveLeaveRequests = (newRequests: LeaveRequest[]) => {
    setLeaveRequests(newRequests);
    localStorage.setItem('leaveRequests', JSON.stringify(newRequests));
  };

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
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newRequest: LeaveRequest = {
      id: Date.now().toString(),
      type: formData.type as LeaveType || 'vacation',
      userId: currentUser?.id || '',
      date: new Date(formData.date || new Date()),
      reason: formData.reason || '',
      status: 'pending',
      approvers: approvers.map(approver => ({
        userId: approver.id,
        status: 'pending',
        timestamp: null,
      })),
      createdAt: new Date(),
    };

    saveLeaveRequests([...leaveRequests, newRequest]);
    setIsModalOpen(false);
    setFormData({});
  };

  // Handle approval/rejection
  const handleApproval = (requestId: string, approved: boolean) => {
    const updatedRequests = leaveRequests.map(request => {
      if (request.id === requestId) {
        const updatedApprovers = request.approvers.map(approver => {
          if (approver.userId === currentUser?.id) {
            return {
              ...approver,
              status: approved ? 'approved' : 'rejected',
              timestamp: new Date(),
            };
          }
          return approver;
        });

        // Check if all approvers have responded
        const allApproved = updatedApprovers.every(
          approver => approver.status === 'approved'
        );
        const anyRejected = updatedApprovers.some(
          approver => approver.status === 'rejected'
        );

        return {
          ...request,
          status: anyRejected ? 'rejected' : allApproved ? 'approved' : 'pending',
          approvers: updatedApprovers,
        };
      }
      return request;
    });

    saveLeaveRequests(updatedRequests);
  };

  // Handle cancellation
  const handleCancel = (requestId: string) => {
    if (confirm('この申請をキャンセルしてもよろしいですか？')) {
      const updatedRequests = leaveRequests.filter(request => request.id !== requestId);
      saveLeaveRequests(updatedRequests);
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
          {filteredRequests.length > 0 ? (
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
                  const requestUser = mockUsers.find(user => user.id === request.userId);
                  return (
                    <tr key={request.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {requestUser?.name}
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">承認者</label>
                <div className="space-y-2 bg-gray-50 p-3 rounded-md">
                  {approvers.map(approver => (
                    <div key={approver.id} className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600">
                          {approver.name.charAt(0)}
                        </span>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">{approver.name}</p>
                        <p className="text-xs text-gray-500">{approver.department}</p>
                      </div>
                    </div>
                  ))}
                </div>
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