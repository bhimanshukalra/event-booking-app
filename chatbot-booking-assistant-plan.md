# Chatbot Booking Assistant Plan

This document captures the direction for adding a chatbot-style booking assistant to the Event Booking Platform.

The assistant should help customers discover events, ask natural-language questions, reserve tickets or seats, and continue into payment while keeping all booking, inventory, reservation, and payment rules enforced by the backend.

## Product Goal

Build a conversational event assistant that can answer questions like:

- "When is the jazz night?"
- "What events are happening at Riverfront Arena?"
- "Are VIP tickets available?"
- "Book 2 tickets for the Saturday concert."
- "Where is the venue?"
- "Continue to payment."

The assistant should feel useful, but it should not bypass the normal booking system. It should guide the user through the same safe flow that the app already supports.

## Core Principle

The chatbot is an interface layer, not the source of truth.

The backend must continue to own:

- Event search
- Event detail lookup
- Availability calculation
- Reservation creation
- Seat or ticket locking
- Reservation expiry
- Payment confirmation
- Booking creation
- Double-booking prevention

The AI assistant can interpret intent and decide which backend action to call, but final decisions must come from the application services and database.

## Recommended Architecture

```text
Customer message
  -> Chat UI
  -> POST /chat
  -> AI model with tool/function calling
  -> Backend executes allowed tools
  -> Tool results returned to model
  -> Assistant responds with answer or next step
```

The assistant should only access application data through safe backend functions. It should not query the database directly from model output or execute arbitrary commands.

## Suggested Chat Tools

These are the backend actions the assistant should be allowed to call.

### Event Discovery

```text
searchEvents(query, filters)
```

Purpose:

- Search by event name, venue, city, category, or date.
- Return only published upcoming events.

Example inputs:

```json
{
  "query": "jazz night",
  "venueName": null,
  "city": null,
  "date": null
}
```

### Event Details

```text
getEventDetails(eventId)
```

Purpose:

- Return date, time, venue, description, ticket types, prices, and high-level availability.

## Specific Event Lookup Flow

When a user asks about a specific event, the assistant should not answer from memory. It should resolve the user's wording into an event record, then fetch the details from the backend.

Example user messages:

- "When is Skyline Jazz Night?"
- "Tell me about the food festival."
- "Is there anything at Riverfront Arena this weekend?"
- "How many VIP tickets are left for the Saturday concert?"
- "Where is Neon Nights happening?"

Recommended flow:

```text
User asks about an event
  -> Assistant extracts possible event name, venue, city, date, or category
  -> Assistant calls searchEvents
  -> Backend returns matching published upcoming events
  -> Assistant decides whether the match is exact, ambiguous, or missing
  -> If exact: assistant calls getEventDetails
  -> If ambiguous: assistant asks the user to choose from matching events
  -> If missing: assistant says it could not find a matching upcoming event
```

### What the Assistant Extracts

The assistant should identify structured search hints from the message:

- `eventName`: possible event title, such as "Skyline Jazz Night"
- `venueName`: possible venue, such as "Riverfront Arena"
- `city`: possible city filter
- `date`: exact date, weekend, tomorrow, or month
- `category`: music, comedy, sports, food, conference, and similar
- `ticketType`: general, VIP, balcony, early bird, and similar
- `quantity`: number of tickets requested

Example:

```text
User:
Are VIP tickets available for the jazz night at Skyline Hall this Saturday?
```

Extracted intent:

```json
{
  "intent": "check_event_ticket_availability",
  "eventName": "jazz night",
  "venueName": "Skyline Hall",
  "date": "this Saturday",
  "ticketType": "VIP",
  "quantity": null
}
```

The assistant then calls `searchEvents` using these values. The backend should normalize date filters and search only published upcoming events.

### Search Behavior

The backend should support practical matching, starting simple and improving later.

MVP matching:

- Case-insensitive partial match on event title.
- Case-insensitive partial match on venue name.
- Optional exact date or date range filter.
- Optional city/category filter.
- Return a small ranked list, such as the top 5 matches.

Later improvements:

- Fuzzy matching for typos.
- Synonyms for categories.
- Natural date parsing for phrases like "this weekend".
- Search ranking based on title match, venue match, date proximity, and availability.

Example backend behavior:

```text
User phrase: "jazz night skyline"

searchEvents returns:
1. Skyline Jazz Night, Skyline Hall, July 12
2. Late Night Jazz Sessions, Riverfront Arena, July 18
```

