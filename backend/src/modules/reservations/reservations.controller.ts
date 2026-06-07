import type { RequestHandler } from "express";
import { HttpError } from "../../shared/errors/http-error";
import { createReservation } from "./reservations.service";
import { createReservationSchema } from "./reservations.validation";

export const createReservationController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    if (!req.user) {
      throw new HttpError(401, "Missing x-demo-user-email header");
    }

    const parsedBody = createReservationSchema.safeParse(req.body);

    if (!parsedBody.success) {
      throw new HttpError(400, "Invalid reservation request");
    }

    const result = await createReservation(req.user.id, parsedBody.data);

    res.status(result.created ? 201 : 200).json({
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
};
