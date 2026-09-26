# CartShare

CartShare is a browser-based shared shopping list for roommates, students, friends, and other groups. Create a room or join one with its code, then track items, activity, participants, and a printable receipt together.

## Features

- Create a room or join an existing room code
- Shared, room-specific shopping cart with add and remove actions
- Checkout with customer, contact, and delivery details
- Room-scoped order placement simulation and confirmation page
- Automatic cart, activity, and participant updates between browser tabs
- Dynamic participant names stored per browser tab
- Room activity history with the latest 30 entries
- Receipt generation and print-only receipt layout
- Responsive landing, room dashboard, and cart pages
- Indian Rupee pricing and cart totals

## Technologies

- HTML5
- CSS3
- JavaScript
- Bootstrap 5 CDN
- Supabase JavaScript client v2
- Supabase Postgres and Realtime for shared room data
- `sessionStorage` for the current tab's identity and active-room convenience state
- `localStorage` only for the last selected room convenience value

## How to Run

1. Open the project folder in VS Code.
2. Install the Live Server extension if it is not already installed.
3. Open `js/supabase-config.js` and replace `PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE` with the Supabase **publishable** key for the configured project. Never paste a secret or `service_role` key into browser code.
4. Confirm the six tables are in the `supabase_realtime` publication. The current project reports Realtime enabled for all six tables.
5. Right-click `index.html` and select **Open with Live Server**, or deploy the static project root to Vercel.
6. Use **Create a Room** or **Join a Room** on the landing page.

The pages load Supabase JS v2 from jsDelivr, then `js/supabase-config.js`, then `js/script.js`. The app uses the existing columns in `rooms`, `participants`, `cart_items`, `activities`, `orders`, and `order_items`. Shared records are queried by room code; the current user's name remains in `sessionStorage`.

## Folder Structure

```text
CartShare/
├── index.html
├── room.html
├── cart.html
├── checkout.html
├── order-confirmation.html
├── README.md
├── css/
│   └── style.css
├── js/
│   ├── script.js
│   └── supabase-config.js
└── assets/
	└── images/
```

## Collaboration

Cart items, activities, participants, rooms, orders, and order lines are stored in the Supabase tables. Room-scoped queries and Realtime subscriptions keep each normal app view on its active room; cart deletion events refresh the current room's cart. Order-line change events are not subscribed to globally because `order_items` has no `room_code` column. The room-filtered `orders` Realtime event refreshes a newly placed order after its lines are saved. Orders preserve a snapshot of the cart without clearing it. The browser storage `storage` event is not used for synchronization. The signed-in name is stored in `sessionStorage` and is never written to shared room rows as the identity source.

To test two users, open the Live Server page in two tabs. Create a room in the first tab and note its code. In the second tab, choose **Join Room**, enter a different name and that code, then open the cart in both tabs. Adding or removing an item in either tab should update the other tab automatically.

## Limitations

CartShare remains a static HTML/CSS/JavaScript frontend, but Supabase is its hosted database and Realtime service. Orders are simulated records only; no payment is collected or processed. Participant rows indicate sessions that joined a room and do not guarantee those sessions are currently active.

**Security status:** the supplied project status showed RLS disabled on all six tables. With RLS disabled, room-code filters in this UI are not database security boundaries; anyone with the project URL and publishable key may be able to read or modify data permitted by the API grants. Publishable keys are expected in browser apps, but they do not make public table access safe. Do not use this configuration for private or sensitive data. Before production use, choose and implement an authorization/RLS design for room membership. No RLS policies were changed by this client integration.

Vercel can host this project as static files. Cross-device operations require network access to Supabase and the Supabase JS CDN; they do not require a custom application server.
