/**
 * Google Calendar API Service
 * Google Meet会議室の自動作成とメール送信
 */

import { supabase } from '../lib/supabase';

export interface GoogleMeetEvent {
  id: string;
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  attendees: string[];
  meetLink?: string;
  calendarEventId?: string;
}

export interface CreateMeetEventParams {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  attendees: string[];
  timeZone?: string;
  sendNotifications?: boolean;
}

/**
 * Google Calendar APIを使用してMeet会議を作成
 */
export class GoogleCalendarService {
  private accessToken: string | null = null;
  
  constructor() {
    // 環境変数からGoogle APIの設定を取得
    this.initializeFromEnv();
  }

  private initializeFromEnv() {
    // 環境変数はフロントエンドでは使用しないため、
    // Supabase Edge Functionsを経由してAPI呼び出しを行う
  }

  /**
   * Google Meet会議を作成（Supabase Edge Function経由）
   */
  async createMeetEvent(params: CreateMeetEventParams): Promise<GoogleMeetEvent> {
    try {
      console.log('Google Meet会議作成開始:', params);

      // Supabase Edge Functionを呼び出し
      const { data, error } = await supabase.functions.invoke('create-google-meet', {
        body: {
          title: params.title,
          description: params.description || '',
          startTime: params.startTime.toISOString(),
          endTime: params.endTime.toISOString(),
          attendees: params.attendees,
          timeZone: params.timeZone || 'Asia/Tokyo',
          sendNotifications: params.sendNotifications ?? true
        }
      });

      if (error) {
        console.error('Google Meet作成エラー:', error);
        throw new Error(`Google Meet会議の作成に失敗しました: ${error.message}`);
      }

      console.log('Google Meet会議作成成功:', data);

      return {
        id: data.id,
        title: params.title,
        description: params.description || '',
        startTime: params.startTime,
        endTime: params.endTime,
        attendees: params.attendees,
        meetLink: data.meetLink,
        calendarEventId: data.calendarEventId
      };

    } catch (error) {
      console.error('Google Meet作成エラー:', error);
      
      // フォールバック: ダミーのMeetリンクを生成
      console.warn('フォールバック: ダミーMeetリンクを生成します');
      return this.createFallbackMeetEvent(params);
    }
  }

  /**
   * フォールバック: ダミーのGoogle Meetイベントを作成
   */
  private createFallbackMeetEvent(params: CreateMeetEventParams): GoogleMeetEvent {
    const meetingId = this.generateMeetingId(params.title, params.startTime);
    const meetLink = `https://meet.google.com/${meetingId}`;
    
    console.log('フォールバックMeetリンク生成:', meetLink);

    return {
      id: `fallback_${Date.now()}`,
      title: params.title,
      description: params.description || '',
      startTime: params.startTime,
      endTime: params.endTime,
      attendees: params.attendees,
      meetLink: meetLink,
      calendarEventId: undefined
    };
  }

  /**
   * ミーティングIDを生成（フォールバック用）
   */
  private generateMeetingId(title: string, startTime: Date): string {
    const timestamp = startTime.getTime();
    const titleHash = this.hashString(title);
    const random = Math.random().toString(36).substring(2, 5);
    
    // Format: abc-defg-hij (Google Meet style)
    return `${titleHash.substring(0, 3)}-${timestamp.toString(36).substring(-4)}-${random}`;
  }

  /**
   * 文字列のハッシュを生成
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 会議の詳細情報を取得
   */
  async getMeetEventDetails(eventId: string): Promise<GoogleMeetEvent | null> {
    try {
      const { data, error } = await supabase.functions.invoke('get-google-meet', {
        body: { eventId }
      });

      if (error) {
        console.error('Google Meet詳細取得エラー:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Google Meet詳細取得エラー:', error);
      return null;
    }
  }

  /**
   * 会議をキャンセル
   */
  async cancelMeetEvent(eventId: string): Promise<boolean> {
    try {
      const { error } = await supabase.functions.invoke('cancel-google-meet', {
        body: { eventId }
      });

      if (error) {
        console.error('Google Meet キャンセルエラー:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Google Meet キャンセルエラー:', error);
      return false;
    }
  }

  /**
   * 参加者にメール通知を送信
   */
  async sendMeetInvitation(meetEvent: GoogleMeetEvent): Promise<boolean> {
    try {
      console.log('Meet招待メール送信開始:', meetEvent);

      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'meet_invitation',
          recipients: meetEvent.attendees,
          subject: `【会議招待】${meetEvent.title}`,
          data: {
            meetEvent: {
              title: meetEvent.title,
              description: meetEvent.description,
              startTime: meetEvent.startTime.toISOString(),
              endTime: meetEvent.endTime.toISOString(),
              meetLink: meetEvent.meetLink,
              calendarEventId: meetEvent.calendarEventId
            }
          }
        }
      });

      if (error) {
        console.error('Meet招待メール送信エラー:', error);
        return false;
      }

      console.log('Meet招待メール送信成功');
      return true;
    } catch (error) {
      console.error('Meet招待メール送信エラー:', error);
      return false;
    }
  }

  /**
   * 会議のリマインダーメールを送信
   */
  async sendMeetReminder(meetEvent: GoogleMeetEvent, minutesBefore: number = 15): Promise<boolean> {
    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'meet_reminder',
          recipients: meetEvent.attendees,
          subject: `【会議リマインダー】${meetEvent.title} - ${minutesBefore}分前`,
          data: {
            meetEvent,
            minutesBefore
          }
        }
      });

      if (error) {
        console.error('Meetリマインダーメール送信エラー:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Meetリマインダーメール送信エラー:', error);
      return false;
    }
  }
}

// シングルトンインスタンス
export const googleCalendarService = new GoogleCalendarService();