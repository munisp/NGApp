import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const isDev = process.env.NODE_ENV === "development";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  // IEC 62443 SR 3.1 — sanitize stack traces to prevent information disclosure
  // In dev: keep stack but strip absolute paths and node_modules references
  // In prod: omit stack entirely
  errorFormatter({ shape, error }) {
    let safeStack: string | undefined;
    if (isDev && error.stack) {
      // Remove absolute paths (/home/ubuntu, /root, etc.) and node_modules internals
      safeStack = error.stack
        .split("\n")
        .map(line => line
          .replace(/\/home\/[^/]+\/[^ )]+/g, "<path>")
          .replace(/\/root\/[^ )]+/g, "<path>")
          .replace(/\/usr\/[^ )]+/g, "<path>")
        )
        .filter(line => !line.includes("node_modules"))
        .join("\n");
    }
    return {
      ...shape,
      data: {
        ...shape.data,
        stack: safeStack,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
