import type { AppNotification, UserRole } from '../types';
import { hasRole, MAINTENANCE_ROLES } from './roles';

export function isMaintenanceAlert(notification: AppNotification): boolean {
  if (notification.entity_type === 'maintenance_issue') return true;
  return notification.notification_type.startsWith('maintenance_issue');
}

function issueTitle(notification: AppNotification): string {
  return notification.maintenance_issue?.title ?? 'Maintenance issue';
}

function categoryLabel(category?: string): string {
  if (!category) return 'issue';
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function maintenanceAlertTitle(notification: AppNotification): string {
  if (!isMaintenanceAlert(notification)) {
    return notification.message?.subject ?? 'Notification';
  }
  const title = issueTitle(notification);
  if (notification.notification_type === 'maintenance_issue_closed') {
    return `Maintenance completed: ${title}`;
  }
  return `New maintenance issue: ${title}`;
}

export function maintenanceAlertSubtitle(notification: AppNotification): string {
  if (!isMaintenanceAlert(notification)) {
    return notification.message?.sender?.full_name ?? '';
  }

  const issue = notification.maintenance_issue;
  if (notification.notification_type === 'maintenance_issue_closed') {
    const parts: string[] = [];
    if (issue?.closed_by_user?.full_name) {
      parts.push(`Closed by ${issue.closed_by_user.full_name}`);
    }
    if (issue?.resolution_notes) {
      const preview =
        issue.resolution_notes.length > 80
          ? `${issue.resolution_notes.slice(0, 80)}…`
          : issue.resolution_notes;
      parts.push(preview);
    }
    if (parts.length === 0 && issue?.category) {
      parts.push(categoryLabel(issue.category));
    }
    return parts.join(' · ');
  }

  const parts: string[] = [];
  if (issue?.category) parts.push(categoryLabel(issue.category));
  if (issue?.status) parts.push(issue.status.replace(/_/g, ' '));
  if (issue?.raised_by_user?.full_name) parts.push(`raised by ${issue.raised_by_user.full_name}`);
  return parts.join(' · ');
}

export function maintenanceAlertTarget(
  notification: AppNotification,
  userRole: UserRole
): string | null {
  if (!isMaintenanceAlert(notification) || !notification.entity_id) return null;

  if (hasRole(userRole, MAINTENANCE_ROLES)) {
    return `/maintenance?issue=${notification.entity_id}`;
  }

  if (notification.maintenance_issue?.run_id) {
    return `/reports/${notification.maintenance_issue.run_id}`;
  }

  return null;
}
