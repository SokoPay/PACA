import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

export interface AuditEntry {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Append-only record of every privileged action.
 *
 * Deliberately never throws into the caller: an audit failure must not roll back a
 * legitimate business action (a member being approved, a question being published).
 * It is logged loudly instead, because a silently broken audit trail is worse than
 * a noisy one.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: entry.actorUserId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          metadata: (entry.metadata ?? {}) as object,
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
        },
      });
    } catch (err) {
      this.logger.error(
        `AUDIT WRITE FAILED action=${entry.action} entity=${entry.entityType}:${entry.entityId ?? "-"} actor=${entry.actorUserId ?? "-"}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
