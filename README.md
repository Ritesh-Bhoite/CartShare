# CartShare

CartShare is a browser-based shared shopping cart for groups. Create or join a room, manage items together, see room activity and participants, and print a receipt.

## Features

- Create a room with a unique room code or join an existing room
- Add and remove cart items with quantity, price, and dynamic add-by attribution
- Room-specific cart totals and persistent browser storage
- Participant list and room activity log
- Same-origin tab/window updates using the browser `storage` event
- Checkout simulation, order confirmation, and printable receipt
- Responsive desktop and mobile layout

## Technologies

- HTML5, CSS3, and JavaScript
- Bootstrap 5 CDN
- `localStorage` for room, participant, cart, activity, and order data
- `sessionStorage` for the current tab's user name and participant identity

## How to Run

1. Open the project folder in VS Code.
2. Install the Live Server extension if needed.
3. Right-click `index.html` and select **Open with Live Server**. The static project can also be hosted on Vercel.
4. Create a room in one tab, then join it from another tab in the same browser profile using the displayed room code.

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
│   └── script.js
└── assets/
    └── images/
```

## Storage and Collaboration

Room data is stored under room-specific `localStorage` keys so different rooms remain isolated. A tab stores its current user name and participant-session ID in `sessionStorage`. Other tabs on the same browser profile and site origin receive `storage` events and reload the changed room data. The browser does not fire a `storage` event in the tab that performed the write, so that tab updates its view directly after each operation.

This browser-only assignment does not synchronize separate devices, browser profiles, or storage origins. It does not use Supabase, Firebase, a backend, or an external database. Orders are a local simulation only; no payment is processed.
