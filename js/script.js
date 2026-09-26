(() => {
    const USER_KEY = "cartShareUser";
    const ROOM_KEY = "cartShareRoom";
    const ACTIVE_ROOM_KEY = "cartShareActiveRoom";
    const LAST_ORDER_KEY = "cartShareLastOrder";
    const state = { cart: [], activities: [], participants: [], orders: [] };

    function currentUser() {
        return sessionStorage.getItem(USER_KEY) || "";
    }

    function roomCode() {
        return sessionStorage.getItem(ACTIVE_ROOM_KEY) || localStorage.getItem(ROOM_KEY) || "";
    }

    function roomKey(type, code = roomCode()) {
        return code ? `cartShare${type}_${code}` : "";
    }

    function readRoomList(type, code = roomCode()) {
        const key = roomKey(type, code);
        if (!key) return [];
        try {
            const value = localStorage.getItem(key);
            const parsed = value ? JSON.parse(value) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            reportError(`Could not read room data (${type}).`, error);
            return [];
        }
    }

    function writeRoomList(type, entries, code = roomCode()) {
        const key = roomKey(type, code);
        if (!key) throw new Error("A room code is required to save room data.");
        try {
            localStorage.setItem(key, JSON.stringify(entries));
        } catch (error) {
            reportError(`Could not save room data (${type}).`, error);
            throw error;
        }
    }

    function createId(prefix = "cs") {
        return window.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value ?? "";
    }

    function reportError(message, error = null) {
        let banner = document.getElementById("appError");
        if (!banner) {
            banner = document.createElement("div");
            banner.id = "appError";
            banner.className = "app-error";
            banner.setAttribute("role", "alert");
            (document.querySelector("main") || document.body).prepend(banner);
        }
        console.error(`[CartShare] ${message}`, error || "");
        banner.textContent = error?.message ? `${message} ${error.message}` : message;
        banner.hidden = false;
    }

    function clearError() {
        const banner = document.getElementById("appError");
        if (banner) {
            banner.hidden = true;
            banner.textContent = "";
        }
    }

    function requireRoom() {
        const name = currentUser();
        const code = roomCode();
        if (!name || !code) {
            window.location.replace("index.html");
            return null;
        }
        sessionStorage.setItem(ACTIVE_ROOM_KEY, code);
        return { name, code };
    }

    function createEmptyState(title, description) {
        const element = document.createElement("div");
        element.className = "empty-state";
        const heading = document.createElement("h3");
        heading.textContent = title;
        element.append(heading);
        if (description) {
            const text = document.createElement("p");
            text.textContent = description;
            element.append(text);
        }
        return element;
    }

    function formatRupees(amount) {
        return `₹${Number(amount || 0).toFixed(2)}`;
    }

    function calculateTotals(items) {
        return items.reduce((result, item) => {
            result.quantity += Number(item.quantity) || 0;
            result.amount += (Number(item.quantity) || 0) * (Number(item.price) || 0);
            return result;
        }, { quantity: 0, amount: 0 });
    }

    function getParticipantId(code = roomCode()) {
        const key = `cartShareParticipantId_${code}`;
        let id = sessionStorage.getItem(key);
        if (!id) {
            id = createId("participant");
            sessionStorage.setItem(key, id);
        }
        return id;
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

    function addActivity(action, item, user = currentUser(), code = roomCode()) {
        const activities = readRoomList("Activity", code);
        activities.unshift({
            id: createId("activity"),
            user,
            action,
            item: item || "",
            time: new Date().toLocaleString(),
            createdAt: new Date().toISOString()
        });
        writeRoomList("Activity", activities.slice(0, 30), code);
    }

    function registerParticipant(name, code) {
        const participants = readRoomList("Participants", code);
        const id = getParticipantId(code);
        const now = new Date().toISOString();
        const existing = participants.find((participant) => participant.id === id);
        if (existing) {
            existing.name = name;
            existing.lastSeen = now;
            writeRoomList("Participants", participants, code);
            return false;
        }
        participants.push({ id, name, joinedAt: now, lastSeen: now });
        writeRoomList("Participants", participants.slice(-100), code);
        return true;
    }

    function roomExists(code) {
        return Boolean(code && localStorage.getItem(roomKey("Room", code)));
    }

    function generateRoomCode() {
        let code;
        do {
            const random = new Uint32Array(1);
            window.crypto?.getRandomValues?.(random);
            const number = random[0] || Math.floor(Math.random() * 1000000);
            code = `CART${String(number % 1000000).padStart(6, "0")}`;
        } while (roomExists(code));
        return code;
    }

    function showRoomSection(mode = "create") {
        const section = document.getElementById("roomSection");
        if (!section || !document.getElementById("roomForm")) return;
        section.hidden = false;
        setRoomFormMode(mode);
        section.scrollIntoView({ behavior: "smooth", block: "start" });
        document.getElementById("userName")?.focus({ preventScroll: true });
    }

    function setRoomFormMode(mode) {
        const joining = mode === "join";
        const codeField = document.getElementById("roomCodeField");
        const submitButton = document.getElementById("roomSubmit");
        const modeField = document.getElementById("formMode");
        if (!codeField || !submitButton || !modeField) return;
        modeField.value = joining ? "join" : "create";
        codeField.hidden = !joining;
        document.getElementById("roomCode").required = joining;
        submitButton.textContent = joining ? "Join Room" : "Create Room";
        document.querySelectorAll("[data-form-mode]").forEach((button) => {
            const selected = button.dataset.formMode === modeField.value;
            button.classList.toggle("is-selected", selected);
            button.setAttribute("aria-pressed", String(selected));
        });
    }

    function handleRoomFormSubmit(event) {
        event.preventDefault();
        clearError();
        const nameField = document.getElementById("userName");
        const codeField = document.getElementById("roomCode");
        const mode = document.getElementById("formMode").value;
        const name = nameField.value.trim();
        if (!name) {
            nameField.setCustomValidity("Please enter your name.");
            nameField.reportValidity();
            nameField.setCustomValidity("");
            return;
        }

        let code;
        if (mode === "join") {
            code = codeField.value.trim().toUpperCase();
            if (!/^[A-Z0-9-]{1,24}$/.test(code)) {
                codeField.setCustomValidity("Enter a valid room code.");
                codeField.reportValidity();
                codeField.setCustomValidity("");
                return;
            }
            if (!roomExists(code)) {
                reportError("That room code does not exist. Check the code and try again.");
                return;
            }
        } else {
            code = generateRoomCode();
        }

        try {
            if (mode === "create") {
                localStorage.setItem(roomKey("Room", code), JSON.stringify({ code, createdAt: new Date().toISOString() }));
            }
            sessionStorage.setItem(USER_KEY, name);
            sessionStorage.setItem(ACTIVE_ROOM_KEY, code);
            localStorage.setItem(ROOM_KEY, code);
            const firstJoin = registerParticipant(name, code);
            if (mode === "create") addActivity("created", "room", name, code);
            else if (firstJoin) addActivity("joined", "room", name, code);
            window.location.href = "room.html";
        } catch (error) {
            reportError(mode === "join" ? "Unable to join room." : "Unable to create room.", error);
        }
    }

    function activityMessage(activity) {
        if (activity.action === "added" || activity.action === "removed") return `${activity.user} ${activity.action} ${activity.item}`;
        if (activity.action === "joined") return `${activity.user} joined the room`;
        if (activity.action === "placed") return `${activity.user} placed order ${activity.item}`;
        return `${activity.user} created the room`;
    }

    function renderActivityList(containerId, countId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const activities = getActivities();
        container.replaceChildren();
        if (!activities.length) {
            container.append(createEmptyState("No activity yet", "Add or remove an item to start the room log."));
        } else {
            activities.forEach((activity) => {
                const row = document.createElement("article");
                row.className = "activity-item";
                const message = document.createElement("p");
                message.textContent = activityMessage(activity);
                const time = document.createElement("time");
                time.dateTime = activity.createdAt || "";
                time.textContent = activity.time || "";
                row.append(message, time);
                container.append(row);
            });
        }
        setText(countId, `${activities.length} ${activities.length === 1 ? "activity" : "activities"}`);
    }

    function renderParticipants() {
        const container = document.getElementById("participantList");
        if (!container) return;
        const participants = readRoomList("Participants");
        container.replaceChildren();
        if (!participants.length) {
            container.append(createEmptyState("No participants yet", "Room members will appear here after joining."));
        } else {
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
        }
        setText("participantCount", `${participants.length} ${participants.length === 1 ? "participant" : "participants"}`);
    }

    function renderCart() {
        const container = document.getElementById("cartItems");
        if (!container) return;
        const cart = getCart();
        container.replaceChildren();
        if (!cart.length) {
            const empty = createEmptyState("Your cart is empty", "Add your first shopping item above.");
            empty.classList.add("cart-empty-state");
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
                const remove = document.createElement("button");
                remove.className = "remove-item";
                remove.type = "button";
                remove.dataset.removeItem = item.id;
                remove.setAttribute("aria-label", `Remove ${item.name}`);
                remove.textContent = "Remove";
                details.append(name, byline);
                row.append(details, lineTotal, remove);
                container.append(row);
            });
        }
        const sum = calculateTotals(cart);
        setText("itemCount", `${sum.quantity} ${sum.quantity === 1 ? "item" : "items"}`);
        setText("cartTotal", formatRupees(sum.amount));
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

    function renderCheckoutSummary() {
        const container = document.getElementById("checkoutItems");
        if (!container) return;
        const cart = getCart();
        container.replaceChildren();
        if (!cart.length) container.append(createEmptyState("Your cart is empty", "Add items before placing an order."));
        else cart.forEach((item) => appendOrderItem(container, item));
        const sum = calculateTotals(cart);
        setText("checkoutRoomCode", roomCode());
        setText("checkoutItemCount", `${sum.quantity} ${sum.quantity === 1 ? "item" : "items"}`);
        setText("checkoutTotal", formatRupees(sum.amount));
        const button = document.getElementById("placeOrderButton");
        if (button) button.disabled = cart.length === 0;
    }

    function getOrders() {
        return readRoomList("Orders");
    }

    function loadOrder(id) {
        return getOrders().find((order) => order.id === id) || null;
    }

    function renderReceipt() {
        const body = document.getElementById("receiptItems");
        if (!body) return;
        const id = new URLSearchParams(window.location.search).get("orderId");
        const order = id ? loadOrder(id) : null;
        const items = order ? order.items : getCart();
        const sum = calculateTotals(items);
        body.replaceChildren();
        if (!items.length) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 5;
            cell.className = "receipt-empty";
            cell.textContent = "No items in this room yet.";
            row.append(cell);
            body.append(row);
        } else {
            items.forEach((item) => {
                const row = document.createElement("tr");
                [item.name, String(item.quantity), formatRupees(item.price), item.addedBy || "", formatRupees(item.quantity * item.price)].forEach((value) => {
                    const cell = document.createElement("td");
                    cell.textContent = value;
                    row.append(cell);
                });
                body.append(row);
            });
        }
        setText("receiptItemCount", String(order?.itemCount ?? sum.quantity));
        setText("receiptTotal", formatRupees(order?.grandTotal ?? sum.amount));
        setText("receiptRoomCode", roomCode());
        setText("receiptDate", order?.createdAt || new Date().toLocaleString());
        setText("receiptOrderId", order?.id || "");
        const orderIdRow = document.getElementById("receiptOrderIdRow");
        if (orderIdRow) orderIdRow.hidden = !order;
    }

    function renderRoomData() {
        const context = requireRoom();
        if (!context) return;
        setText("displayUser", context.name);
        setText("displayRoom", context.code);
        setText("cartRoomCode", context.code);
        state.cart = getCart();
        state.activities = getActivities();
        state.participants = readRoomList("Participants");
        state.orders = getOrders();
        renderCart();
        renderActivityList("activityLog", "activityCount");
        renderActivityList("roomActivityLog", "roomActivityCount");
        renderParticipants();
        renderReceipt();
        clearError();
    }

    function handleAddItem(event) {
        event.preventDefault();
        clearError();
        const nameField = document.getElementById("itemName");
        const quantityField = document.getElementById("itemQuantity");
        const priceField = document.getElementById("itemPrice");
        const name = nameField.value.trim();
        const quantity = Number(quantityField.value);
        const price = Number(priceField.value);
        if (!name || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || priceField.value.trim() === "" || price < 0) {
            window.alert("Enter an item name, a quantity above zero, and a valid non-negative price.");
            return;
        }
        try {
            const cart = getCart();
            cart.push({ id: createId("item"), name, quantity, price, addedBy: currentUser(), createdAt: new Date().toISOString() });
            saveCart(cart);
            addActivity("added", name);
            event.currentTarget.reset();
            quantityField.value = "1";
            state.cart = cart;
            state.activities = getActivities();
            renderCart();
            renderActivityList("activityLog", "activityCount");
        } catch (error) {
            reportError("Unable to add item.", error);
        }
    }

    function handleRemoveItem(id) {
        clearError();
        const cart = getCart();
        const item = cart.find((entry) => String(entry.id) === String(id));
        if (!item) return;
        try {
            const remaining = cart.filter((entry) => String(entry.id) !== String(id));
            saveCart(remaining);
            addActivity("removed", item.name);
            state.cart = remaining;
            state.activities = getActivities();
            renderCart();
            renderActivityList("activityLog", "activityCount");
        } catch (error) {
            reportError("Unable to remove item.", error);
        }
    }

    function placeOrder(event) {
        event.preventDefault();
        clearError();
        const cart = getCart();
        if (!cart.length) {
            reportError("Add at least one item to your cart before placing an order.");
            return;
        }
        const customerName = document.getElementById("customerName").value.trim();
        const contactNumber = document.getElementById("contactNumber").value.trim();
        const deliveryAddress = document.getElementById("deliveryAddress").value.trim();
        if (!customerName || !contactNumber || !deliveryAddress) return;
        try {
            const orders = getOrders();
            let id;
            do {
                const random = new Uint32Array(1);
                window.crypto?.getRandomValues?.(random);
                id = `CS-${String((random[0] || Math.floor(Math.random() * 1000000)) % 1000000).padStart(6, "0")}`;
            } while (orders.some((order) => order.id === id));
            const sum = calculateTotals(cart);
            const order = {
                id,
                user: currentUser(),
                customerName,
                contactNumber,
                deliveryAddress,
                roomCode: roomCode(),
                createdAt: new Date().toLocaleString(),
                items: cart.map((item) => ({ ...item })),
                itemCount: sum.quantity,
                grandTotal: sum.amount
            };
            orders.unshift(order);
            writeRoomList("Orders", orders);
            addActivity("placed", id);
            sessionStorage.setItem(LAST_ORDER_KEY, id);
            window.location.href = `order-confirmation.html?orderId=${encodeURIComponent(id)}`;
        } catch (error) {
            reportError("Unable to place order.", error);
        }
    }

    function renderConfirmation() {
        const id = new URLSearchParams(window.location.search).get("orderId") || sessionStorage.getItem(LAST_ORDER_KEY);
        if (!id) {
            window.location.replace("cart.html");
            return;
        }
        const order = loadOrder(id);
        if (!order || order.roomCode !== roomCode()) {
            reportError("This order could not be found in the current room.");
            return;
        }
        sessionStorage.setItem(LAST_ORDER_KEY, id);
        setText("confirmationOrderId", order.id);
        setText("confirmationCustomer", order.customerName);
        setText("confirmationRoom", order.roomCode);
        setText("confirmationDate", order.createdAt);
        setText("confirmationTotal", formatRupees(order.grandTotal));
        const container = document.getElementById("confirmationItems");
        container.replaceChildren();
        order.items.forEach((item) => appendOrderItem(container, item));
        document.getElementById("viewOrderReceipt").href = `room.html?orderId=${encodeURIComponent(id)}`;
    }

    function showRoomPanel(panelId) {
        document.querySelectorAll("[data-room-panel]").forEach((panel) => { panel.hidden = panel.id !== panelId; });
        document.querySelectorAll("[data-panel-target]").forEach((button) => {
            button.setAttribute("aria-expanded", String(button.dataset.panelTarget === panelId));
        });
        document.getElementById(panelId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function initializeLandingPage() {
        document.querySelectorAll("[data-room-mode]").forEach((button) => button.addEventListener("click", () => showRoomSection(button.dataset.roomMode)));
        document.querySelectorAll("[data-form-mode]").forEach((button) => button.addEventListener("click", () => setRoomFormMode(button.dataset.formMode)));
        document.getElementById("roomForm")?.addEventListener("submit", handleRoomFormSubmit);
    }

    function initializeRoomPage() {
        if (!requireRoom()) return;
        registerParticipant(currentUser(), roomCode());
        renderRoomData();
        if (new URLSearchParams(window.location.search).has("orderId")) showRoomPanel("receiptPanel");
        document.querySelectorAll("[data-panel-target]").forEach((button) => button.addEventListener("click", () => showRoomPanel(button.dataset.panelTarget)));
        document.querySelectorAll("[data-close-panel]").forEach((button) => button.addEventListener("click", () => {
            document.querySelectorAll("[data-room-panel]").forEach((panel) => { panel.hidden = true; });
        }));
        document.getElementById("printReceipt")?.addEventListener("click", () => window.print());
    }

    function initializeCartPage() {
        if (!requireRoom()) return;
        renderRoomData();
        document.getElementById("addItemForm")?.addEventListener("submit", handleAddItem);
        document.getElementById("cartItems")?.addEventListener("click", (event) => {
            const button = event.target.closest("[data-remove-item]");
            if (button) handleRemoveItem(button.dataset.removeItem);
        });
    }

    function initializeCheckoutPage() {
        if (!requireRoom()) return;
        state.cart = getCart();
        renderCheckoutSummary();
        document.getElementById("customerName").value = currentUser();
        document.getElementById("checkoutForm")?.addEventListener("submit", placeOrder);
    }

    function initializeConfirmationPage() {
        if (!requireRoom()) return;
        renderConfirmation();
    }

    function refreshRoomFromStorage(event) {
        const code = roomCode();
        if (!code || !event.key || !event.key.endsWith(`_${code}`)) return;
        if (event.key === roomKey("Cart", code)) {
            state.cart = getCart();
            renderCart();
            renderCheckoutSummary();
            renderReceipt();
        } else if (event.key === roomKey("Activity", code)) {
            state.activities = getActivities();
            renderActivityList("activityLog", "activityCount");
            renderActivityList("roomActivityLog", "roomActivityCount");
        } else if (event.key === roomKey("Participants", code)) {
            state.participants = readRoomList("Participants", code);
            renderParticipants();
        } else if (event.key === roomKey("Orders", code)) {
            state.orders = getOrders();
            renderConfirmation();
            renderReceipt();
        }
    }

    function initializePage() {
        const page = document.body.dataset.page;
        if (page === "landing") initializeLandingPage();
        else if (page === "room") initializeRoomPage();
        else if (page === "cart") initializeCartPage();
        else if (page === "checkout") initializeCheckoutPage();
        else if (page === "confirmation") initializeConfirmationPage();
        window.addEventListener("storage", refreshRoomFromStorage);
    }

    document.addEventListener("DOMContentLoaded", initializePage);
})();
