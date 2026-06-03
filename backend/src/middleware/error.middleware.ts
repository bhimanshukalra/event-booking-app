import type { ErrorRequestHandler } from "express";
import { HttpError } from "../shared/errors/http-error.js";

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({
      error: {
        message: error.message,
      },
    });
    return;
  }

  console.error(error);

  res.status(500).json({
    error: {
      message: "Internal server error",
    },
  });
};