If the top match is strong enough, the assistant can fetch details for it. If multiple matches are plausible, it should ask the user to choose.

### Exact Match

If the backend returns one strong match, the assistant should call `getEventDetails(eventId)`.

The detail response should include:

- Event ID
- Title
- Description
- Category
- Start and end time
- Venue name
- Venue address and city
- Ticket types
- Prices
- Currency
- Capacity summary
- Availability summary

Assistant response example:

```text
Skyline Jazz Night is on July 12 at Skyline Hall. General tickets are $35 and VIP tickets are $60. VIP tickets are still available.
```

### Ambiguous Match

If the search returns multiple likely matches, the assistant should ask a clarifying question instead of guessing.

Example:

```text
I found a few events that could match:

1. Skyline Jazz Night at Skyline Hall on July 12
2. Late Night Jazz Sessions at Riverfront Arena on July 18

Which one did you mean?
```

The UI can render these as selectable event options instead of plain text.

### Missing Match

If no matching published upcoming event is found, the assistant should say that clearly and offer nearby alternatives.

Example:

```text
I could not find an upcoming event called "Neon Nights." I found these upcoming music events instead:

1. Skyline Jazz Night
2. Riverfront Summer Beats
```

This keeps the assistant useful while avoiding invented event details.

### Availability Questions

For questions about seats or ticket counts, event lookup is only the first step.

Recommended flow:

```text
Resolve event
  -> Fetch event details
  -> Match requested ticket type if provided
  -> Call checkAvailability
  -> Answer using backend availability result
```

The assistant should never infer availability from capacity alone. Availability must come from backend logic that subtracts active reservations and confirmed bookings.

Example:

```text
User:
Are 3 VIP tickets available for Skyline Jazz Night?

Assistant tool calls:
1. searchEvents({ query: "Skyline Jazz Night" })
2. getEventDetails(eventId)
3. checkAvailability(eventId, vipTicketTypeId)

Assistant response:
Yes, 3 VIP tickets are available. Would you like me to reserve them?
```

### Booking Questions

If the user asks to book a specific event directly, the assistant still needs to resolve and confirm before reserving.

Example:

```text
User:
Book 2 VIP tickets for Skyline Jazz Night.

Assistant flow:
1. Resolve event by name.
2. Fetch event details.
3. Match VIP ticket type.
4. Check availability for quantity 2.
5. Ask the user to confirm reservation.
6. Create reservation only after confirmation.
```

The assistant should not create a reservation from the first message unless the product explicitly allows one-shot booking. For this platform, confirmation is safer and clearer.

## Chat Request Orchestration

Yes: when the user sends a message, the app should call a backend chat endpoint, such as `POST /chat`.

From there, the backend should make an LLM call. However, the LLM should not directly decide SQL queries or produce raw database operations. A safer and cleaner approach is to let the LLM choose from a fixed set of application tools.

Recommended flow:

```text
User sends message
  -> App calls POST /chat
  -> Backend sends message plus allowed tools to LLM
  -> LLM returns either:
       1. A normal assistant response
       2. A structured tool call
  -> Backend validates the tool call arguments
  -> Backend runs normal service/database logic
  -> Backend sends tool result back to LLM
  -> LLM writes a user-friendly response
  -> Backend returns response to app
```

This gives the AI room to understand natural language while keeping the business logic deterministic.

### Why Not Let AI Generate SQL?

The assistant should not generate SQL directly.

Reasons:

- It can accidentally query private or unrelated data.
- It can produce invalid SQL.
- It can bypass authorization rules.
- It can bypass booking and reservation safety checks.
- It makes the app harder to test.

Instead, expose narrow backend functions such as:

```text
searchEvents
getEventDetails
checkAvailability
createReservation
startPayment
```

Each tool maps to trusted application code, and that code can use Prisma/PostgreSQL safely.

### Tool Calling Instead of Free-Form JSON

There are two possible designs.

Option 1: Ask the LLM to return JSON.

```json
{
  "intent": "search_event",
  "eventName": "Skyline Jazz Night",
  "venueName": null,
  "date": null
}
```

This can work for a prototype, but it puts more parsing and routing responsibility on your backend.

Option 2: Give the LLM formal tools/functions.

```text
Tool: searchEvents
Arguments:
{
  "query": "Skyline Jazz Night",
  "venueName": null,
  "date": null
}
```

