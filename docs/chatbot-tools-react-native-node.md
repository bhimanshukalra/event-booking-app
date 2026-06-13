# Chatbot Tool Integration for a Node.js + React Native App

This guide explains how to add a chatbot to a React Native app backed by a Node.js/TypeScript backend, while reusing your existing TypeScript functions for actions such as booking, cancelling, fetching availability, checking payment status, and similar app workflows.

## Recommendation

Use your Node.js backend as the AI orchestration layer.

Do **not** call the LLM directly from React Native. The mobile app should only send chat messages to your backend. The backend should handle:

- LLM API keys
- Authentication and user context
- Tool/function selection
- Calling your existing TypeScript services
- Permission checks
- Booking/payment validation
- Audit logs
- Streaming or non-streaming responses

Recommended architecture:

```txt
React Native App
   ↓
POST /chat or WebSocket /chat
   ↓
Node.js Backend Chatbot Service
   ↓
LLM with tool/function calling
   ↓
Your existing TypeScript services
   ↓
Database / payment gateway / booking system
```

## Should You Use MCP?

MCP can be useful, but I would not make it the first layer for your in-app chatbot.

Use normal LLM tool/function calling first because it maps directly to your existing backend functions. MCP is better when you want to expose your tools to multiple external AI clients or agents in a standardized way.

A good long-term design is:

```txt
Existing TypeScript services
   ↓
Reusable tool definitions
   ↓
1. In-app chatbot via direct LLM function calling
2. Optional MCP server later using the same tools
```

MCP servers expose capabilities like tools, resources, and prompts to AI clients. The official MCP TypeScript SDK supports building MCP servers and clients with transports such as stdio and Streamable HTTP.

References:

- OpenAI function calling/tools: https://platform.openai.com/docs/guides/function-calling
- OpenAI Responses API: https://platform.openai.com/docs/api-reference/responses
- MCP TypeScript SDK: https://ts.sdk.modelcontextprotocol.io/
- MCP tools specification: https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- MCP server guide: https://modelcontextprotocol.io/docs/develop/build-server

## Backend Folder Structure

Example structure:

```txt
src/
  services/
    booking.service.ts
    payment.service.ts
    user.service.ts

  ai/
    chatbot.service.ts
    tools/
      index.ts
      getAvailableSlots.tool.ts
      createBooking.tool.ts
      cancelBooking.tool.ts
      checkPaymentStatus.tool.ts

  routes/
    chat.routes.ts
```

The key idea is that your AI tools should be thin wrappers around your real backend services.

## Existing Backend Service Example

You may already have functions like this:

```ts
// src/services/booking.service.ts
export async function createBooking(params: {
  userId: string;
  serviceId: string;
  slotId: string;
}) {
  // Validate slot availability
  // Create booking in DB
  // Return booking details
}

export async function getAvailableSlots(params: {
  serviceId: string;
  date: string;
}) {
  // Fetch slots from DB
}
```

Do not rewrite these for AI. Wrap them.

## Tool Definition Pattern

Create a common tool type:

```ts
// src/ai/tools/types.ts
import { z } from "zod";

export type ToolContext = {
  userId: string;
  authToken?: string;
};

export type AiTool<TInput> = {
  name: string;
  description: string;
  schema: z.ZodType<TInput>;
  execute: (input: TInput, context: ToolContext) => Promise<unknown>;
};
```

Using `zod` is helpful because the LLM may return malformed or incomplete arguments. Always validate before calling your real service.

Install if needed:

```bash
npm install zod
```

## Example: Get Available Slots Tool

```ts
// src/ai/tools/getAvailableSlots.tool.ts
import { z } from "zod";
import { getAvailableSlots } from "../../services/booking.service";
import type { AiTool } from "./types";

const schema = z.object({
  serviceId: z.string(),
  date: z.string().describe("Date in YYYY-MM-DD format"),
});

type Input = z.infer<typeof schema>;

export const getAvailableSlotsTool: AiTool<Input> = {
  name: "get_available_slots",
  description: "Fetch available booking slots for a service on a given date.",
  schema,
  execute: async (input, context) => {
    return getAvailableSlots({
      serviceId: input.serviceId,
      date: input.date,
    });
  },
};
```

