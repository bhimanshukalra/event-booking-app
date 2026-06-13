
# Gemini LLM Tools Flow for a Booking Agent

This document explains how to integrate Gemini function calling into a Node.js + React Native app where the backend already has TypeScript functions such as `createBooking()`, `searchSlots()`, or `getEventDetails()`.

The main idea:

```txt
React Native App
  → sends latest chat message to backend

Node.js Backend
  → stores message
  → loads recent conversation history
  → sends system instruction + history + tools to Gemini

Gemini
  → either replies normally
  → or requests a function/tool call

Node.js Backend
  → validates the requested function call
  → executes your existing TypeScript function
  → sends the function result back to Gemini

Gemini
  → generates final user-facing response

React Native App
  → displays assistant response
```

---

## 1. Important Mental Model

Gemini does **not** directly execute your backend functions.

Gemini only returns a structured request like:

```json
{
  "name": "create_booking",
  "args": {
    "slotId": "slot_123",
    "guestCount": 2
  }
}
```

Your backend then decides whether to actually execute:

```ts
await createBooking(...)
```

This is important because your backend remains the source of truth.

Gemini should never:

- directly access your database
- directly create bookings
- directly modify payments
- decide the authenticated user ID
- bypass backend validation

---

## 2. Example User Flow

Example conversation:

```txt
User:
I want to book a table for tomorrow evening.

Assistant:
Sure. How many guests?

User:
2 people.

Assistant:
I found these available slots:
- 6:00 PM
- 7:00 PM
- 8:00 PM

User:
7 PM works.

Assistant:
Please confirm: should I book the 7 PM slot for 2 people?

User:
Yes, book it.

Gemini requests:
create_booking({ slotId: "slot_123", guestCount: 2 })

Backend executes:
createBooking({ userId, slotId: "slot_123", guestCount: 2 })

Assistant:
Your booking has been confirmed for tomorrow at 7 PM.
```

---

## 3. Suggested Backend File Structure

```txt
src/
  services/
    booking.service.ts
    event.service.ts

  ai/
    gemini.client.ts
    chatbot.service.ts

    tools/
      create-booking.tool.ts
      search-slots.tool.ts
      get-event-details.tool.ts

  routes/
    chat.routes.ts
```

---

## 4. Existing Backend Function

You may already have something like this:

```ts
// src/services/booking.service.ts

type CreateBookingInput = {
  userId: string;
  slotId: string;
  guestCount: number;
  specialRequest?: string;
};

export async function createBooking(input: CreateBookingInput) {
  // 1. Validate slot exists
  // 2. Validate slot is still available
  // 3. Validate user can book
  // 4. Create booking in DB
  // 5. Return booking confirmation

  return {
    bookingId: "booking_123",
    status: "confirmed",
    slotId: input.slotId,
    guestCount: input.guestCount,
  };
}
```

This function should stay independent of Gemini.

The LLM layer should only wrap this function.

---

## 5. Create Booking Tool Definition

Gemini needs a function declaration so it knows:

- what the tool is called
- when to use it
- which arguments it requires
- what shape the arguments should have

```ts
// src/ai/tools/create-booking.tool.ts

import { createBooking } from "../../services/booking.service";

export const createBookingFunctionDeclaration = {
  name: "create_booking",
  description:
    "Create a booking only after the user has clearly confirmed a specific slot and guest count. Do not use this for searching availability or asking general questions.",
  parameters: {
    type: "object",
    properties: {
      slotId: {
        type: "string",
        description: "The ID of the selected available booking slot.",
      },
      guestCount: {
        type: "number",
        description: "The number of guests for the booking.",
      },
      specialRequest: {
        type: "string",
        description: "Optional special request from the user.",
      },
    },
    required: ["slotId", "guestCount"],
  },
};

type ExecuteCreateBookingParams = {
  userId: string;
  args: {
    slotId: string;
    guestCount: number;
    specialRequest?: string;
  };
};

export async function executeCreateBooking({
  userId,
  args,
}: ExecuteCreateBookingParams) {
  // Important:
  // userId must come from auth/session/JWT.
  // Never accept userId from Gemini arguments.

  if (!args.slotId) {
    throw new Error("slotId is required");
  }

  if (!args.guestCount || args.guestCount < 1) {
    throw new Error("guestCount must be greater than 0");
  }

  return createBooking({
    userId,
    slotId: args.slotId,
    guestCount: args.guestCount,
    specialRequest: args.specialRequest,
  });
}
```

