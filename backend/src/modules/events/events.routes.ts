import { Router, type Router as ExpressRouter } from "express";
import { getEventController, listEventsController } from "./events.controller";

export const eventsRouter: ExpressRouter = Router();

eventsRouter.get("/", listEventsController);
eventsRouter.get("/:id", getEventController);