## Example: Create Booking Tool

```ts
// src/ai/tools/createBooking.tool.ts
import { z } from "zod";
import { createBooking } from "../../services/booking.service";
import type { AiTool } from "./types";

const schema = z.object({
  serviceId: z.string(),
  slotId: z.string(),
});

type Input = z.infer<typeof schema>;

export const createBookingTool: AiTool<Input> = {
  name: "create_booking",
  description: "Create a booking for the authenticated user.",
  schema,
  execute: async (input, context) => {
    // Important: userId comes from backend auth context, not from the model.
    return createBooking({
      userId: context.userId,
      serviceId: input.serviceId,
      slotId: input.slotId,
    });
  },
};
```

Important: never let the model decide `userId`. Always get it from your authenticated backend request.

## Tool Registry

```ts
// src/ai/tools/index.ts
import { createBookingTool } from "./createBooking.tool";
import { getAvailableSlotsTool } from "./getAvailableSlots.tool";

export const tools = [
  getAvailableSlotsTool,
  createBookingTool,
];

export const toolMap = new Map(
  tools.map((tool) => [tool.name, tool])
);
```

## Chat API Design

For the React Native app, the simplest API is:

```http
POST /chat
Authorization: Bearer <token>
Content-Type: application/json

{
  "conversationId": "optional-existing-conversation-id",
  "message": "Book a slot for tomorrow evening"
}
```

Response:

```json
{
  "conversationId": "conversation_123",
  "message": {
    "id": "msg_456",
    "role": "assistant",
    "content": "I found a few available slots for tomorrow evening. Would you like 5:00 PM or 6:30 PM?"
  }
}
```

This non-streaming flow is easier to build and debug.

## Should You Use Streaming?

You have two good options.

### Option 1: Non-streaming

Use this first.

Flow:

```txt
User sends message
   ↓
React Native shows user's bubble + loading indicator
   ↓
Backend calls LLM and tools
   ↓
Backend returns final assistant message
   ↓
React Native replaces loading state with assistant bubble
```

Pros:

- Easier to implement
- Easier to debug
- Easier to handle tool calls
- Good enough for booking/payment workflows

Cons:

- Assistant reply appears only after the full response is ready
- User may wait longer for complex tool calls

For your first production version, I would choose this.

### Option 2: Streaming

Use this once the base chatbot is working.

Flow:

```txt
User sends message
   ↓
Backend starts streaming tokens/events
   ↓
React Native app updates assistant bubble as text arrives
   ↓
If a tool is needed, backend may stream a status event like "Checking availability..."
   ↓
Backend runs tool
   ↓
Backend continues streaming final answer
```

Pros:

- Feels faster
- Better chatbot UX
- Lets you show intermediate statuses like:
  - "Checking available slots..."
  - "Creating your booking..."
  - "Waiting for payment confirmation..."

Cons:

- More complex state management
- More edge cases around retries and partial messages
- Slightly more complex backend implementation

## Streaming Transport Choices for React Native

For React Native, prefer one of these:

### 1. Server-Sent Events

Good for one-way assistant streaming from backend to app.

```txt
React Native → Backend: send message
Backend → React Native: stream assistant response events
```

You may need an EventSource polyfill depending on your React Native setup.

### 2. WebSocket

Best if you want a real-time chatbot feel.

```txt
React Native ↔ Backend over WebSocket
```

Use WebSocket if you want:

- Typing indicators
- Streaming assistant messages
- Tool status events
- Connection state
- Real-time payment/booking updates

For a booking/payment chatbot, WebSocket can be useful because payment status can change asynchronously.

