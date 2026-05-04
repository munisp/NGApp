import { createHash } from "crypto";
import type { Request, Response, NextFunction } from "express";

/**
 * ETag middleware for conditional GET responses.
 * Returns 304 Not Modified when response body hasn't changed,
 * saving bandwidth on dashboard polling queries.
 */
export function etagMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return next();
  }

  const originalJson = res.json.bind(res);

  res.json = function (body: unknown) {
    const bodyStr = JSON.stringify(body);
    const hash = createHash("md5").update(bodyStr).digest("hex");
    const etag = `"${hash}"`;

    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "private, must-revalidate");

    const ifNoneMatch = req.headers["if-none-match"];
    if (ifNoneMatch === etag) {
      res.status(304).end();
      return res;
    }

    return originalJson(JSON.parse(bodyStr));
  };

  next();
}
