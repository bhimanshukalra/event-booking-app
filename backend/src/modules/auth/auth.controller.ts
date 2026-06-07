import type { RequestHandler } from "express";
import { UserRole } from "../../generated/prisma/enums";
import { listDemoUsers } from "./auth.service";

export const listDemoUsersController: RequestHandler = async (
  _req,
  res,
  next,
) => {
  try {
    res.json(await listDemoUsers());
  } catch (error) {
    next(error);
  }
};

export const getCurrentUserController: RequestHandler = (req, res) => {
  res.json({
    data: req.user,
  });
};

export const adminCheckController: RequestHandler = (_req, res) => {
  res.json({
    data: {
      role: UserRole.admin,
      allowed: true,
    },
  });
};

export const staffCheckController: RequestHandler = (_req, res) => {
  res.json({
    data: {
      role: UserRole.staff,
      allowed: true,
    },
  });
};
