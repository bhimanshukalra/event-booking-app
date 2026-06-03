import cors from "cors";
import express, { type Express } from "express";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { eventsRouter } from "./modules/events/events.routes.js";

export const app: Express = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
  });
});

app.use("/events", eventsRouter);

app.use(errorMiddleware);
