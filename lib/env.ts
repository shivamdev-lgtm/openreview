import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  experimental__runtimeEnv: {},
  server: {
    GITHUB_APP_ID: z.string().min(1).optional(),
    GITHUB_APP_INSTALLATION_ID: z.coerce.number().int().positive().optional(),
    GITHUB_APP_PRIVATE_KEY: z.string().min(1).optional(),
    GITHUB_APP_WEBHOOK_SECRET: z.string().min(1).optional(),
    REDIS_URL: z.string().url().optional(),
    LITELLM_API_KEY: z.string().min(1).optional(),
    LITELLM_BASE_URL: z.string().url().optional(),
    LITELLM_MODEL: z.string().min(1).optional(),
    OPENSANDBOX_API_KEY: z.string().min(1).optional(),
    OPENSANDBOX_DOMAIN: z.string().min(1).optional(),
  },
  skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
});
