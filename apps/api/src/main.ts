import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import { AppModule } from "./app.module";
import { loadEnv } from "./config/env";

async function bootstrap(): Promise<void> {
  // Validate configuration before anything else — fail loudly at boot rather than
  // subtly at runtime.
  const env = loadEnv();
  const logger = new Logger("Bootstrap");

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    // 10MB — raised from the original 1MB (fine for pure JSON) to fit an
    // application document upload. @fastify/multipart below applies its own
    // tighter per-file cap.
    new FastifyAdapter({ trustProxy: true, bodyLimit: 10_485_760 }),
    { bufferLogs: true },
  );

  await app.register(helmet, {
    contentSecurityPolicy: false, // the API serves JSON, not documents
  });

  await app.register(multipart, {
    limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  });

  // Coarse global limit. Auth endpoints need something far tighter; that belongs
  // on the routes themselves once login is under real load.
  await app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
  });

  const allowedOrigins = (env.CORS_ORIGINS ?? env.WEB_PUBLIC_URL)
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });
  logger.log(`CORS origins: ${allowedOrigins.join(", ")}`);

  app.setGlobalPrefix("api/v1");

  // No global ValidationPipe: validation is per-route via ZodValidationPipe, which
  // returns the PARSED value, so unknown properties are stripped there. Adding
  // Nest's pipe as well would pull in class-validator for no benefit.

  app.enableShutdownHooks();

  await app.listen(env.API_PORT, "0.0.0.0");
  logger.log(`PACA API listening on ${env.API_PUBLIC_URL} (${env.NODE_ENV})`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start PACA API:", err);
  process.exit(1);
});
