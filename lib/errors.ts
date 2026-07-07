import { t } from "@/lib/i18n";

export type AppErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "VALIDATION" | "CONFLICT" | "SERVER";

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(message: string, code: AppErrorCode) {
    super(message);
    this.code = code;
  }
}

export function toSafeErrorMessage(error: unknown) {
  if (error instanceof AppError) {
    return error.message;
  }

  return t("system.somethingWentWrong");
}