This is the recommended approach. The model does not just return arbitrary JSON; it selects one of the allowed tools and provides structured arguments that match a schema.

### Example: User Asks Event Date

User message:

```text
When is Skyline Jazz Night?
```

Backend sends the message to the LLM with available tools:

```text
searchEvents
getEventDetails
checkAvailability
createReservation
startPayment
```

The LLM chooses:

```json
{
  "tool": "searchEvents",
  "arguments": {
    "query": "Skyline Jazz Night",
    "venueName": null,
    "city": null,
    "date": null
  }
}
```

The backend validates the arguments, then calls the normal event service:

```text
eventsService.searchEvents({
  query: "Skyline Jazz Night"
})
```

If one event is found, the backend can either return enough data from search or allow the model to call:

```json
{
  "tool": "getEventDetails",
  "arguments": {
    "eventId": "evt_123"
  }
}
```

The backend fetches the event details from the database and returns the result to the LLM. The LLM then responds:

```text
Skyline Jazz Night is on July 12 at 7:30 PM at Skyline Hall.
```

### Example: User Asks Availability

User message:

```text
Are 2 VIP tickets available for Skyline Jazz Night?
```

Tool flow:

```text
1. searchEvents(query: "Skyline Jazz Night")
2. getEventDetails(eventId)
3. Match "VIP" to a ticket type from event details
4. checkAvailability(eventId, ticketTypeId)
5. Respond with availability
```

The assistant should not answer availability from the event details alone. It should call availability logic that excludes active reservations and confirmed bookings.

### Example: User Wants To Book

User message:

```text
Book 2 VIP tickets for Skyline Jazz Night.
```

Tool flow:

```text
1. searchEvents
2. getEventDetails
3. checkAvailability
4. Ask user to confirm
5. createReservation
6. startPayment
```

The important product rule is that `createReservation` should happen only after a clear confirmation step.

Example assistant response before reservation:

```text
I found 2 VIP tickets for Skyline Jazz Night. The total is $120. Should I reserve them for you?
```

Only after the user says yes should the backend allow the assistant to call `createReservation`.

### Backend Responsibilities

The `/chat` endpoint should be responsible for:

- Passing the user message and conversation context to the LLM.
- Defining which tools the LLM can call.
- Validating every tool argument with Zod.
- Calling existing backend services.
- Enforcing auth and user permissions.
- Preventing unsafe tool calls.
- Returning assistant text plus optional UI actions.

The service layer should be responsible for:

- Searching events.
- Fetching event details.
- Calculating availability.
- Creating reservations.
- Starting payment.
- Confirming payment.

The database layer should be responsible for:

- Persisting events, venues, ticket types, reservations, bookings, and payments.
- Enforcing constraints.
- Supporting transactions and row-level locking where needed.

### Suggested Internal Shape

The endpoint can be structured like this:

```text
POST /chat
  -> chatController
  -> chatService.handleMessage
  -> llmClient.createResponse
  -> toolRouter.executeTool
  -> eventsService / reservationsService / paymentsService
  -> llmClient.createFinalResponse
  -> response to client
```

The key idea is that `toolRouter` should be a whitelist. If the model asks for a tool that does not exist, the backend rejects it.

### Conversation State

The chat endpoint should carry lightweight context between messages.

Useful context:

- Current user ID
- Current event ID, if the user is already viewing an event
- Current reservation ID, if a reservation exists
- Last matched event candidates
- Last selected ticket type
- Pending confirmation action

Example:

```json
{
  "conversationId": "conv_123",
  "currentEventId": "evt_123",
  "pendingAction": {
    "type": "create_reservation",
    "eventId": "evt_123",
    "ticketTypeId": "ticket_vip",
    "quantity": 2
  }
}
```

This is how the assistant can understand a follow-up like:

```text
Yes, reserve those.
```

The backend should verify that the pending action still makes sense before executing it.

## Canonical Chat Loop

This is the core flow for every message sent to the assistant.

```text
1. User sends a message.
2. Client calls POST /chat.
3. Backend sends the message, conversation context, and allowed tools to the LLM.
4. LLM decides whether it can answer directly or needs a tool.
5. If no tool is needed, LLM returns a normal assistant message.
6. If a tool is needed, LLM returns a structured tool call.
7. Backend validates the tool name and arguments.
8. Backend executes the tool using normal application services.
9. Backend sends the tool result back to the LLM.
10. LLM decides whether more tools are needed.
11. Once enough data is available, LLM returns the final user-facing answer.
12. Backend returns the answer and optional UI actions to the client.
```

