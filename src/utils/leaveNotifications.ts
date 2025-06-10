import { notificationService } from '../services/notificationService';
import { User, LeaveRequest } from '../types';

export const leaveNotifications = {
  // 申請提出時の通知
  async notifyLeaveRequestSubmitted(
    request: LeaveRequest, 
    submitter: User, 
    approvers: User[]
  ) {
    const leaveTypeMap = {
      vacation: '休暇',
      late: '遅刻',
      early: '早退'
    };

    const message = `${submitter.name}さんから${leaveTypeMap[request.type]}申請が提出されました。`;
    
    // 承認者全員に通知（ブラウザ通知 + アプリ内通知）
    for (const approver of approvers) {
      // ブラウザ通知
      await notificationService.send({
        title: '休暇申請通知',
        body: message,
        userId: approver.id,
        type: 'leave_request',
        data: {
          requestId: request.id,
          submitterId: submitter.id,
          leaveType: request.type,
          date: request.date.toISOString()
        }
      });

      // アプリ内通知ログ
      await notificationService.logNotification({
        userId: approver.id,
        type: 'in_app',
        category: 'leave_request_submitted',
        subject: '休暇申請通知',
        content: message,
        metadata: {
          requestId: request.id,
          submitterId: submitter.id,
          leaveType: request.type,
          date: request.date.toISOString()
        },
        status: 'sent'
      });
    }
  },

  // グループ承認完了時の通知（社長への通知）
  async notifyGroupApprovalComplete(
    request: LeaveRequest,
    submitter: User,
    president?: User
  ) {
    if (!president) return;

    const leaveTypeMap = {
      vacation: '休暇',
      late: '遅刻', 
      early: '早退'
    };

    const message = `${submitter.name}さんの${leaveTypeMap[request.type]}申請がグループ承認を完了しました。最終承認をお願いします。`;

    await notificationService.send({
      title: '休暇申請承認待ち',
      body: message,
      userId: president.id,
      type: 'leave_approval_required',
      data: {
        requestId: request.id,
        submitterId: submitter.id,
        leaveType: request.type,
        date: request.date.toISOString()
      }
    });

    // アプリ内通知ログ
    await notificationService.logNotification({
      userId: president.id,
      type: 'in_app',
      category: 'leave_request_submitted',
      subject: '休暇申請承認待ち',
      content: message,
      metadata: {
        requestId: request.id,
        submitterId: submitter.id,
        leaveType: request.type,
        date: request.date.toISOString()
      },
      status: 'sent'
    });
  },

  // 最終承認完了時の通知（申請者・人事・グループメンバーへ）
  async notifyFinalApprovalComplete(
    request: LeaveRequest,
    submitter: User,
    approved: boolean,
    groupMembers: User[] = [],
    hrMembers: User[] = []
  ) {
    const leaveTypeMap = {
      vacation: '休暇',
      late: '遅刻',
      early: '早退'
    };

    const status = approved ? '承認' : '却下';
    const title = `休暇申請${status}通知`;

    const submitterMessage = `あなたの${leaveTypeMap[request.type]}申請が${status}されました。`;

    // 申請者への通知
    await notificationService.send({
      title,
      body: submitterMessage,
      userId: submitter.id,
      type: approved ? 'leave_approved' : 'leave_rejected',
      data: {
        requestId: request.id,
        leaveType: request.type,
        date: request.date.toISOString(),
        approved
      }
    });

    // アプリ内通知ログ
    await notificationService.logNotification({
      userId: submitter.id,
      type: 'in_app',
      category: approved ? 'leave_request_approved' : 'leave_request_rejected',
      subject: title,
      content: submitterMessage,
      metadata: {
        requestId: request.id,
        leaveType: request.type,
        date: request.date.toISOString(),
        approved
      },
      status: 'sent'
    });

    if (approved) {
      // グループメンバーへの通知
      for (const member of groupMembers) {
        if (member.id !== submitter.id) {
          await notificationService.send({
            title: '休暇申請承認通知',
            body: `${submitter.name}さんの${leaveTypeMap[request.type]}申請が承認されました。`,
            userId: member.id,
            type: 'leave_approved_info',
            data: {
              requestId: request.id,
              submitterId: submitter.id,
              leaveType: request.type,
              date: request.date.toISOString()
            }
          });
        }
      }

      // 人事への通知
      for (const hrMember of hrMembers) {
        await notificationService.send({
          title: '休暇申請承認完了',
          body: `${submitter.name}さんの${leaveTypeMap[request.type]}申請が最終承認されました。`,
          userId: hrMember.id,
          type: 'leave_hr_notification',
          data: {
            requestId: request.id,
            submitterId: submitter.id,
            leaveType: request.type,
            date: request.date.toISOString()
          }
        });
      }
    }
  },

  // 個別承認時の通知（申請者への進捗報告）
  async notifyApprovalProgress(
    request: LeaveRequest,
    submitter: User,
    approver: User,
    approved: boolean
  ) {
    const action = approved ? '承認' : '却下';
    
    await notificationService.send({
      title: '休暇申請進捗通知',
      body: `${approver.name}さんがあなたの休暇申請を${action}しました。`,
      userId: submitter.id,
      type: 'leave_progress',
      data: {
        requestId: request.id,
        approverId: approver.id,
        approved,
        date: request.date.toISOString()
      }
    });
  }
};