---

## 6. Example Search Slots Tool

For realistic booking, `create_booking` is usually not enough.

You also need an information tool like `search_slots`.

```ts
// src/ai/tools/search-slots.tool.ts

export const searchSlotsFunctionDeclaration = {
  name: "search_slots",
  description:
    "Search available booking slots for a requested date, time, event, service, or guest count. Use this before creating a booking if the user has not selected a specific slot.",
  parameters: {
    type: "object",
    properties: {
      date: {
        type: "string",
        description: "Requested date in YYYY-MM-DD format.",
      },
      timePreference: {
        type: "string",
        description: "Optional time preference such as evening, morning, 7 PM.",
      },
      guestCount: {
        type: "number",
        description: "Number of guests.",
      },
    },
    required: ["date"],
  },
};

export async function executeSearchSlots(args: {
  date: string;
  timePreference?: string;
  guestCount?: number;
}) {
  // Replace this with your real DB/service call.
  return [
    {
      slotId: "slot_123",
      displayTime: "7:00 PM",
      date: args.date,
      available: true,
    },
    {
      slotId: "slot_456",
      displayTime: "8:00 PM",
      date: args.date,
      available: true,
    },
  ];
}
```

---

## 7. Gemini Client Setup

Install the Gemini SDK:

```bash
npm install @google/genai
```

Create a client:

```ts
// src/ai/gemini.client.ts

import { GoogleGenAI } from "@google/genai";

export const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});
```

---

## 8. System Instruction

The system instruction controls the assistant behavior.

```ts
// src/ai/system-instruction.ts

export const bookingAssistantSystemInstruction = `
You are a booking assistant inside a mobile app.

Your job:
- Help users understand event details.
- Help users find available booking slots.
- Help users create bookings only after clear confirmation.

Rules:
- Do not create a booking unless the user clearly confirms a specific slot.
- If the user is only asking about availability, use search_slots, not create_booking.
- If required information is missing, ask a follow-up question.
- Never invent slot IDs.
- Never invent prices, availability, event details, or payment status.
- Never ask the user for their userId.
- The backend will provide authenticated user context.
- For high-impact actions like booking creation, be conservative and ask for confirmation first.
`;
```

---

## 9. Chat Message Types

Your DB can store messages like this:

```ts
type ChatRole = "user" | "assistant" | "tool";

type ChatMessage = {
  id: string;
  conversationId: string;
  role: ChatRole;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
};
```

For MVP, the React Native app should send only the latest message:

```json
{
  "message": "Yes, book the 7 PM slot"
}
```

The backend should load the recent chat history from the DB.

---

## 10. Convert DB Messages to Gemini Contents

Gemini expects conversation content in a structured format.

Pseudo-code:

```ts
function toGeminiContents(messages: ChatMessage[]) {
  return messages.map((message) => {
    if (message.role === "user") {
      return {
        role: "user",
        parts: [{ text: message.content }],
      };
    }

    if (message.role === "assistant") {
      return {
        role: "model",
        parts: [{ text: message.content }],
      };
    }

    // Tool messages are usually handled through functionResponse parts.
    // For an MVP, you may store them for audit but not replay all old tool messages.
    return null;
  }).filter(Boolean);
}
```

---

## 11. Calling Gemini with Tools

This is the core call.

