import { apiClient } from './client';
import type { AppMessage, AppNotification, User } from '../types';

export async function fetchSuggestedRecipients(): Promise<User[]> {
  const { data } = await apiClient.get<User[]>('/messages/recipients/suggest');
  return data;
}

export async function sendMessage(payload: {
  subject: string;
  body: string;
  recipient_ids?: string[];
  is_broadcast?: boolean;
}): Promise<AppMessage> {
  const { data } = await apiClient.post<AppMessage>('/messages', payload);
  return data;
}

export async function fetchInbox(): Promise<AppMessage[]> {
  const { data } = await apiClient.get<AppMessage[]>('/messages/inbox');
  return data;
}

export async function fetchSentMessages(): Promise<AppMessage[]> {
  const { data } = await apiClient.get<AppMessage[]>('/messages/sent');
  return data;
}

export async function fetchMessage(messageId: string): Promise<AppMessage> {
  const { data } = await apiClient.get<AppMessage>(`/messages/${messageId}`);
  return data;
}

export async function uploadMessageAttachment(messageId: string, file: File): Promise<void> {
  const form = new FormData();
  form.append('file', file);
  await apiClient.post(`/messages/${messageId}/attachments`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export async function downloadMessageAttachment(attachmentId: string, fileName: string): Promise<string> {
  const { data } = await apiClient.get<Blob>(`/messages/attachments/${attachmentId}`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(data);
  if (fileName.match(/\.(jpe?g|png)$/i)) {
    return url;
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  return '';
}

export async function fetchNotifications(unreadOnly = false): Promise<AppNotification[]> {
  const { data } = await apiClient.get<AppNotification[]>('/notifications', {
    params: { unread_only: unreadOnly },
  });
  return data;
}

export async function fetchUnreadCount(): Promise<number> {
  const { data } = await apiClient.get<{ count: number }>('/notifications/unread-count');
  return data.count;
}

export async function markNotificationRead(notificationId: string): Promise<AppNotification> {
  const { data } = await apiClient.patch<AppNotification>(`/notifications/${notificationId}/read`);
  return data;
}
