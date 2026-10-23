import { Controller, Get, Query } from "@nestjs/common";
import { z } from "zod";
import { ActivityService } from "./activity.service";
import { Roles } from "../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";

const listQuerySchema = z.object({
  action: z.string().min(1).max(100).optional(),
  entityType: z.string().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

/** The full audit trail — every privileged action across the system, in one place. */
@Controller("admin/activity")
@Roles("ADMIN")
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  list(@Query(new ZodValidationPipe(listQuerySchema)) query: z.infer<typeof listQuerySchema>) {
    return this.activity.list(query);
  }

  @Get("actions")
  actions() {
    return this.activity.distinctActions();
  }
}
