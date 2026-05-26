/**
 * Request ID middleware — generates or propagates x-request-id for distributed tracing.
 */
import { v4 as uuidv4 } from "uuid";
import type { Request, Response, NextFunction } from "express";
import logger from "./logger";

const REQUEST_ID_HEADER = "x-request-id";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers[REQUEST_ID_HEADER] as string) || uuidv4();
  req.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);

  // Attach child logger with request context
  (req as unknown as Record<string, unknown>).log = logger.child({
    requestId,
    method: req.method,
    url: req.originalUrl,
  });

  next();
}

export { REQUEST_ID_HEADER };
