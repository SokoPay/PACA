import { Injectable, Logger } from "@nestjs/common";
import type { NotificationKind } from "@prisma/client";
import { PrismaService } from "./prisma.service";

export interface NotificationInput {
  kind: NotificationKind;
  title: string;
  body: string;
  link?: string | null;
}

/**
 * In-app notifications (the bell in the header and the dashboard feed).
 *
 * Never throws into the caller: a notification is a courtesy, and failing to
 * write one must not undo the payment, approval or certificate that caused it.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async notify(userId: string, n: NotificationInput): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: { userId, kind: n.kind, title: n.title, body: n.body, link: n.link ?? null },
      });
    } catch (err) {
      this.logger.error(`Could not write notification for ${userId}: ${(err as Error).message}`);
    }
  }

  async notifyMany(userIds: string[], n: NotificationInput): Promise<number> {
    if (userIds.length === 0) return 0;
    try {
      const res = await this.prisma.notification.createMany({
        data: userIds.map((userId) => ({ userId, kind: n.kind, title: n.title, body: n.body, link: n.link ?? null })),
      });
      return res.count;
    } catch (err) {
      this.logger.error(`Could not fan out notification: ${(err as Error).message}`);
      return 0;
    }
  }
}
