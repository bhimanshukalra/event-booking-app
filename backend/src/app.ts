import cors from "cors";
import express, { type Express } from "express";
import { demoAuthMiddleware } from "./middleware/auth.middleware.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { eventsRouter } from "./modules/events/events.routes.js";

export const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(demoAuthMiddleware);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
  });
});

app.use("/auth", authRouter);
app.use("/events", eventsRouter);

app.use(errorMiddleware);