### 3. Plain HTTP

Best for first version.

```txt
React Native → POST /chat
Backend → JSON response
```

This is the simplest and most reliable starting point.

## Recommended Rollout Plan

### Phase 1: Plain HTTP Chat

Start with:

```txt
React Native chat screen
   ↓
POST /chat
   ↓
Backend returns full assistant response
```

This is enough to validate:

- Prompt quality
- Tool definitions
- Booking flow
- Auth checks
- Error handling

### Phase 2: Add Tool Status Messages

Even without full streaming, you can return structured UI events:

```json
{
  "message": "I found 3 slots for tomorrow evening.",
  "events": [
    { "type": "tool_started", "label": "Checking availability" },
    { "type": "tool_completed", "label": "Availability checked" }
  ]
}
```

React Native can use these to show better UI states.

### Phase 3: Add Streaming

Once the flow is stable, add SSE or WebSocket.

### Phase 4: Optional MCP Server

Only add MCP if you want your backend tools to be consumed by external AI clients or internal agents.

## React Native Chat Screen Integration

The React Native app should not know about tools. It should only know about chat messages and optional UI events.

Example message type:

```ts
type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  status?: "sending" | "sent" | "failed";
};
```

Basic send flow:

```ts
async function sendMessage(text: string) {
  const userMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: text,
    createdAt: new Date().toISOString(),
    status: "sending",
  };

  setMessages((prev) => [...prev, userMessage]);
  setIsAssistantTyping(true);

  try {
    const response = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        conversationId,
        message: text,
      }),
    });

    const data = await response.json();

    setMessages((prev) => [
      ...prev.map((msg) =>
        msg.id === userMessage.id ? { ...msg, status: "sent" } : msg
      ),
      data.message,
    ]);

    setConversationId(data.conversationId);
  } catch (error) {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === userMessage.id ? { ...msg, status: "failed" } : msg
      )
    );
  } finally {
    setIsAssistantTyping(false);
  }
}
```

## Backend Chat Route Example

```ts
// src/routes/chat.routes.ts
import express from "express";
import { handleChatMessage } from "../ai/chatbot.service";
import { requireAuth } from "../middleware/requireAuth";

const router = express.Router();

router.post("/chat", requireAuth, async (req, res, next) => {
  try {
    const { message, conversationId } = req.body;

    const result = await handleChatMessage({
      userId: req.user.id,
      conversationId,
      message,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
```

## Chatbot Service Responsibilities

Your chatbot service should:

1. Load previous conversation messages.
2. Add the new user message.
3. Send messages and tool definitions to the LLM.
4. Detect tool calls.
5. Validate tool arguments using `zod`.
6. Execute the matching TypeScript function.
7. Send tool results back to the LLM if needed.
8. Save final assistant response.
9. Return the response to React Native.

Pseudo-code:

```ts
export async function handleChatMessage(params: {
  userId: string;
  conversationId?: string;
  message: string;
}) {
  const conversation = await loadOrCreateConversation(params.conversationId, params.userId);

  await saveMessage({
    conversationId: conversation.id,
    role: "user",
    content: params.message,
  });

  const messages = await getConversationMessages(conversation.id);

  const llmResponse = await callLlmWithTools({
    messages,
    tools,
  });

  // If LLM requests a tool call:
  for (const toolCall of llmResponse.toolCalls ?? []) {
    const tool = toolMap.get(toolCall.name);

    if (!tool) {
      throw new Error(`Unknown tool: ${toolCall.name}`);
    }

    const input = tool.schema.parse(toolCall.arguments);

    const result = await tool.execute(input, {
      userId: params.userId,
    });

    await saveToolResult({
      conversationId: conversation.id,
      toolName: tool.name,
      result,
    });
  }

  const finalMessage = await generateFinalAssistantMessage();

  await saveMessage({
    conversationId: conversation.id,
    role: "assistant",
    content: finalMessage.content,
  });

  return {
    conversationId: conversation.id,
    message: finalMessage,
  };
}
```

