import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";

export interface ListActivityQuery {
  action?: string;
  entityType?: string;
  page: number;
  pageSize: number;
}

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: ListActivityQuery) {
    const where = {
      ...(q.action ? { action: q.action } : {}),
      ...(q.entityType ? { entityType: q.entityType } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          metadata: true,
          createdAt: true,
          actor: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  /** Distinct actions seen so far, for the filter dropdown — cheaper than hardcoding every action string. */
  async distinctActions(): Promise<string[]> {
    const rows = await this.prisma.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    });
    return rows.map((r) => r.action);
  }
}
