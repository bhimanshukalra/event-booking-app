import { Router, type Router as ExpressRouter } from "express";
import { UserRole } from "../../generated/prisma/enums";
import { requireRole } from "../../middleware/auth.middleware";
import { createReservationController } from "./reservations.controller";

export const reservationsRouter: ExpressRouter = Router();

reservationsRouter.post(
  "/",
  requireRole(UserRole.customer),
  createReservationController,
);
