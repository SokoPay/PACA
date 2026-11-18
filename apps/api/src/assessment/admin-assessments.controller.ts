import { Controller, Get, Query } from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../common/prisma.service";
import { Roles } from "../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";

const statuses = ["IN_PROGRESS", "SUBMITTED", "EXPIRED", "ABANDONED", "VOIDED"] as const;

/** The categories staff see: the free test, and one certification exam per membership type. */
const CATEGORIES = [
  { key: "FREE", label: "Free competency test", where: { type: "FREE_OPEN" as const } },
  { key: "STUDENT", label: "Student exam", where: { type: "CERTIFICATION" as const, tier: "STUDENT" as const } },
  { key: "PROFESSIONAL", label: "Professional exam", where: { type: "CERTIFICATION" as const, tier: "PROFESSIONAL" as const } },
  { key: "EXECUTIVE", label: "Executive exam", where: { type: "CERTIFICATION" as const, tier: "EXECUTIVE" as const } },
] as const;
type CategoryKey = (typeof CATEGORIES)[number]["key"];
const categoryWhere = (key?: CategoryKey) => CATEGORIES.find((c) => c.key === key)?.where ?? {};

const listQuerySchema = z.object({
  status: z.enum(statuses).optional(),
  // Not z.coerce.boolean(): that turns the query string "false" into true.
  passed: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  category: z.enum(["FREE", "STUDENT", "PROFESSIONAL", "EXECUTIVE"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** Exam performance across all members, by category: free test and each membership exam. */
@Controller("admin/assessments")
@Roles("ADMIN")
export class AdminAssessmentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query(new ZodValidationPipe(listQuerySchema)) query: z.infer<typeof listQuerySchema>) {
    const where = {
      ...categoryWhere(query.category),
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
    const categories = await Promise.all(
      CATEGORIES.map(async (c) => {
        const done = { ...c.where, status: { in: ["SUBMITTED" as const, "EXPIRED" as const] } };
        const [started, completed, passedCount, avg, takers] = await Promise.all([
          this.prisma.attempt.count({ where: c.where }),
          this.prisma.attempt.count({ where: done }),
          this.prisma.attempt.count({ where: { ...c.where, passed: true } }),
          this.prisma.attempt.aggregate({ where: { ...done, scoreBps: { not: null } }, _avg: { scoreBps: true } }),
          this.prisma.attempt.groupBy({ by: ["userId"], where: c.where }),
        ]);
        return {
          key: c.key,
          label: c.label,
          started,
          completed,
          passed: passedCount,
          people: takers.length,
          averageScoreBps: avg._avg.scoreBps === null ? null : Math.round(avg._avg.scoreBps),
        };
      }),
    );
    return { total, submitted, passed, categories };
  }
}
