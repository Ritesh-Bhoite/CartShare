(() => {
    const USER_KEY = "cartShareUser";
    const ROOM_KEY = "cartShareRoom";
    const ACTIVE_ROOM_KEY = "cartShareActiveRoom";
    const PARTICIPANT_ID_KEY = "cartShareParticipantId";
    const LAST_ORDER_KEY = "cartShareLastOrder";

    function getRoomCode() {
        return sessionStorage.getItem(ACTIVE_ROOM_KEY) || localStorage.getItem(ROOM_KEY);
    }

    function getRoomStorageKey(type, roomCode = getRoomCode()) {
        return `cartShare${type}_${roomCode}`;
    }

    function readRoomList(type, roomCode = getRoomCode()) {
        if (!roomCode) {
            return [];
        }

        try {
            const value = localStorage.getItem(getRoomStorageKey(type, roomCode));
            const entries = value ? JSON.parse(value) : [];
            return Array.isArray(entries) ? entries : [];
        } catch {
            return [];
        }
    }

    function writeRoomList(type, entries, roomCode = getRoomCode()) {
        if (roomCode) {
            localStorage.setItem(getRoomStorageKey(type, roomCode), JSON.stringify(entries));
        }
    }

    function getCurrentUser() {
        return sessionStorage.getItem(USER_KEY);
    }

    function getParticipantId() {
        let participantId = sessionStorage.getItem(PARTICIPANT_ID_KEY);
        if (!participantId) {
            participantId = window.crypto?.randomUUID?.() ||
                `participant-${Date.now()}-${Math.random().toString(16).slice(2)}`;
            sessionStorage.setItem(PARTICIPANT_ID_KEY, participantId);
        }
        return participantId;
    }

    function requireRoomContext() {
        const userName = getCurrentUser();
        const roomCode = getRoomCode();
        if (!userName || !roomCode) {
            window.location.replace("index.html");
            return null;
        }
        sessionStorage.setItem(ACTIVE_ROOM_KEY, roomCode);
        return { userName, roomCode };
    }

    function getCart() {
        return readRoomList("Cart");
    }

    function saveCart(cart) {
        writeRoomList("Cart", cart);
    }

    function getActivities() {
        return readRoomList("Activity");
    }

    function saveActivity(action, itemName, userName = getCurrentUser()) {
        const activities = getActivities();
        activities.unshift({
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            user: userName || "",
            action,
            item: itemName,
            time: new Date().toLocaleString()
        });
        writeRoomList("Activity", activities.slice(0, 30));
    }

    function registerParticipant(userName, roomCode) {
        const participants = readRoomList("Participants", roomCode);
        const participantId = getParticipantId();
        const existing = participants.find((participant) => participant.id === participantId);
        const now = new Date().toISOString();

        if (existing) {
            existing.name = userName;
            existing.lastSeen = now;
        } else {
            participants.push({ id: participantId, name: userName, joinedAt: now, lastSeen: now });
        }
        writeRoomList("Participants", participants.slice(-50), roomCode);
    }

    function generateRoomCode() {
        let roomCode;
        do {
            roomCode = `CART${Math.floor(1000 + Math.random() * 9000)}`;
        } while (localStorage.getItem(getRoomStorageKey("Participants", roomCode)));
        return roomCode;
    }

    function showRoomSection(mode = "create") {
        const roomSection = document.getElementById("roomSection");
        const roomForm = document.getElementById("roomForm");

        if (!roomSection || !roomForm) {
            return;
        }

        roomSection.hidden = false;
        setRoomFormMode(mode);
        roomSection.scrollIntoView({ behavior: "smooth", block: "start" });
        document.getElementById("userName")?.focus({ preventScroll: true });
    }

    function setRoomFormMode(mode) {
        const isJoining = mode === "join";
        const roomCodeField = document.getElementById("roomCodeField");
        const submitButton = document.getElementById("roomSubmit");
        const formMode = document.getElementById("formMode");
        if (!roomCodeField || !submitButton || !formMode) {
            return;
        }

        formMode.value = isJoining ? "join" : "create";
        roomCodeField.hidden = !isJoining;
        document.getElementById("roomCode").required = isJoining;
        submitButton.textContent = isJoining ? "Join Room" : "Create Room";
        document.querySelectorAll("[data-form-mode]").forEach((button) => {
            const selected = button.dataset.formMode === formMode.value;
            button.classList.toggle("is-selected", selected);
            button.setAttribute("aria-pressed", String(selected));
        });
    }

    function handleRoomFormSubmit(event) {
        event.preventDefault();
        const userNameField = document.getElementById("userName");
        const roomCodeField = document.getElementById("roomCode");
        const mode = document.getElementById("formMode").value;
        const userName = userNameField.value.trim();

        if (!userName) {
            userNameField.setCustomValidity("Please enter your name.");
            userNameField.reportValidity();
            userNameField.setCustomValidity("");
            return;
        }

        let roomCode;
        if (mode === "join") {
            roomCode = roomCodeField.value.trim().toUpperCase();
            if (!roomCode) {
                roomCodeField.setCustomValidity("Please enter a room code.");
                roomCodeField.reportValidity();
                roomCodeField.setCustomValidity("");
                return;
            }
        } else {
            roomCode = generateRoomCode();
        }

        sessionStorage.setItem(USER_KEY, userName);
        sessionStorage.setItem(ACTIVE_ROOM_KEY, roomCode);
        localStorage.setItem(ROOM_KEY, roomCode);
        getParticipantId();
        registerParticipant(userName, roomCode);
        saveActivity(mode === "join" ? "joined" : "created", "room", userName);
        window.location.href = "room.html";
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    function createEmptyState(title, description) {
        const container = document.createElement("div");
        container.className = "empty-state";
        const heading = document.createElement("h3");
        heading.textContent = title;
        container.append(heading);
        if (description) {
            const paragraph = document.createElement("p");
            paragraph.textContent = description;
            container.append(paragraph);
        }
        return container;
    }

    function makeActivityText(activity) {
        if (activity.action === "added") {
            return `${activity.user} added ${activity.item}`;
        }
        if (activity.action === "removed") {
            return `${activity.user} removed ${activity.item}`;
        }
        if (activity.action === "joined") {
            return `${activity.user} joined the room`;
        }
        if (activity.action === "placed") {
            return `${activity.user} placed order ${activity.item}`;
        }
        return `${activity.user} created the room`;
    }

    function renderActivityList(containerId, countId) {
        const container = document.getElementById(containerId);
        if (!container) {
            return;
        }

        const activities = getActivities();
        container.replaceChildren();

        if (activities.length === 0) {
            container.append(createEmptyState("No activity yet", "Add or remove an item to start the room log."));
        } else {
            activities.forEach((activity) => {
                const row = document.createElement("article");
                row.className = "activity-item";

                const message = document.createElement("p");
                message.textContent = makeActivityText(activity);

                const time = document.createElement("time");
                time.textContent = activity.time;

                row.append(message, time);
                container.append(row);
            });
        }

        const count = activities.length;
        setText(countId, `${count} ${count === 1 ? "activity" : "activities"}`);
    }

    function renderParticipants() {
        const container = document.getElementById("participantList");
        if (!container) {
            return;
        }

        const participants = readRoomList("Participants");
        container.replaceChildren();

        if (participants.length === 0) {
            container.append(createEmptyState("No participants yet", "Room members will appear here after joining."));
            return;
        }

        participants.slice().reverse().forEach((participant) => {
            const row = document.createElement("div");
            row.className = "participant-row";

            const marker = document.createElement("span");
            marker.className = "participant-marker";
            marker.setAttribute("aria-hidden", "true");

            const name = document.createElement("strong");
            name.textContent = participant.name;

            const label = document.createElement("span");
            label.className = "participant-label";
            label.textContent = participant.id === getParticipantId() ? "This session" : "Room member";

            row.append(marker, name, label);
            container.append(row);
        });

        setText("participantCount", `${participants.length} ${participants.length === 1 ? "participant" : "participants"}`);
    }

    function calculateCartTotals(cart) {
        return cart.reduce((totals, item) => {
            totals.quantity += item.quantity;
            totals.amount += item.quantity * item.price;
            return totals;
        }, { quantity: 0, amount: 0 });
    }

    function formatRupees(amount) {
        return `₹${amount.toFixed(2)}`;
    }

    function renderCart() {
        const container = document.getElementById("cartItems");
        if (!container) {
            return;
        }

        const cart = getCart();
        container.replaceChildren();

        if (cart.length === 0) {
            const empty = createEmptyState("Your cart is empty", "Add your first shopping item above.");
            empty.classList.add("cart-empty-state");
            empty.setAttribute("data-symbol", "cart");
            container.append(empty);
        } else {
            cart.forEach((item) => {
                const row = document.createElement("article");
                row.className = "cart-item";

                const details = document.createElement("div");
                details.className = "cart-item-info";

                const name = document.createElement("h3");
                name.textContent = item.name;

                const byline = document.createElement("p");
                byline.textContent = `${item.quantity} × ${formatRupees(item.price)} · Added by ${item.addedBy}`;

                const lineTotal = document.createElement("strong");
                lineTotal.className = "cart-item-total";
                lineTotal.textContent = formatRupees(item.quantity * item.price);

                const removeButton = document.createElement("button");
                removeButton.className = "remove-item";
                removeButton.type = "button";
                removeButton.dataset.removeItem = item.id;
                removeButton.setAttribute("aria-label", `Remove ${item.name}`);
                removeButton.textContent = "Remove";

                details.append(name, byline);
                row.append(details, lineTotal, removeButton);
                container.append(row);
            });
        }

        const totals = calculateCartTotals(cart);
        setText("itemCount", `${totals.quantity} ${totals.quantity === 1 ? "item" : "items"}`);
        setText("cartTotal", formatRupees(totals.amount));
    }

    function renderReceipt() {
        const body = document.getElementById("receiptItems");
        if (!body) {
            return;
        }

        const order = getRequestedOrder();
        const items = order ? order.items : getCart();
        const totals = calculateCartTotals(items);
        body.replaceChildren();

        if (items.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 4;
            cell.className = "receipt-empty";
            cell.textContent = "No items in this room yet.";
            row.append(cell);
            body.append(row);
        } else {
            items.forEach((item) => {
                const row = document.createElement("tr");
                [
                    item.name,
                    String(item.quantity),
                    formatRupees(item.price),
                    formatRupees(item.quantity * item.price)
                ].forEach((value) => {
                    const cell = document.createElement("td");
                    cell.textContent = value;
                    row.append(cell);
                });
                body.append(row);
            });
        }

        setText("receiptItemCount", String(totals.quantity));
        setText("receiptTotal", formatRupees(order ? order.grandTotal : totals.amount));
        setText("receiptRoomCode", getRoomCode());
        setText("receiptDate", order ? order.createdAt : new Date().toLocaleString());
        setText("receiptOrderId", order ? order.id : "");
        const orderIdRow = document.getElementById("receiptOrderIdRow");
        if (orderIdRow) {
            orderIdRow.hidden = !order;
        }
    }

    function getOrders() {
        return readRoomList("Orders");
    }

    function getRequestedOrder() {
        const requestedId = new URLSearchParams(window.location.search).get("orderId") ||
            sessionStorage.getItem(LAST_ORDER_KEY);
        if (!requestedId) {
            return null;
        }
        return getOrders().find((order) => order.id === requestedId) || null;
    }

    function getOrderById(orderId) {
        return getOrders().find((order) => order.id === orderId) || null;
    }

    function createOrderId(orders) {
        let orderId;
        do {
            orderId = `CS-${Math.floor(100000 + Math.random() * 900000)}`;
        } while (orders.some((order) => order.id === orderId));
        return orderId;
    }

    function renderCheckoutSummary() {
        const container = document.getElementById("checkoutItems");
        if (!container) {
            return;
        }

        const cart = getCart();
        const totals = calculateCartTotals(cart);
        container.replaceChildren();
        if (cart.length === 0) {
            container.append(createEmptyState("Your cart is empty", "Add items before placing an order."));
        } else {
            cart.forEach((item) => {
                const row = document.createElement("article");
                row.className = "checkout-item";
                const details = document.createElement("div");
                const name = document.createElement("strong");
                name.textContent = item.name;
                const quantity = document.createElement("span");
                quantity.textContent = `${item.quantity} × ${formatRupees(item.price)}`;
                details.append(name, quantity);
                const total = document.createElement("strong");
                total.className = "checkout-line-total";
                total.textContent = formatRupees(item.quantity * item.price);
                row.append(details, total);
                container.append(row);
            });
        }

        setText("checkoutRoomCode", getRoomCode());
        setText("checkoutItemCount", `${totals.quantity} ${totals.quantity === 1 ? "item" : "items"}`);
        setText("checkoutTotal", formatRupees(totals.amount));
        const placeOrderButton = document.getElementById("placeOrderButton");
        if (placeOrderButton) {
            placeOrderButton.disabled = cart.length === 0;
        }
    }

    function placeOrder(event) {
        event.preventDefault();
        const cart = getCart();
        const error = document.getElementById("checkoutError");
        if (cart.length === 0) {
            error.textContent = "Add at least one item to your cart before placing an order.";
            error.hidden = false;
            return;
        }

        const customerName = document.getElementById("customerName").value.trim();
        const contactNumber = document.getElementById("contactNumber").value.trim();
        const deliveryAddress = document.getElementById("deliveryAddress").value.trim();
        if (!customerName || !contactNumber || !deliveryAddress) {
            return;
        }

        const orders = getOrders();
        const totals = calculateCartTotals(cart);
        const order = {
            id: createOrderId(orders),
            user: getCurrentUser(),
            customerName,
            contactNumber,
            deliveryAddress,
            roomCode: getRoomCode(),
            createdAt: new Date().toLocaleString(),
            items: cart.map((item) => ({ ...item })),
            itemCount: totals.quantity,
            grandTotal: totals.amount
        };

        orders.unshift(order);
        writeRoomList("Orders", orders);
        sessionStorage.setItem(LAST_ORDER_KEY, order.id);
        saveActivity("placed", order.id);
        window.location.href = `order-confirmation.html?orderId=${encodeURIComponent(order.id)}`;
    }

    function appendOrderItem(container, item) {
        const row = document.createElement("article");
        row.className = "checkout-item";
        const details = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = item.name;
        const quantity = document.createElement("span");
        quantity.textContent = `${item.quantity} × ${formatRupees(item.price)}`;
        details.append(name, quantity);
        const total = document.createElement("strong");
        total.className = "checkout-line-total";
        total.textContent = formatRupees(item.quantity * item.price);
        row.append(details, total);
        container.append(row);
    }

    function initializeCheckoutPage() {
        const context = requireRoomContext();
        if (!context) {
            return;
        }
        document.getElementById("customerName").value = context.userName;
        renderCheckoutSummary();
        document.getElementById("checkoutForm")?.addEventListener("submit", placeOrder);
    }

    function initializeConfirmationPage() {
        if (!requireRoomContext()) {
            return;
        }
        const orderId = new URLSearchParams(window.location.search).get("orderId") ||
            sessionStorage.getItem(LAST_ORDER_KEY);
        const order = orderId ? getOrderById(orderId) : null;
        if (!order) {
            window.location.replace("cart.html");
            return;
        }

        sessionStorage.setItem(LAST_ORDER_KEY, order.id);
        setText("confirmationOrderId", order.id);
        setText("confirmationCustomer", order.customerName);
        setText("confirmationRoom", order.roomCode);
        setText("confirmationDate", order.createdAt);
        setText("confirmationTotal", formatRupees(order.grandTotal));
        const items = document.getElementById("confirmationItems");
        items.replaceChildren();
        order.items.forEach((item) => appendOrderItem(items, item));
        document.getElementById("viewOrderReceipt").href =
            `room.html?orderId=${encodeURIComponent(order.id)}`;
    }

    function renderRoomData() {
        const context = requireRoomContext();
        if (!context) {
            return;
        }
        setText("displayUser", context.userName);
        setText("displayRoom", context.roomCode);
        setText("roomCodeLabel", context.roomCode);
        setText("cartRoomCode", context.roomCode);
        setText("receiptRoomCode", context.roomCode);
        renderCart();
        renderActivityList("activityLog", "activityCount");
        renderActivityList("roomActivityLog", "roomActivityCount");
        renderParticipants();
        renderReceipt();
    }

    function handleAddItem(event) {
        event.preventDefault();

        const nameField = document.getElementById("itemName");
        const quantityField = document.getElementById("itemQuantity");
        const priceField = document.getElementById("itemPrice");
        const itemName = nameField.value.trim();
        const quantity = Number(quantityField.value);
        const price = Number(priceField.value);

        if (!itemName || !Number.isFinite(quantity) || quantity <= 0 ||
            !Number.isFinite(price) || priceField.value.trim() === "" || price < 0) {
            window.alert("Enter an item name, a quantity above zero, and a valid non-negative price.");
            return;
        }

        const cart = getCart();
        cart.push({
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            name: itemName,
            quantity,
            price,
            addedBy: getCurrentUser()
        });

        saveCart(cart);
        saveActivity("added", itemName);
        event.currentTarget.reset();
        quantityField.value = "1";
        renderCart();
        renderActivityList("activityLog", "activityCount");
    }

    function handleRemoveItem(itemId) {
        const cart = getCart();
        const item = cart.find((entry) => String(entry.id) === String(itemId));
        if (!item) {
            return;
        }
        saveCart(cart.filter((entry) => String(entry.id) !== String(itemId)));
        saveActivity("removed", item.name);
        renderCart();
        renderActivityList("activityLog", "activityCount");
    }

    function showRoomPanel(panelId) {
        document.querySelectorAll("[data-room-panel]").forEach((panel) => {
            panel.hidden = panel.id !== panelId;
        });

        document.querySelectorAll("[data-panel-target]").forEach((button) => {
            const selected = button.dataset.panelTarget === panelId;
            button.setAttribute("aria-expanded", String(selected));
        });

        const panel = document.getElementById(panelId);
        panel?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function initializeLandingPage() {
        document.querySelectorAll("[data-room-mode]").forEach((button) => {
            button.addEventListener("click", () => showRoomSection(button.dataset.roomMode));
        });

        document.querySelectorAll("[data-form-mode]").forEach((button) => {
            button.addEventListener("click", () => setRoomFormMode(button.dataset.formMode));
        });

        document.getElementById("roomForm")?.addEventListener("submit", handleRoomFormSubmit);
    }

    function initializeRoomPage() {
        if (!requireRoomContext()) {
            return;
        }

        registerParticipant(getCurrentUser(), getRoomCode());
        renderRoomData();

        if (new URLSearchParams(window.location.search).has("orderId")) {
            showRoomPanel("receiptPanel");
        }

        document.querySelectorAll("[data-panel-target]").forEach((button) => {
            button.addEventListener("click", () => showRoomPanel(button.dataset.panelTarget));
        });

        document.querySelectorAll("[data-close-panel]").forEach((button) => {
            button.addEventListener("click", () => {
                document.querySelectorAll("[data-room-panel]").forEach((panel) => {
                    panel.hidden = true;
                });
            });
        });

        document.getElementById("printReceipt")?.addEventListener("click", () => window.print());
    }

    function initializeCartPage() {
        if (!requireRoomContext()) {
            return;
        }

        renderRoomData();
        document.getElementById("addItemForm")?.addEventListener("submit", handleAddItem);
        document.getElementById("cartItems")?.addEventListener("click", (event) => {
            const button = event.target.closest("[data-remove-item]");
            if (button) {
                handleRemoveItem(button.dataset.removeItem);
            }
        });
    }

    function initializePage() {
        const page = document.body.dataset.page;
        if (page === "landing") {
            initializeLandingPage();
        } else if (page === "room") {
            initializeRoomPage();
        } else if (page === "cart") {
            initializeCartPage();
        } else if (page === "checkout") {
            initializeCheckoutPage();
        } else if (page === "confirmation") {
            initializeConfirmationPage();
        }
        initializeStorageSync();
    }

    function initializeStorageSync() {
        window.addEventListener("storage", (event) => {
            const roomCode = getRoomCode();
            if (!roomCode) {
                return;
            }

            const updatedKeys = ["Cart", "Activity", "Participants"].map((type) =>
                getRoomStorageKey(type, roomCode)
            );

            if (updatedKeys.includes(event.key)) {
                renderCart();
                renderActivityList("activityLog", "activityCount");
                renderActivityList("roomActivityLog", "roomActivityCount");
                renderParticipants();
                renderReceipt();
                renderCheckoutSummary();
            }
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        initializePage();
    });
})();