import { Controller, Get, Query } from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../common/prisma.service";
import { Roles } from "../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";

const statuses = ["IN_PROGRESS", "SUBMITTED", "EXPIRED", "ABANDONED", "VOIDED"] as const;

const listQuerySchema = z.object({
  status: z.enum(statuses).optional(),
  passed: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** Exam performance across all members — currently only the FREE_OPEN practice assessment exists. */
@Controller("admin/assessments")
@Roles("ADMIN")
export class AdminAssessmentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query(new ZodValidationPipe(listQuerySchema)) query: z.infer<typeof listQuerySchema>) {
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.passed !== undefined ? { passed: query.passed } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.attempt.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          type: true,
          tier: true,
          status: true,
          questionCount: true,
          correctCount: true,
          scoreBps: true,
          passed: true,
          startedAt: true,
          submittedAt: true,
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.attempt.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  @Get("stats")
  async stats() {
    const [total, submitted, passed] = await Promise.all([
      this.prisma.attempt.count(),
      this.prisma.attempt.count({ where: { status: { in: ["SUBMITTED", "EXPIRED"] } } }),
      this.prisma.attempt.count({ where: { passed: true } }),
    ]);
    return { total, submitted, passed };
  }
}