## Direct Response Case

If the user sends:

```text
Hi
```

The LLM does not need event data, availability data, or payment data.

It can respond directly:

```text
Hi! I can help you find events, check ticket availability, or start a booking.
```

No backend event/reservation/payment service needs to run.

## Tool Required Case

If the user sends:

```text
Do we have VIP seats available for Skyline Jazz Night?
```

The LLM should not answer from memory. It should request backend data by calling tools.

Possible tool sequence:

```text
1. searchEvents
2. getEventDetails
3. checkAvailability
4. final assistant response
```

The backend executes each tool and returns structured results. The LLM uses those results to decide the next step or produce the final answer.

## Important Refinements

The described flow is correct, with a few important refinements:

- The AI should not be trusted to perform backend actions directly.
- The AI should not generate SQL.
- The backend should validate every tool call before running it.
- The backend should decide whether a tool is allowed in the current user/session context.
- Some user messages may require multiple tool calls before the final answer.
- Some tool results may require a clarification question instead of another database call.
- Reservation and payment actions should require explicit user confirmation.

## Proof-Style Walkthrough

Claim:

The assistant can safely convert a natural-language user message into accurate event availability details without letting the AI become the source of truth.

Example message:

```text
Do we have VIP seats available for Skyline Jazz Night?
```

Step 1: The client sends the message to the backend.

```http
POST /chat
```

```json
{
  "message": "Do we have VIP seats available for Skyline Jazz Night?",
  "conversationId": "conv_123"
}
```

Step 2: The backend sends the message to the LLM with only approved tools.

```text
Allowed tools:
- searchEvents
- getEventDetails
- checkAvailability
- createReservation
- startPayment
```

Step 3: The LLM identifies the required first action.

It cannot check availability until it knows the exact event ID, so it calls:

```json
{
  "tool": "searchEvents",
  "arguments": {
    "query": "Skyline Jazz Night",
    "eventName": "Skyline Jazz Night",
    "venueName": null,
    "city": null,
    "date": null
  }
}
```

Step 4: The backend validates and executes the tool.

```text
toolRouter
  -> verify tool is allowed
  -> validate arguments with Zod
  -> call eventsService.searchEvents
  -> query PostgreSQL through Prisma
```

Step 5: The backend returns event candidates.

```json
{
  "matches": [
    {
      "id": "evt_123",
      "title": "Skyline Jazz Night",
      "startsAt": "2026-07-12T19:30:00.000Z",
      "venueName": "Skyline Hall"
    }
  ]
}
```

Step 6: The LLM now knows the exact event and asks for details.

```json
{
  "tool": "getEventDetails",
  "arguments": {
    "eventId": "evt_123"
  }
}
```

Step 7: The backend fetches safe event details.

```json
{
  "event": {
    "id": "evt_123",
    "title": "Skyline Jazz Night",
    "ticketTypes": [
      {
        "id": "tt_general",
        "name": "General",
        "priceCents": 3500
      },
      {
        "id": "tt_vip",
        "name": "VIP",
        "priceCents": 6000
      }
    ]
  }
}
```

Step 8: The LLM maps "VIP seats" to the `tt_vip` ticket type and calls availability.

```json
{
  "tool": "checkAvailability",
  "arguments": {
    "eventId": "evt_123",
    "ticketTypeId": "tt_vip"
  }
}
```

Step 9: The backend calculates availability from trusted state.

```text
availableQuantity
  = ticketType.capacity
  - confirmedBookingQuantity
  - activeUnexpiredReservationQuantity
```

Step 10: The backend returns the result.

```json
{
  "eventId": "evt_123",
  "ticketTypeId": "tt_vip",
  "ticketTypeName": "VIP",
  "availableQuantity": 8,
  "priceCents": 6000,
  "currency": "USD"
}
```

Step 11: The LLM now has enough data and returns the final answer.

```text
Yes, VIP seats are available for Skyline Jazz Night. There are 8 VIP tickets left at $60 each. Would you like me to reserve some?
```

Step 12: The backend returns that message to the client.

```json
{
  "conversationId": "conv_123",
  "message": "Yes, VIP seats are available for Skyline Jazz Night. There are 8 VIP tickets left at $60 each. Would you like me to reserve some?",
  "suggestedActions": [
    {
      "type": "reserve_ticket",
      "eventId": "evt_123",
      "ticketTypeId": "tt_vip"
    }
  ]
}
```

