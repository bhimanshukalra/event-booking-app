import { z } from "zod";

export const createReservationSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(128).optional(),
  items: z
    .array(
      z.object({
        ticketTypeId: z.string().trim().min(1),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
