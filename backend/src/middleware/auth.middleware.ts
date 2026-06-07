import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { UserRole } from "../generated/prisma/enums";
import { prisma } from "../config/prisma";
import { HttpError } from "../shared/errors/http-error";

const DEMO_USER_EMAIL_HEADER = "x-demo-user-email";

export const demoAuthMiddleware: RequestHandler = async (req, _res, next) => {
  try {
    const demoUserEmail = req.header(DEMO_USER_EMAIL_HEADER);

    if (!demoUserEmail) {
      next();
      return;
    }

    const user = await prisma.user.findUnique({
      where: {
        email: demoUserEmail,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      throw new HttpError(401, "Demo user not found");
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    next(new HttpError(401, `Missing ${DEMO_USER_EMAIL_HEADER} header`));
    return;
  }

  next();
}

export function requireRole(...allowedRoles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new HttpError(401, `Missing ${DEMO_USER_EMAIL_HEADER} header`));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new HttpError(403, "Insufficient role permissions"));
      return;
    }

    next();
  };
}
