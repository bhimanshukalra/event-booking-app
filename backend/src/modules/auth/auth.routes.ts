import { Router, type Router as ExpressRouter } from "express";
import { UserRole } from "../../generated/prisma/enums";
import { requireAuth, requireRole } from "../../middleware/auth.middleware";
import {
  adminCheckController,
  getCurrentUserController,
  listDemoUsersController,
  staffCheckController,
} from "./auth.controller";

export const authRouter: ExpressRouter = Router();

authRouter.get("/demo-users", listDemoUsersController);
authRouter.get("/me", requireAuth, getCurrentUserController);
authRouter.get(
  "/admin-check",
  requireRole(UserRole.admin),
  adminCheckController,
);
authRouter.get(
  "/staff-check",
  requireRole(UserRole.staff),
  staffCheckController,
);
