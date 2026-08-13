/**
 * Notification type constants
 */
export const NOTIFICATION_TYPES = {
  // Assignment notifications
  ASSIGNMENT_ASSIGNED: "assignment_assigned",
  ASSIGNMENT_UPDATED: "assignment_updated",
  ASSIGNMENT_COMPLETED: "assignment_completed",
  ASSIGNMENT_REOPENED: "assignment_reopened",

  // Incident notifications
  INCIDENT_CREATED: "incident_created",
  INCIDENT_UPDATED: "incident_updated",
  INCIDENT_CLOSED: "incident_closed",
  INCIDENT_ASSIGNED: "incident_assigned",

  // Vacation notifications
  VACATION_REQUESTED: "vacation_requested",
  VACATION_APPROVED: "vacation_approved",
  VACATION_REJECTED: "vacation_rejected",

  // System notifications
  SYSTEM: "system",
  ANNOUNCEMENT: "announcement",
} as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

/**
 * Entity types that can be linked to notifications
 */
export const ENTITY_TYPES = {
  ASSIGNMENT: "assignment",
  INCIDENT: "incident",
  USER: "user",
  SCHEDULE: "schedule",
  VACATION: "vacation",
} as const;

export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];

/**
 * Notification priority levels
 */
export const NOTIFICATION_PRIORITY = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
} as const;

export type NotificationPriority =
  (typeof NOTIFICATION_PRIORITY)[keyof typeof NOTIFICATION_PRIORITY];

/**
 * Input for creating a notification
 */
export interface CreateNotificationInput {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  entityType?: EntityType;
  entityId?: string;
  actionUrl?: string;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown>;
}

/**
 * Notification with user relation (returned from queries)
 */
export interface NotificationWithUser {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  entityType: string | null;
  entityId: string | null;
  actionUrl: string | null;
  isRead: boolean;
  readAt: Date | null;
  priority: number;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
  active: boolean;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

/**
 * Options for querying notifications
 */
export interface GetNotificationsOptions {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
  type?: NotificationType;
}