```ts
// src/ai/chatbot.service.ts

import { gemini } from "./gemini.client";
import { bookingAssistantSystemInstruction } from "./system-instruction";
import {
  createBookingFunctionDeclaration,
  executeCreateBooking,
} from "./tools/create-booking.tool";
import {
  searchSlotsFunctionDeclaration,
  executeSearchSlots,
} from "./tools/search-slots.tool";

type HandleChatMessageParams = {
  userId: string;
  conversationHistory: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  latestUserMessage: string;
};

export async function handleChatMessage({
  userId,
  conversationHistory,
  latestUserMessage,
}: HandleChatMessageParams) {
  const contents = [
    ...conversationHistory.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    })),
    {
      role: "user",
      parts: [{ text: latestUserMessage }],
    },
  ];

  const response = await gemini.models.generateContent({
    model: "gemini-2.5-flash",
    contents,
    config: {
      systemInstruction: bookingAssistantSystemInstruction,
      tools: [
        {
          functionDeclarations: [
            searchSlotsFunctionDeclaration,
            createBookingFunctionDeclaration,
          ],
        },
      ],
    },
  });

  const functionCalls = response.functionCalls ?? [];

  if (functionCalls.length === 0) {
    return {
      type: "assistant_message" as const,
      message: response.text ?? "",
    };
  }

  const functionCall = functionCalls[0];

  let functionResult: unknown;

  if (functionCall.name === "search_slots") {
    functionResult = await executeSearchSlots(functionCall.args as any);
  } else if (functionCall.name === "create_booking") {
    functionResult = await executeCreateBooking({
      userId,
      args: functionCall.args as any,
    });
  } else {
    throw new Error(`Unhandled function call: ${functionCall.name}`);
  }

  // Send the function result back to Gemini so it can produce
  // a final natural-language response for the user.
  const finalResponse = await gemini.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      ...contents,
      {
        role: "model",
        parts: [
          {
            functionCall: {
              name: functionCall.name,
              args: functionCall.args,
            },
          },
        ],
      },
      {
        role: "user",
        parts: [
          {
            functionResponse: {
              name: functionCall.name,
              response: {
                result: functionResult,
              },
            },
          },
        ],
      },
    ],
    config: {
      systemInstruction: bookingAssistantSystemInstruction,
      tools: [
        {
          functionDeclarations: [
            searchSlotsFunctionDeclaration,
            createBookingFunctionDeclaration,
          ],
        },
      ],
    },
  });

  return {
    type: "assistant_message" as const,
    message: finalResponse.text ?? "",
    toolCall: {
      name: functionCall.name,
      args: functionCall.args,
      result: functionResult,
    },
  };
}
```

---

## 12. Backend API Route

Example Express route:

```ts
// src/routes/chat.routes.ts

import express from "express";
import { handleChatMessage } from "../ai/chatbot.service";

const router = express.Router();

router.post("/chat/conversations/:conversationId/messages", async (req, res) => {
  const userId = req.user.id; // from auth middleware
  const { conversationId } = req.params;
  const { message } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({
      error: "message is required",
    });
  }

  // 1. Store user message
  await db.chatMessage.create({
    data: {
      conversationId,
      role: "user",
      content: message,
    },
  });

  // 2. Load recent history
  const recentMessages = await db.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  // 3. Call Gemini
  const aiResult = await handleChatMessage({
    userId,
    latestUserMessage: message,
    conversationHistory: recentMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
  });

  // 4. Store tool metadata if applicable
  if (aiResult.toolCall) {
    await db.chatMessage.create({
      data: {
        conversationId,
        role: "tool",
        content: JSON.stringify(aiResult.toolCall.result),
        metadata: {
          toolName: aiResult.toolCall.name,
          args: aiResult.toolCall.args,
        },
      },
    });
  }

  // 5. Store assistant response
  await db.chatMessage.create({
    data: {
      conversationId,
      role: "assistant",
      content: aiResult.message,
    },
  });

  // 6. Return assistant response to React Native
  return res.json({
    message: aiResult.message,
  });
});

export default router;
```

Important note: in a real implementation, avoid duplicating the latest user message in `recentMessages` and `latestUserMessage`. You can either:

1. Save the user message first and pass all recent messages to Gemini, or
2. Load history before saving, then append latest user message in memory.

Just do not include the same user message twice.

---

## 13. React Native Chat Screen Flow

React Native should not send the full chat history every time.

It should:

1. Fetch messages when the chat screen opens.
2. Send only the latest user message.
3. Show a loading bubble.
4. Append the assistant response.

Example:

```ts
async function sendChatMessage(message: string) {
  // Optimistically add user message to UI
  setMessages((prev) => [
    ...prev,
    {
      id: `local-${Date.now()}`,
      role: "user",
      content: message,
    },
  ]);

  setIsLoading(true);

  try {
    const response = await api.post(
      `/chat/conversations/${conversationId}/messages`,
      {
        message,
      }
    );

    setMessages((prev) => [
      ...prev,
      {
        id: response.data.messageId,
        role: "assistant",
        content: response.data.message,
      },
    ]);
  } finally {
    setIsLoading(false);
  }
}
```

On chat screen open:

```ts
async function loadMessages() {
  const response = await api.get(
    `/chat/conversations/${conversationId}/messages`
  );

  setMessages(response.data.messages);
}
```

---

## 14. Streaming vs Non-Streaming

For MVP, use non-streaming.

