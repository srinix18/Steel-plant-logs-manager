import { apiClient, getApiBaseUrl } from '@/src/api/client';
import { getToken } from '@/src/api/storage';
import type { User } from '@/src/types/user';
import * as FileSystem from 'expo-file-system/legacy';

export type MessageAttachment = {
  id: string;
  message_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

export type AppMessage = {
  id: string;
  organisation_id: string;
  sender_id: string;
  subject: string;
  body: string;
  is_broadcast: boolean;
  created_at: string;
  sender?: { id: string; full_name: string; role?: string };
  attachments: MessageAttachment[];
  read_at?: string | null;
};

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

/** Download attachment to cache; returns local file URI. */
export async function downloadMessageAttachment(
  attachmentId: string,
  fileName: string
): Promise<string> {
  const token = await getToken();
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const dest = `${FileSystem.cacheDirectory}msg-${attachmentId}-${safe}`;
  const result = await FileSystem.downloadAsync(
    `${getApiBaseUrl()}/messages/attachments/${attachmentId}`,
    dest,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );
  if (result.status !== 200) {
    throw new Error(`Attachment download failed (${result.status})`);
  }
  return result.uri;
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

export async function fetchSuggestedRecipients(): Promise<User[]> {
  const { data } = await apiClient.get<User[]>('/messages/recipients/suggest');
  return data;
}

export type PendingAttachment = {
  uri: string;
  name: string;
  mimeType: string;
};

/** Multipart upload — only jpeg/png/pdf. */
export async function uploadMessageAttachment(
  messageId: string,
  file: PendingAttachment
): Promise<void> {
  const token = await getToken();
  const form = new FormData();
  form.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType,
  } as unknown as Blob);

  const res = await fetch(`${getApiBaseUrl()}/messages/${messageId}/attachments`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const json = JSON.parse(text) as { detail?: string };
      if (typeof json.detail === 'string') detail = json.detail;
    } catch {
      /* keep text */
    }
    throw new Error(detail || `Attachment upload failed (${res.status})`);
  }
}

export type AppNotification = {
  id: string;
  message_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  notification_type: string;
  read_at?: string | null;
  created_at: string;
  message?: AppMessage | null;
  maintenance_issue?: {
    id: string;
    title: string;
    category: string;
    status: string;
    run_id?: string | null;
    closed_at?: string | null;
    resolution_notes?: string | null;
    closed_by_user?: { id: string; full_name: string };
    raised_by_user?: { id: string; full_name: string };
  } | null;
};

export async function fetchNotifications(unreadOnly = false): Promise<AppNotification[]> {
  const q = unreadOnly ? '?unread_only=true' : '';
  const { data } = await apiClient.get<AppNotification[]>(`/notifications${q}`);
  return data;
}

export async function fetchUnreadCount(): Promise<number> {
  const { data } = await apiClient.get<{ count: number }>('/notifications/unread-count');
  return data.count;
}

export async function markNotificationRead(notificationId: string): Promise<AppNotification> {
  const { data } = await apiClient.patch<AppNotification>(
    `/notifications/${notificationId}/read`
  );
  return data;
}