Conclusion:

The AI handled intent detection, tool selection, ticket-type interpretation, and natural-language response. The backend handled tool validation, event lookup, event details, live availability calculation, and trusted state. Therefore, the final answer is conversational but grounded in backend data.

## Deep Dive: "Do We Have Seats Available?"

This section explains how a message like this should move through the system:

```text
Tell me if we have seats available for Skyline Jazz Night.
```

The key split is:

- AI handles language understanding, intent, clarification, and final wording.
- Backend handles data lookup, authorization, availability calculation, validation, and reservation/payment rules.

The AI should never be the source of truth for whether seats are available.

## End-to-End Flow

```text
1. User sends message from the app
2. App calls POST /chat
3. Backend sends message and tool definitions to the LLM
4. LLM identifies the intent as an availability question
5. LLM calls searchEvents with extracted event hints
6. Backend searches published upcoming events
7. LLM resolves exact event or asks user to choose
8. LLM calls getEventDetails if needed
9. LLM identifies requested ticket type or asks user to choose
10. LLM calls checkAvailability
11. Backend calculates availability from database state
12. LLM turns the result into a clear user-facing response
13. Backend returns assistant message and optional UI actions
```

## What The AI Handles

The AI is responsible for understanding the user's natural language.

For this message:

```text
Tell me if we have seats available for Skyline Jazz Night.
```

The AI should infer:

```json
{
  "intent": "check_availability",
  "eventName": "Skyline Jazz Night",
  "venueName": null,
  "date": null,
  "ticketType": null,
  "quantity": null
}
```

The AI handles:

- Detecting that this is an availability question.
- Extracting the likely event name.
- Noticing that no ticket type was specified.
- Deciding which approved tool to call first.
- Asking a clarifying question if multiple events match.
- Asking a clarifying question if multiple ticket types exist and no ticket type was specified.
- Summarizing backend results in conversational language.

The AI does not handle:

- Writing SQL.
- Deciding final availability from memory.
- Trusting old conversation state without backend validation.
- Creating a reservation unless the backend says the action is allowed.
- Skipping auth, inventory, or payment rules.

## What The Backend Handles

The backend is responsible for every trusted operation.

The backend handles:

- Receiving `POST /chat`.
- Sending the user message to the LLM with a whitelist of tools.
- Validating every tool call argument with Zod.
- Executing allowed tools only.
- Searching events using Prisma/PostgreSQL.
- Fetching event details from the database.
- Matching ticket type IDs safely.
- Calculating availability using current reservation and booking state.
- Enforcing published/upcoming event visibility.
- Enforcing user permissions.
- Returning structured results to the LLM.
- Returning final assistant text and UI actions to the client.

The backend does not treat model output as truth. It treats model output as a request to call a known function.

## Step 1: User Message Reaches `/chat`

Request:

```http
POST /chat
Content-Type: application/json
```

```json
{
  "conversationId": "conv_123",
  "message": "Tell me if we have seats available for Skyline Jazz Night.",
  "context": {
    "currentEventId": null,
    "currentReservationId": null
  }
}
```

The backend loads any existing conversation context, such as previous event candidates or a selected event. If there is no useful context, the message starts from event search.

## Step 2: Backend Calls The LLM With Tools

The backend sends the user message plus tool definitions.

Conceptually:

```text
System instruction:
You are an event booking assistant. Use tools for event data and availability. Never invent event details or availability.

User message:
Tell me if we have seats available for Skyline Jazz Night.

Available tools:
- searchEvents
- getEventDetails
- checkAvailability
- createReservation
- startPayment
```

The tool schemas define what arguments are allowed.

Example `searchEvents` schema:

```json
{
  "name": "searchEvents",
  "description": "Search published upcoming events by title, venue, city, category, or date.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": { "type": ["string", "null"] },
      "eventName": { "type": ["string", "null"] },
      "venueName": { "type": ["string", "null"] },
      "city": { "type": ["string", "null"] },
      "date": { "type": ["string", "null"] }
    },
    "required": ["query", "eventName", "venueName", "city", "date"],
    "additionalProperties": false
  }
}
```

## Step 3: AI Chooses `searchEvents`

The AI does not answer yet. It asks the backend to search.

Tool call:

```json
{
  "tool": "searchEvents",
  "arguments": {
    "query": "Skyline Jazz Night",
    "eventName": "Skyline Jazz Night",
    "venueName": null,
    "city": null,
    "date": null
  }
}
```

