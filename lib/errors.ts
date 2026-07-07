export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "VALIDATION" | "CONFLICT" | "SERVER",
  ) {
    super(message);
  }
}

export function toSafeErrorMessage(error: unknown) {
  if (error instanceof AppError) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}
