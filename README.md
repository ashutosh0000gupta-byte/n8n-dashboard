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

After importing the revised workflow, open the two new MongoDB nodes—`MongoDB - Upsert Customer` and `MongoDB - Log Incoming Message`—and choose the same MongoDB credential used by the other MongoDB nodes. Then activate the workflow.

Routine intent routing is handled by `Code - Route Intent (Zero Token)`. It sends greetings, product searches, purchases, order tracking, and help to the appropriate branch without calling Groq, which keeps normal chat token usage at zero. The former AI Agent is left in the workflow only as an optional future fallback; it is disconnected and therefore does not consume tokens.
