import { ArgumentMetadata, BadRequestException, PipeTransform } from "@nestjs/common";
import { ZodSchema } from "zod";

/**
 * Validates a request payload against a Zod schema and returns the PARSED value,
 * not the raw input — so unknown properties are stripped rather than flowing into
 * a Prisma call.
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata) {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException({
        message: "Validation failed",
        errors: result.error.issues.map((i) => ({
          field: i.path.join(".") || "(root)",
          message: i.message,
        })),
      });
    }

    return result.data;
  }
}