```txt
User sends message
→ Backend calls Gemini
→ Backend executes tools if needed
→ Backend returns final message
→ App displays final message
```

This is simpler because tool calls often require a full backend round-trip anyway.

Streaming can be added later for better UX:

```txt
User sends message
→ Assistant starts typing token-by-token
→ Backend pauses if tool call is needed
→ Backend executes tool
→ Assistant continues final response
```

Streaming adds complexity:

- partial message storage
- reconnect handling
- cancellation
- function call handling during stream
- avoiding duplicate messages

MVP recommendation:

```txt
DB-backed history ✅
Non-streaming responses ✅
Backend-owned tool execution ✅
React Native sends latest message only ✅
```

---

## 15. End-to-End Example

### Step 1: User opens chat

React Native calls:

```http
GET /chat/conversations/convo_123/messages
```

Backend returns:

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Show me slots for tomorrow evening."
    },
    {
      "role": "assistant",
      "content": "I found 6 PM and 7 PM available."
    }
  ]
}
```

### Step 2: User sends a message

User says:

```txt
Book the 7 PM one for 2 people.
```

React Native sends:

```http
POST /chat/conversations/convo_123/messages
```

Body:

```json
{
  "message": "Book the 7 PM one for 2 people."
}
```

### Step 3: Backend sends Gemini context

The backend sends Gemini:

```txt
System:
You are a booking assistant. Do not create booking unless the user confirms a specific slot.

History:
User: Show me slots for tomorrow evening.
Assistant: I found 6 PM and 7 PM available.

Latest:
User: Book the 7 PM one for 2 people.

Tools:
- search_slots
- create_booking
```

### Step 4: Gemini returns a function call

Conceptually:

```json
{
  "name": "create_booking",
  "args": {
    "slotId": "slot_123",
    "guestCount": 2
  }
}
```

### Step 5: Backend validates and executes

```ts
const result = await executeCreateBooking({
  userId: authenticatedUser.id,
  args: {
    slotId: "slot_123",
    guestCount: 2,
  },
});
```

### Step 6: Backend sends function result back to Gemini

```json
{
  "name": "create_booking",
  "response": {
    "result": {
      "bookingId": "booking_123",
      "status": "confirmed",
      "slotId": "slot_123",
      "guestCount": 2
    }
  }
}
```

### Step 7: Gemini returns final message

```txt
Your booking has been confirmed for tomorrow at 7 PM for 2 people.
```

### Step 8: Backend stores and returns response

Backend stores:

```txt
role: tool
content: booking result

role: assistant
content: Your booking has been confirmed...
```

React Native displays the assistant response.

---

## 16. Guardrails for Booking and Payment

Use these rules in both the system instruction and backend validation.

### Booking

- Do not create booking unless the user confirms the selected slot.
- Validate slot availability again before booking.
- Use authenticated user ID from backend.
- Log every booking tool call.
- Store tool arguments and result in DB metadata.

### Payment

For payment-related actions, be stricter.

The assistant can:

- explain payment status
- check payment status
- start a payment flow
- show payment instructions

The assistant should not silently:

- charge a user
- refund a payment
- modify payment method
- complete irreversible actions without confirmation

---

## 17. MVP Checklist

Backend:

- [ ] Create chat conversations table
- [ ] Create chat messages table
- [ ] Add Gemini client
- [ ] Add system instruction
- [ ] Add tool declarations
- [ ] Add tool execution switch
- [ ] Store user messages
- [ ] Load recent history
- [ ] Store assistant messages
- [ ] Store tool call metadata
- [ ] Add validation before executing tools

React Native:

- [ ] Chat screen
- [ ] Fetch conversation history on open
- [ ] Send latest message only
- [ ] Show loading bubble
- [ ] Append assistant response
- [ ] Handle errors gracefully

Later:

- [ ] Add streaming
- [ ] Add conversation summarization
- [ ] Add MCP server if external AI clients need access
- [ ] Add tool call approval UI for sensitive actions

---

## 18. Final Recommendation

For development, start with:

```txt
React Native chat screen
→ Node.js chat endpoint
→ Gemini function calling
→ Existing TypeScript service functions
```

Do not start with MCP unless you need to expose your tools to multiple external AI clients.

Design your code so that your tool wrappers are reusable later by both:

```txt
1. Gemini function calling
2. MCP server
```

That gives you a practical MVP now and flexibility later.
