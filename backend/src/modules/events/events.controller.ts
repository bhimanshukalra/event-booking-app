import type { RequestHandler } from "express";
import { HttpError } from "../../shared/errors/http-error.js";
import { getEventById, listEvents } from "./events.service.js";

export const listEventsController: RequestHandler = async (_req, res, next) => {
  try {
    res.json(await listEvents());
  } catch (error) {
    next(error);
  }
};

export const getEventController: RequestHandler = async (req, res, next) => {
  try {
    const eventId = req.params.id;

    if (!eventId || Array.isArray(eventId)) {
      throw new HttpError(400, "Event ID is required");
    }

    res.json(await getEventById(eventId));
  } catch (error) {
    next(error);
  }
};
