function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];

  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

type RateLimitRule = { limit: number; windowSeconds: number };

// Every limit is env-overridable but has a safe hardcoded default, so a
// missing env var can never silently disable rate limiting.
export const rateLimitConfig = {
  loginIp: {
    limit: readIntEnv("RATE_LIMIT_LOGIN_IP_MAX", 10),
    windowSeconds: readIntEnv("RATE_LIMIT_LOGIN_IP_WINDOW_SECONDS", 60),
  },
  loginAccount: {
    limit: readIntEnv("RATE_LIMIT_LOGIN_ACCOUNT_MAX", 5),
    windowSeconds: readIntEnv("RATE_LIMIT_LOGIN_ACCOUNT_WINDOW_SECONDS", 900),
  },
  registerIp: {
    limit: readIntEnv("RATE_LIMIT_REGISTER_IP_MAX", 5),
    windowSeconds: readIntEnv("RATE_LIMIT_REGISTER_IP_WINDOW_SECONDS", 3600),
  },
  forgotPasswordIp: {
    limit: readIntEnv("RATE_LIMIT_FORGOT_PW_IP_MAX", 10),
    windowSeconds: readIntEnv("RATE_LIMIT_FORGOT_PW_IP_WINDOW_SECONDS", 3600),
  },
  forgotPasswordAccount: {
    limit: readIntEnv("RATE_LIMIT_FORGOT_PW_ACCOUNT_MAX", 3),
    windowSeconds: readIntEnv("RATE_LIMIT_FORGOT_PW_ACCOUNT_WINDOW_SECONDS", 3600),
  },
  importUploadUser: {
    limit: readIntEnv("RATE_LIMIT_IMPORT_USER_MAX", 5),
    windowSeconds: readIntEnv("RATE_LIMIT_IMPORT_USER_WINDOW_SECONDS", 60),
  },
  importUploadOrg: {
    limit: readIntEnv("RATE_LIMIT_IMPORT_ORG_MAX", 50),
    windowSeconds: readIntEnv("RATE_LIMIT_IMPORT_ORG_WINDOW_SECONDS", 3600),
  },
} satisfies Record<string, RateLimitRule>;
