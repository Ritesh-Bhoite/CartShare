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
- `localStorage` for room data shared by tabs
- `sessionStorage` for the current tab's user identity

## How to Run

1. Open the project folder in VS Code.
2. Install the Live Server extension if it is not already installed.
3. Right-click `index.html` and select **Open with Live Server**.
4. Use **Create a Room** or **Join a Room** on the landing page.

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

## Collaboration

Cart data, activity, participant records, and orders are stored in `localStorage` under keys scoped to the room code, such as `cartShareCart_CART1234` and `cartShareOrders_CART1234`. Placing an order saves an item snapshot and delivery details without clearing the shared cart. The current room is written to `localStorage`; a per-tab `sessionStorage` room pin keeps another tab's room selection from changing the current tab's view. The application listens for the browser `storage` event and refreshes the relevant views when another tab changes those keys. The signed-in name is stored in `sessionStorage`, so different tabs can use different names without overwriting one another.

To test two users, open the Live Server page in two tabs. Create a room in the first tab and note its code. In the second tab, choose **Join Room**, enter a different name and that code, then open the cart in both tabs. Adding or removing an item in either tab should update the other tab automatically.

## Limitations

CartShare is a frontend-only browser collaboration prototype. Orders are simulated records only; no payment is collected or processed. It has no backend, database, authentication, or server-side presence tracking. `localStorage` collaboration works between tabs using the same browser profile and site origin; it does not synchronize across different devices or separate browser profiles. Participant records indicate sessions that joined a room and do not guarantee that those sessions are currently active. Room codes are identifiers, not security credentials.