Backend validation:

```text
chatService receives tool call
  -> toolRouter checks that searchEvents is allowed
  -> Zod validates arguments
  -> eventsService.searchEvents is called
```

The backend might run a Prisma query against events and venues.

Conceptual service call:

```text
eventsService.searchEvents({
  query: "Skyline Jazz Night",
  eventName: "Skyline Jazz Night",
  venueName: null,
  city: null,
  date: null
})
```

The service should search only events that are visible to customers:

```text
status = published
startsAt >= now
title or venue match user query
```

## Step 4: Backend Returns Event Candidates

Tool result:

```json
{
  "matches": [
    {
      "id": "evt_123",
      "title": "Skyline Jazz Night",
      "startsAt": "2026-07-12T19:30:00.000Z",
      "venueName": "Skyline Hall",
      "city": "San Francisco",
      "matchConfidence": "high"
    }
  ]
}
```

If there is one strong match, the AI can continue.

If there are multiple matches:

```json
{
  "matches": [
    {
      "id": "evt_123",
      "title": "Skyline Jazz Night",
      "startsAt": "2026-07-12T19:30:00.000Z",
      "venueName": "Skyline Hall"
    },
    {
      "id": "evt_456",
      "title": "Skyline Jazz Night - Late Show",
      "startsAt": "2026-07-12T22:00:00.000Z",
      "venueName": "Skyline Hall"
    }
  ]
}
```

The AI should ask:

```text
I found two Skyline Jazz Night events: the 7:30 PM show and the 10:00 PM late show. Which one should I check?
```

## Step 5: AI Calls `getEventDetails`

Once the event is resolved, the AI can fetch event details.

Tool call:

```json
{
  "tool": "getEventDetails",
  "arguments": {
    "eventId": "evt_123"
  }
}
```

Backend responsibilities:

- Validate `eventId`.
- Confirm the event is published/upcoming.
- Fetch venue and ticket types.
- Return only safe customer-facing fields.

Tool result:

```json
{
  "event": {
    "id": "evt_123",
    "title": "Skyline Jazz Night",
    "startsAt": "2026-07-12T19:30:00.000Z",
    "venue": {
      "name": "Skyline Hall",
      "city": "San Francisco",
      "address": "100 Market Street"
    },
    "ticketTypes": [
      {
        "id": "tt_general",
        "name": "General",
        "priceCents": 3500,
        "currency": "USD"
      },
      {
        "id": "tt_vip",
        "name": "VIP",
        "priceCents": 6000,
        "currency": "USD"
      }
    ]
  }
}
```

## Step 6: AI Resolves Ticket Type

The original user said "seats available" but did not specify General or VIP.

There are two good options:

1. Check availability for all ticket types and summarize.
2. Ask the user which ticket type they care about.

For a helpful assistant, option 1 is usually better for a general availability question.

The AI can call `checkAvailability` once per ticket type, or the backend can expose a broader tool:

```text
checkEventAvailability(eventId)
```

Recommended MVP:

Add `checkEventAvailability(eventId)` for general questions, and keep `checkAvailability(eventId, ticketTypeId)` for specific ticket-type questions.

## Step 7: Backend Calculates Availability

Tool call:

```json
{
  "tool": "checkEventAvailability",
  "arguments": {
    "eventId": "evt_123"
  }
}
```

Backend service logic:

```text
For each ticket type:
  total capacity
  - confirmed booking quantity
  - active unexpired reservation quantity
  = available quantity
```

Important:

- Expired reservations should not reduce availability.
- Confirmed bookings should always reduce availability.
- Pending payments should reduce availability if the reservation is still active.
- The calculation should happen in backend code using current database state.

Conceptual query behavior:

```text
ticketTypes = find ticket types for event
confirmedBookings = sum confirmed booking items by ticket type
activeReservations = sum reservation items where status is active and expiresAt > now
availability = capacity - confirmedBookings - activeReservations
```

Tool result:

```json
{
  "eventId": "evt_123",
  "availability": [
    {
      "ticketTypeId": "tt_general",
      "ticketTypeName": "General",
      "availableQuantity": 42,
      "priceCents": 3500,
      "currency": "USD"
    },
    {
      "ticketTypeId": "tt_vip",
      "ticketTypeName": "VIP",
      "availableQuantity": 8,
      "priceCents": 6000,
      "currency": "USD"
    }
  ]
}
```

