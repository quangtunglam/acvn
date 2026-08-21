import app from "./app";
import { logger } from "./lib/logger";
import { seedIfEmpty, ensureFeeds, ensureCategories, ensureCategoryHierarchy } from "./seed/seeder.js";

const rawPort = process.env["PORT"] || "5000";
const port = Number(rawPort);


app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Seed production DB if empty (safe no-op when data already exists)
  seedIfEmpty().catch((e) => logger.error({ err: e }, "seedIfEmpty threw"));
  // Ensure new RSS feeds are always present (runs on every startup)
  ensureFeeds().catch((e) => logger.error({ err: e }, "ensureFeeds threw"));
  // Ensure required categories exist (runs on every startup)
  ensureCategories().catch((e) => logger.error({ err: e }, "ensureCategories threw"));
  // Ensure subcategory hierarchy (runs on every startup)
  ensureCategoryHierarchy().catch((e) => logger.error({ err: e }, "ensureCategoryHierarchy threw"));
});
