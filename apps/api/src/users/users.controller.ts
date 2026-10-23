import { Body, Controller, Delete, Get, Param, Patch, Query, Req } from "@nestjs/common";
import { z } from "zod";
import { UsersService } from "./users.service";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

const roles = ["MEMBER", "REVIEWER", "ADMIN", "SUPERADMIN"] as const;
const statuses = ["PENDING_VERIFICATION", "ACTIVE", "SUSPENDED", "DELETED"] as const;

const listQuerySchema = z.object({
  query: z.string().trim().max(200).optional(),
  role: z.enum(roles).optional(),
  status: z.enum(statuses).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const roleSchema = z.object({ role: z.enum(roles) });
const statusSchema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) });

/**
 * Member directory for staff — full PII (email, phone), so ADMIN is the floor,
 * tighter than the REVIEWER-accessible question queue. Role changes are further
 * restricted to SUPERADMIN so an ADMIN can never mint another ADMIN or promote
 * themselves.
 */
@Controller("admin/users")
@Roles("ADMIN")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query(new ZodValidationPipe(listQuerySchema)) query: z.infer<typeof listQuerySchema>) {
    return this.users.list(query);
  }

  @Get(":id")
  getOne(@Param("id") id: string) {
    return this.users.getOne(id);
  }

  @Roles("SUPERADMIN")
  @Patch(":id/role")
  setRole(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(roleSchema)) body: z.infer<typeof roleSchema>,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: { ip?: string; headers: Record<string, string | undefined> },
  ) {
    return this.users.setRole(id, body.role, user.id, context(req));
  }

  @Patch(":id/status")
  setStatus(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(statusSchema)) body: z.infer<typeof statusSchema>,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: { ip?: string; headers: Record<string, string | undefined> },
  ) {
    return this.users.setStatus(id, body.status, user.id, context(req));
  }

  // Soft delete only (see UsersService.softDelete) — same trust boundary as a
  // role change, since it's just as consequential.
  @Roles("SUPERADMIN")
  @Delete(":id")
  remove(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: { ip?: string; headers: Record<string, string | undefined> },
  ) {
    return this.users.softDelete(id, user.id, context(req));
  }
}

function context(req: { ip?: string; headers: Record<string, string | undefined> }) {
  return { ipAddress: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null };
}