## Step 8: AI Responds To User

Now the AI can produce a friendly response based only on tool results:

```text
Yes, seats are available for Skyline Jazz Night. There are 42 General tickets and 8 VIP tickets left. Would you like me to reserve any?
```

The backend response to the client can include both text and structured UI actions:

```json
{
  "conversationId": "conv_123",
  "message": "Yes, seats are available for Skyline Jazz Night. There are 42 General tickets and 8 VIP tickets left. Would you like me to reserve any?",
  "suggestedActions": [
    {
      "type": "select_ticket_type",
      "eventId": "evt_123",
      "options": [
        {
          "ticketTypeId": "tt_general",
          "label": "General",
          "availableQuantity": 42
        },
        {
          "ticketTypeId": "tt_vip",
          "label": "VIP",
          "availableQuantity": 8
        }
      ]
    }
  ]
}
```

## Follow-Up: "Reserve 2 VIP"

If the user then says:

```text
Reserve 2 VIP.
```

The assistant can use conversation state:

```json
{
  "currentEventId": "evt_123",
  "lastAvailability": [
    {
      "ticketTypeId": "tt_vip",
      "ticketTypeName": "VIP",
      "availableQuantity": 8
    }
  ]
}
```

Recommended flow:

```text
1. AI understands this is a reservation request.
2. Backend re-checks availability for VIP.
3. AI asks for confirmation with amount due.
4. User confirms.
5. Backend creates reservation inside transaction.
```

The re-check matters because availability may have changed since the previous message.

## Responsibility Split Summary

AI responsibilities:

- Understand user intent.
- Extract event/ticket/date hints.
- Choose the right approved tool.
- Ask clarifying questions.
- Remember conversational context.
- Convert structured tool results into natural language.

Backend responsibilities:

- Authenticate the user.
- Authorize access to customer-visible data.
- Validate all tool arguments.
- Search events.
- Fetch exact event details.
- Calculate live availability.
- Re-check availability before reservation.
- Create reservations transactionally.
- Prevent double booking.
- Handle payment state.
- Return structured UI actions.

Database responsibilities:

- Store events, venues, ticket types, reservations, bookings, and payments.
- Enforce constraints.
- Support accurate availability queries.
- Support transactions for reservation and payment confirmation.

This separation keeps the assistant flexible while keeping the booking system reliable.

### Availability

```text
checkAvailability(eventId, ticketTypeId)
```

Purpose:

- Return available quantity after excluding active reservations and confirmed bookings.
- This should reuse the same logic used by the reservation flow.

### Reservation

```text
createReservation(eventId, items)
```

Purpose:

- Temporarily lock ticket inventory or seats.
- Return reservation ID, expiry time, selected items, and amount due.

Important behavior:

- Must run inside the backend's concurrency-safe reservation logic.
- Must reject unavailable inventory.
- Must return a clear conflict response if inventory changed.

### Payment Handoff

```text
startPayment(reservationId)
```

Purpose:

- Create or return the payment step for a reservation.
- For MVP, this can point to the mock payment screen.
- Later, this can create a Stripe or Razorpay checkout session.

### Reservation Status

```text
getReservationStatus(reservationId)
```

Purpose:

- Tell the assistant whether the reservation is active, expired, paid, cancelled, or confirmed.

## Example Conversation Flow

```text
User:
Book me 2 tickets for the jazz night at Skyline Hall.

Assistant:
I found "Skyline Jazz Night" at Skyline Hall on July 12. There are General and VIP tickets available. Which ticket type would you like?

User:
VIP.

Assistant:
2 VIP tickets are available. The total is $120. Should I reserve them for you?

User:
Yes.

Assistant:
Your tickets are reserved for 8 minutes. Continue to payment?
```

Behind the scenes:

```text
searchEvents
getEventDetails
checkAvailability
createReservation
startPayment
```

## Backend Implementation Plan

### Phase 1: Read-Only Assistant

Goal:

Allow users to ask questions about events, dates, venues, ticket types, and prices.

Tasks:

- Add `POST /chat` endpoint.
- Add AI provider configuration.
- Implement read-only tools:
  - `searchEvents`
  - `getEventDetails`
- Add guardrails so the assistant only answers from backend data.
- Add tests for event lookup and ambiguous searches.

Expected effort:

```text
2-4 days
```

### Phase 2: Availability-Aware Assistant

Goal:

