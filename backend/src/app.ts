import cors from "cors";
import express, { type Express, type RequestHandler } from "express";
import { demoAuthMiddleware } from "./middleware/auth.middleware";
import { errorMiddleware } from "./middleware/error.middleware";
import { authRouter } from "./modules/auth/auth.routes";
import { eventsRouter } from "./modules/events/events.routes";
import { reservationsRouter } from "./modules/reservations/reservations.routes";

export const app: Express = express();

const healthCheckHandler: RequestHandler = (_req, res) => {
  res.json({
    status: "ok",
  });
};

app.use(cors());
app.use(express.json());
app.use(demoAuthMiddleware);

app.get("/health", healthCheckHandler);

app.use("/auth", authRouter);
app.use("/events", eventsRouter);
app.use("/reservations", reservationsRouter);

app.use(errorMiddleware);
