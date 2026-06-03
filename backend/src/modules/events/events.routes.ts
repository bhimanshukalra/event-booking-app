import { Router, type Router as ExpressRouter } from "express";
import {
  getEventController,
  listEventsController,
} from "./events.controller.js";

export const eventsRouter: ExpressRouter = Router();

eventsRouter.get("/", listEventsController);
eventsRouter.get("/:id", getEventController);