Allow the assistant to answer availability questions accurately.

Tasks:

- Add `checkAvailability` tool.
- Reuse reservation availability logic.
- Teach assistant to ask clarifying questions when multiple events match.
- Add tests for sold-out and limited-inventory responses.

Expected effort:

```text
2-4 days
```

### Phase 3: Reservation Assistant

Goal:

Allow users to create temporary reservations through conversation.

Tasks:

- Add `createReservation` tool.
- Require explicit user confirmation before reserving inventory.
- Return reservation expiry time and countdown data.
- Handle inventory conflict responses.
- Add tests for expired reservation and unavailable inventory.

Expected effort:

```text
4-7 days
```

### Phase 4: Payment Handoff

Goal:

Allow the assistant to move users from reservation to payment.

Tasks:

- Add `startPayment` tool.
- For MVP, connect to mock payment flow.
- Later, connect to Stripe or Razorpay test mode.
- Ensure payment confirmation remains idempotent.
- Add tests for expired reservation and payment retry behavior.

Expected effort:

```text
2-5 days for mock payment
4-8 days for real payment provider
```

### Phase 5: Chat UI

Goal:

Add the user-facing chat experience.

Possible UI placements:

- Dedicated "Ask" screen in the customer app.
- Assistant panel on event list screen.
- Assistant panel on event detail screen.
- Floating chat entry point.

Recommended MVP:

Start with a dedicated "Ask" screen because it is easier to test and less intrusive.

Expected effort:

```text
3-6 days
```

## Safety and Product Rules

The assistant should:

- Ask for confirmation before creating a reservation.
- Never say a ticket is booked until payment is confirmed.
- Never claim availability unless it came from backend availability logic.
- Handle ambiguous event names by showing options.
- Respect reservation expiry.
- Refuse unsupported actions, such as cancelling another user's booking.
- Avoid collecting raw card details in chat.
- Send users to a secure payment step instead of processing card data in the conversation.

## Data Needed

For a good assistant experience, the backend should expose:

- Event title
- Event description
- Category
- Start and end time
- Venue name
- Venue city and address
- Ticket type name
- Ticket price
- Ticket capacity
- Current availability
- Reservation expiry
- Payment status

## API Sketch

```http
POST /chat
Content-Type: application/json
```

Request:

```json
{
  "conversationId": "optional-existing-conversation-id",
  "message": "Are there tickets for the jazz event at Skyline Hall?",
  "context": {
    "currentEventId": "optional-event-id",
    "currentReservationId": "optional-reservation-id"
  }
}
```

Response:

```json
{
  "conversationId": "conversation-id",
  "message": "Yes, VIP and General tickets are available for Skyline Jazz Night.",
  "suggestedActions": [
    {
      "type": "select_ticket_type",
      "label": "Choose tickets",
      "eventId": "event-id"
    }
  ]
}
```

## Testing Checklist

- User can ask for an event by exact name.
- User can ask for events by venue.
- User can ask for event date and venue address.
- Assistant handles no matching events.
- Assistant handles multiple matching events.
- Assistant does not invent unavailable event details.
- Assistant checks availability before suggesting reservation.
- Assistant asks confirmation before creating reservation.
- Expired reservation cannot proceed to payment.
- Payment retry does not create duplicate bookings.
- Concurrent reservation protection still works without relying on the assistant.

## Suggested Build Order

1. Finish event discovery APIs.
2. Finish reservation and availability logic.
3. Finish mock payment confirmation.
4. Add read-only chat assistant.
5. Add availability-aware assistant.
6. Add reservation creation.
7. Add payment handoff.
8. Improve chat UI and conversation memory.

## Effort Summary

```text
Simple event Q&A chatbot:             2-4 days
Availability-aware assistant:         4-8 days
Reservation-capable assistant:        1-2 weeks
Payment-capable assistant with mock:  1.5-3 weeks
Production-grade real-payment agent:  2-4 weeks
```

## Open Decisions

- Should the first version use OpenAI, another provider, or a mocked local assistant?
- Should chat history be stored in the database?
- Should the assistant be available before login, after login, or both?
- Should it support general ticket quantities first or seat-level selection?
- Should payment be mocked first or integrated with Stripe/Razorpay test mode?

## Recommendation

Build the chatbot after the core event, reservation, and payment flow exists.

That creates the strongest technical story: a conversational assistant layered on top of a real concurrency-safe booking system, with the backend still protecting inventory, reservations, and payment state.
