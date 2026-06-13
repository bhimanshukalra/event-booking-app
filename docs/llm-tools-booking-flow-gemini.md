
# LLM Tools Flow for Booking Agent (Using Gemini)

## High-level idea

Architecture:

React Native
→ Node.js Backend
→ Gemini API (system instruction + tools + conversation history)
→ Gemini decides whether to answer normally or request a tool
→ Backend executes the tool
→ Backend sends the tool result back to Gemini
→ Gemini generates the final natural-language response
→ React Native displays it

## What we send to Gemini

For every user message, the backend sends:

- A system instruction describing the assistant's role
- Recent conversation history
- The latest user message
- The list of available tools/functions

Example:

System Instruction:
"You are a booking assistant. Never create a booking until the user has clearly confirmed the slot."

Conversation:
User: Show me evening slots tomorrow.
Assistant: 6 PM and 7 PM are available.
User: 7 PM works.

Latest user message:
"Yes, please book it."

Available tools:
- search_slots
- get_event_details
- create_booking
- cancel_booking

## What Gemini does

Gemini has two options:

### 1. Respond directly

User:
"What time does the event start?"

Assistant:
"The event starts at 7 PM."

### 2. Request a tool call

Conceptually:

```json
{
  "name": "create_booking",
  "arguments": {
    "slotId": "slot_123",
    "guestCount": 2
  }
}
```

Gemini is NOT executing your function.

It is requesting that your backend execute it.

## What the backend does

The backend receives the requested tool call.

Pseudo-code:

```ts
if (toolName === "create_booking") {
  const result = await createBooking(...);

  // Send result back to Gemini
}
```

Gemini then generates the final response:

"Your booking has been confirmed for tomorrow at 7 PM."

## Important

The backend always remains the source of truth.

Gemini never:

- accesses your database directly
- creates bookings directly
- modifies payments directly

It only indicates which tool should be called and with what arguments.

Your backend validates everything before executing.

## Typical conversation

User:
Book a table for tomorrow.

↓

Gemini:
Needs more information.

↓

Assistant:
How many guests?

↓

User:
2 people.

↓

Gemini:
Needs slot information.

↓

Backend executes:
search_slots()

↓

Gemini:
I found 6 PM and 7 PM.

↓

User:
7 PM.

↓

Gemini:
Requests create_booking()

↓

Backend:
createBooking()

↓

Gemini:
Your reservation has been confirmed.

## Conclusion

Gemini acts as an intelligent orchestrator.

Your existing TypeScript functions remain the real implementation and are executed only by your backend after validation.

The frontend simply sends chat messages to your backend. The backend manages conversation history, calls Gemini, executes requested tools, and returns the assistant's response.