## Important Safety Rules for Booking and Payment Tools

For booking/payment workflows, add strong guardrails.

### 1. Never trust userId from the model

Bad:

```ts
createBooking({ userId: input.userId })
```

Good:

```ts
createBooking({ userId: context.userId })
```

### 2. Re-check availability before booking

Even if the model says a slot is available, your backend should verify it again before creating the booking.

### 3. Confirm high-impact actions

For actions like cancellation, refunds, or payment-related operations, use confirmation steps.

Example:

```txt
User: Cancel my booking.
Assistant: I found your booking for Friday at 5 PM. Should I cancel it?
User: Yes.
Assistant calls cancel_booking.
```

### 4. Avoid silent payments

The chatbot can start a payment flow or check payment status, but avoid silently charging/refunding without explicit confirmation.

### 5. Log all tool calls

Store:

- conversationId
- userId
- tool name
- arguments
- result status
- timestamp
- error, if any

## Example Chat UX

User:

```txt
Can you book a cleaning service for tomorrow evening?
```

Assistant:

```txt
Sure. I’ll check available evening slots for tomorrow.
```

Tool call:

```txt
get_available_slots({ serviceId, date })
```

Assistant:

```txt
I found slots at 5:00 PM, 6:30 PM, and 8:00 PM. Which one would you prefer?
```

User:

```txt
6:30 works.
```

Assistant:

```txt
Great. Should I reserve the 6:30 PM slot for you?
```

User:

```txt
Yes.
```

Tool call:

```txt
create_booking({ serviceId, slotId })
```

Assistant:

```txt
Your slot is reserved for 6:30 PM. Please complete the payment within 10 minutes to confirm the booking.
```

React Native can then show your countdown component.

## How the Chatbot Connects to Existing UI

The chatbot does not need to replace your app screens. It can trigger the same flows your app already supports.

For example, the backend response can include optional UI actions:

```json
{
  "message": {
    "role": "assistant",
    "content": "Your slot is reserved. Please complete payment within 10 minutes."
  },
  "uiActions": [
    {
      "type": "OPEN_PAYMENT_SCREEN",
      "payload": {
        "bookingId": "booking_123"
      }
    }
  ]
}
```

React Native can handle it like this:

```ts
for (const action of data.uiActions ?? []) {
  if (action.type === "OPEN_PAYMENT_SCREEN") {
    navigation.navigate("Payment", {
      bookingId: action.payload.bookingId,
    });
  }
}
```

This is better than making the chatbot responsible for rendering everything.

## Suggested Response Contract

Use a structured response from backend to app:

```ts
type ChatApiResponse = {
  conversationId: string;
  message: ChatMessage;
  uiActions?: Array<{
    type: string;
    payload?: Record<string, unknown>;
  }>;
};
```

This allows your chatbot to say something and optionally guide the app UI.

## Where MCP Fits Later

If you later add MCP, avoid duplicating logic.

Use the same service layer:

```txt
booking.service.ts
   ↑
   ├── LLM tool wrapper for in-app chatbot
   └── MCP tool wrapper for external agents
```

Example MCP use cases:

- Internal admin assistant
- Customer support assistant
- Integration with AI developer tools
- External agent access to booking/payment capabilities
- Shared tool protocol across multiple AI clients

Do not expose sensitive tools publicly without strong authentication and authorization.

## Final Recommendation

Start with this stack:

```txt
React Native chat screen
   ↓
Plain HTTP POST /chat
   ↓
Node.js chatbot service
   ↓
LLM tool/function calling
   ↓
Existing TypeScript services
```

Then add:

1. Tool status events
2. Streaming via SSE or WebSocket
3. MCP server only if you need external agent interoperability

This gives you the fastest path to a working chatbot while keeping your existing backend architecture clean and reusable.
