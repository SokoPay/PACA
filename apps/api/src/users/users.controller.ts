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

const opt = (max: number) => z.string().max(max).nullable().optional();
const updateSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  email: z.string().trim().email().max(320).optional(),
  phone: opt(40),
  profile: z
    .object({
      gender: z.enum(["MALE", "FEMALE", "UNSPECIFIED"]).optional(),
      addressLine1: opt(200),
      addressLine2: opt(200),
      city: opt(120),
      stateProvince: opt(120),
      postalCode: opt(32),
      country: opt(2),
      highestQualification: opt(200),
      yearOfGraduation: z.number().int().min(1940).max(2100).nullable().optional(),
      occupation: opt(200),
      employer: opt(200),
      institution: opt(200),
      institutionLevel: opt(10),
      programOfStudy: opt(200),
      linkedinUrl: opt(300),
      bio: opt(2000),
    })
    .optional(),
});
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

  /** Correct a member's details. SUPERADMIN only, like role changes. */
  @Roles("SUPERADMIN")
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateSchema)) body: z.infer<typeof updateSchema>,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: { ip?: string; headers: Record<string, string | undefined> },
  ) {
    return this.users.update(id, body, user.id, context(req));
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
    return this.users.setStatus(id, body.status, user, context(req));
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
