import { NextResponse } from 'next/server';

export type ApiErrorType =
  | 'invalid_request_error'
  | 'authentication_error'
  | 'authorization_error'
  | 'not_found_error'
  | 'conflict_error'
  | 'api_error';

export type ApiErrorCode =
  | 'MISSING_FIELD'
  | 'INVALID_AMOUNT'
  | 'INVALID_EMAIL'
  | 'INVALID_DATE'
  | 'NOTE_TOO_LONG'
  | 'BAD_WORDS_IN_NOTE'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN_NOT_RECIPIENT'
  | 'FORBIDDEN_NOT_SENDER'
  | 'FORBIDDEN_NOT_PARTICIPANT'
  | 'REQUEST_NOT_FOUND'
  | 'RECIPIENT_NOT_FOUND'
  | 'USER_NOT_FOUND'
  | 'REQUEST_EXPIRED'
  | 'INVALID_STATUS'
  | 'ALREADY_REPEATED'
  | 'INSUFFICIENT_BALANCE'
  | 'INVALID_SCHEDULE_DATE'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export type ApiErrorDetail = { field: string; issue: string };

export type ApiErrorBody = {
  error: {
    type: ApiErrorType;
    code: ApiErrorCode;
    message: string;
    details?: ApiErrorDetail[];
  };
};

const STATUS_BY_TYPE: Record<ApiErrorType, number> = {
  invalid_request_error: 400,
  authentication_error: 401,
  authorization_error: 403,
  not_found_error: 404,
  conflict_error: 409,
  api_error: 500,
};

export function apiError(
  type: ApiErrorType,
  code: ApiErrorCode,
  message: string,
  details?: ApiErrorDetail[]
): NextResponse<ApiErrorBody> {
  return NextResponse.json<ApiErrorBody>(
    { error: { type, code, message, ...(details ? { details } : {}) } },
    { status: STATUS_BY_TYPE[type] }
  );
}

export const unauthorized = () =>
  apiError('authentication_error', 'UNAUTHORIZED', 'Authentication required.');

export const forbidden = (code: ApiErrorCode, message: string) =>
  apiError('authorization_error', code, message);

export const notFound = (code: ApiErrorCode, message: string) =>
  apiError('not_found_error', code, message);

export const badRequest = (
  code: ApiErrorCode,
  message: string,
  details?: ApiErrorDetail[]
) => apiError('invalid_request_error', code, message, details);

export const conflict = (code: ApiErrorCode, message: string) =>
  apiError('conflict_error', code, message);

export const internalError = (message = 'Internal server error.') =>
  apiError('api_error', 'INTERNAL_ERROR', message);

export const STATUS_LABELS: Record<number, string> = {
  1: 'pending',
  2: 'paid',
  3: 'declined',
  4: 'expired',
  5: 'scheduled',
  6: 'cancelled',
  7: 'failed',
};
