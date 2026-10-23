import { Controller, Get } from "@nestjs/common";
import { Public } from "./common/decorators/public.decorator";
import { PrismaService } from "./common/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness plus a real database round-trip, so a dead DB fails the check. */
  @Public()
  @Get()
  async check() {
    const started = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: "ok", database: "up", latencyMs: Date.now() - started, timestamp: new Date().toISOString() };
  }
}
