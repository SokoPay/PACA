import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import Redis from "ioredis";
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
    // rawBody: the Paystack webhook signature is computed over the exact bytes sent.
    { bufferLogs: true, rawBody: true },
  );

  await app.register(helmet, {
    // The API serves JSON and member documents, never pages: lock everything down.
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'self'"] } },
    crossOriginResourcePolicy: { policy: "same-origin" },
    hsts: { maxAge: 31_536_000, includeSubDomains: true },
  });

  // Personal data must not linger in browser or proxy caches (or be shown again
  // by the Back button after sign-out). Routes that set their own policy keep it.
  app
    .getHttpAdapter()
    .getInstance()
    .addHook("onSend", async (_req, reply, payload) => {
      if (!reply.hasHeader("cache-control")) reply.header("cache-control", "no-store");
      return payload;
    });

  await app.register(multipart, {
    limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  });

  // Counters live in Redis when configured, so a restart does not reset them and
  // several API instances share one budget per IP. skipOnError fails open: a Redis
  // outage degrades rate limiting rather than taking the whole API down.
  const redis = env.REDIS_URL
    ? new Redis(env.REDIS_URL, { connectTimeout: 2000, maxRetriesPerRequest: 1, enableOfflineQueue: false })
    : undefined;
  redis?.on("error", (err) => logger.warn(`Redis: ${err.message}`));
  // An open Redis socket would otherwise keep the process alive after shutdown.
  if (redis) app.getHttpAdapter().getInstance().addHook("onClose", async () => void redis.quit());

  // Coarse global limit; auth routes set tighter ones via @RouteConfig.
  await app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
    ...(redis ? { redis, nameSpace: "paca-ratelimit-", skipOnError: true } : {}),
  });
  logger.log(`Rate limit store: ${redis ? "redis" : "in-memory"}`);

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
