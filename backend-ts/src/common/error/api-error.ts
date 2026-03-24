export type ApiErrorDetail = {
  field: string;
  message: string;
};

export type ApiError = {
  code: string;
  message: string;
  path: string;
  timestamp: string;
  details: ApiErrorDetail[];
};

export class AppError extends Error {
  status: number;
  code: string;
  details: ApiErrorDetail[];

  constructor(status: number, code: string, message: string, details: ApiErrorDetail[] = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const toApiError = (
  path: string,
  code: string,
  message: string,
  details: ApiErrorDetail[] = []
): ApiError => ({
  code,
  message,
  path,
  timestamp: new Date().toISOString(),
  details
});

