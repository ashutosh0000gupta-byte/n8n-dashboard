# GlowCare admin dashboard

This dashboard displays customer profiles, recent inbound WhatsApp messages, orders, and carts stored by the n8n workflow.

## Start it

1. Copy `.env.example` to `.env` and set the MongoDB connection, database name, and a strong admin username/password.
2. Run `npm install` in this folder.
3. Run `npm start`.
4. Open `http://localhost:3000` and sign in with the administrator credentials.

The `.env` file is deliberately not included in source control. Do not put MongoDB passwords in the workflow JSON or browser files.

## MongoDB collections

- `customers`: one current profile per WhatsApp number (`wa_id`).
- `conversations`: inbound messages, deduplicated by WhatsApp `message_id` so webhook retries do not create duplicate records.
- `orders`, `cart`, and `product_info`: existing store collections used by the workflow.

## n8n setup

After `Set - Extract Message2`, add these MongoDB nodes before the intent-routing node, using the same MongoDB credential as the rest of the workflow:

- `MongoDB - Upsert Customer`: update the `customers` collection using `wa_id` as the update key. Store `wa_id`, `profileName` from `user_name`, `lastMessage` from `message_text`, and `lastMessageAt`/`updatedAt` as the current ISO time.
- `MongoDB - Log Incoming Message`: insert into `conversations` with `wa_id`, `customerName` from `user_name`, `text` from `message_text`, `direction: "inbound"`, and `receivedAt` as the current ISO time. Include the WhatsApp message ID when available and create a unique index on it to prevent retry duplicates.

Connect the logging node back to `AI Agent - Intent Only2`, then activate the workflow. The dashboard's active-chat list and selectable chat history use these collections.

The Node.js dashboard is protected by HTTP Basic Auth. Copy `.env.example` to `.env`, set your MongoDB values, and keep `.env` private; it is intentionally excluded from Git.

Routine intent routing is handled by `Code - Route Intent (Zero Token)`. It sends greetings, product searches, purchases, order tracking, and help to the appropriate branch without calling Groq, which keeps normal chat token usage at zero. The former AI Agent is left in the workflow only as an optional future fallback; it is disconnected and therefore does not consume tokens.
