(() => {
    const USER_KEY = "cartShareUser";
    const ROOM_KEY = "cartShareRoom";
    const ACTIVE_ROOM_KEY = "cartShareActiveRoom";
    const LAST_ORDER_KEY = "cartShareLastOrder";
    const state = { cart: [], activities: [], participants: [], channel: null };

    function client() {
        return window.cartShareSupabase || null;
    }

    function roomCode() {
        return sessionStorage.getItem(ACTIVE_ROOM_KEY) || localStorage.getItem(ROOM_KEY);
    }

    function currentUser() {
        return sessionStorage.getItem(USER_KEY);
    }

    function participantId(code = roomCode()) {
        const key = `cartShareParticipantId_${code}`;
        let id = sessionStorage.getItem(key);
        if (!id) {
            id = window.crypto?.randomUUID?.() || `participant-${Date.now()}-${Math.random().toString(16).slice(2)}`;
            sessionStorage.setItem(key, id);
        }
        return id;
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value ?? "";
    }

    function reportError(error, heading = "Supabase request failed") {
        let banner = document.getElementById("appError");
        if (!banner) {
            banner = document.createElement("div");
            banner.id = "appError";
            banner.className = "app-error";
            banner.setAttribute("role", "alert");
            (document.querySelector("main") || document.body).prepend(banner);
        }
        const message = typeof error === "string" ? error : error?.message || "Check the Supabase connection and table permissions.";
        console.error(`[CartShare] ${heading}: ${message}`, error);
        banner.textContent = `${heading}: ${message}`;
        banner.hidden = false;
    }

    function clearError() {
        const banner = document.getElementById("appError");
        if (banner) {
            banner.hidden = true;
            banner.textContent = "";
        }
    }

    function getClient() {
        const supabaseClient = client();
        if (!supabaseClient) {
            reportError(
                window.cartShareSupabaseInitError || "Add the Supabase publishable key to js/supabase-config.js and reload.",
                "Supabase setup required"
            );
        }
        return supabaseClient;
    }

    function requireRoom() {
        const userName = currentUser();
        const code = roomCode();
        if (!userName || !code) {
            window.location.replace("index.html");
            return null;
        }
        sessionStorage.setItem(ACTIVE_ROOM_KEY, code);
        return { userName, roomCode: code };
    }

    function createId() {
        return window.crypto?.randomUUID?.() || `cs-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    function rupees(amount) {
        return `₹${Number(amount || 0).toFixed(2)}`;
    }

    function totals(items) {
        return items.reduce((result, item) => {
            result.quantity += Number(item.quantity);
            result.amount += Number(item.quantity) * Number(item.price);
            return result;
        }, { quantity: 0, amount: 0 });
    }

    function emptyState(title, description) {
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

    function mapCart(row) {
        return { id: row.id, name: row.name, quantity: Number(row.quantity), price: Number(row.price), addedBy: row.added_by || "" };
    }

    function mapActivity(row) {
        return {
            id: row.id,
            user: row.user_name || "",
            action: row.action,
            item: row.item || "",
            time: row.created_at ? new Date(row.created_at).toLocaleString() : ""
        };
    }

    async function loadCart() {
        const db = getClient();
        if (!db || !roomCode()) return;
        const { data, error } = await db.from("cart_items")
            .select("id, room_code, name, quantity, price, added_by, created_at")
            .eq("room_code", roomCode()).order("created_at", { ascending: true });
        if (error) throw error;
        state.cart = (data || []).map(mapCart);
        renderCart();
        renderCheckoutSummary();
        await renderReceipt();
    }

    async function loadActivities() {
        const db = getClient();
        if (!db || !roomCode()) return;
        const { data, error } = await db.from("activities")
            .select("id, room_code, user_name, action, item, created_at")
            .eq("room_code", roomCode()).order("created_at", { ascending: false }).limit(30);
        if (error) throw error;
        state.activities = (data || []).map(mapActivity);
        renderActivityList("activityLog", "activityCount");
        renderActivityList("roomActivityLog", "roomActivityCount");
    }

    async function loadParticipants() {
        const db = getClient();
        const code = roomCode();
        if (!db || !code) return;
        const { data, error } = await db.from("participants")
            .select("id, room_code, name, joined_at, last_seen")
            .eq("room_code", code).order("joined_at", { ascending: true });
        if (error) throw error;
        state.participants = data || [];
        renderParticipants();
    }

    async function loadRoomData() {
        await Promise.all([loadCart(), loadActivities(), loadParticipants()]);
    }

    async function roomExists(code) {
        const db = getClient();
        if (!db) return false;
        const { data, error } = await db.from("rooms").select("room_code").eq("room_code", code).maybeSingle();
        if (error) throw error;
        return Boolean(data);
    }

    async function createRoom() {
        const db = getClient();
        if (!db) return null;
        for (let attempt = 0; attempt < 8; attempt += 1) {
            const random = new Uint32Array(1);
            window.crypto.getRandomValues(random);
            const code = `CART${String(random[0] % 1000000).padStart(6, "0")}`;
            const { error } = await db.from("rooms").insert({ room_code: code });
            if (!error) return code;
            if (error.code !== "23505") throw error;
        }
        throw new Error("Could not generate an unused room code. Please try again.");
    }

    async function addActivity(action, item, userName = currentUser(), code = roomCode()) {
        const db = getClient();
        if (!db || !code) return;
        const { error } = await db.from("activities").insert({
            id: createId(), room_code: code, user_name: userName || "", action, item: item || "", created_at: new Date().toISOString()
        });
        if (error) throw error;
    }

    async function registerParticipant(userName, code, recordJoin = true) {
        const db = getClient();
        if (!db) return;
        const id = participantId(code);
        const { data: existing, error: selectError } = await db.from("participants")
            .select("id").eq("id", id).eq("room_code", code).limit(1).maybeSingle();
        if (selectError) throw selectError;
        const timestamp = new Date().toISOString();
        if (existing) {
            const { error } = await db.from("participants").update({ name: userName, last_seen: timestamp })
                .eq("id", id).eq("room_code", code);
            if (error) throw error;
        } else {
            const { error } = await db.from("participants").insert({
                id, room_code: code, name: userName, joined_at: timestamp, last_seen: timestamp
            });
            if (error) throw error;
            if (recordJoin) await addActivity("joined", "room", userName, code);
        }
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
        const submit = document.getElementById("roomSubmit");
        const modeField = document.getElementById("formMode");
        if (!codeField || !submit || !modeField) return;
        modeField.value = joining ? "join" : "create";
        codeField.hidden = !joining;
        document.getElementById("roomCode").required = joining;
        submit.textContent = joining ? "Join Room" : "Create Room";
        document.querySelectorAll("[data-form-mode]").forEach((button) => {
            const selected = button.dataset.formMode === modeField.value;
            button.classList.toggle("is-selected", selected);
            button.setAttribute("aria-pressed", String(selected));
        });
    }

    async function handleRoomFormSubmit(event) {
        event.preventDefault();
        clearError();
        const db = getClient();
        if (!db) return;
        const userField = document.getElementById("userName");
        const codeField = document.getElementById("roomCode");
        const mode = document.getElementById("formMode").value;
        const name = userField.value.trim();
        if (!name) {
            userField.setCustomValidity("Please enter your name.");
            userField.reportValidity();
            userField.setCustomValidity("");
            return;
        }
        try {
            let code;
            if (mode === "join") {
                code = codeField.value.trim().toUpperCase();
                if (!/^[A-Z0-9-]{1,24}$/.test(code)) {
                    codeField.setCustomValidity("Enter a valid room code.");
                    codeField.reportValidity();
                    codeField.setCustomValidity("");
                    return;
                }
                if (!await roomExists(code)) {
                    reportError("That room code does not exist. Check the code and try again.", "Unable to join room");
                    return;
                }
            } else {
                code = await createRoom();
            }
            sessionStorage.setItem(USER_KEY, name);
            sessionStorage.setItem(ACTIVE_ROOM_KEY, code);
            localStorage.setItem(ROOM_KEY, code);
            await registerParticipant(name, code, mode === "join");
            if (mode === "create") await addActivity("created", "room", name, code);
            window.location.href = "room.html";
        } catch (error) {
            reportError(error, mode === "join" ? "Unable to join room" : "Unable to create room");
        }
    }

    function activityMessage(activity) {
        if (["added", "removed"].includes(activity.action)) return `${activity.user} ${activity.action} ${activity.item}`;
        if (activity.action === "joined") return `${activity.user} joined the room`;
        if (activity.action === "placed") return `${activity.user} placed order ${activity.item}`;
        return `${activity.user} created the room`;
    }

    function renderActivityList(containerId, countId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.replaceChildren();
        if (!state.activities.length) {
            container.append(emptyState("No activity yet", "Add or remove an item to start the room log."));
        } else {
            state.activities.forEach((activity) => {
                const row = document.createElement("article");
                row.className = "activity-item";
                const message = document.createElement("p");
                message.textContent = activityMessage(activity);
                const time = document.createElement("time");
                time.textContent = activity.time;
                row.append(message, time);
                container.append(row);
            });
        }
        setText(countId, `${state.activities.length} ${state.activities.length === 1 ? "activity" : "activities"}`);
    }

    function renderParticipants() {
        const container = document.getElementById("participantList");
        if (!container) return;
        container.replaceChildren();
        if (!state.participants.length) {
            container.append(emptyState("No participants yet", "Room members will appear here after joining."));
        } else {
            state.participants.forEach((participant) => {
                const row = document.createElement("div");
                row.className = "participant-row";
                const marker = document.createElement("span");
                marker.className = "participant-marker";
                marker.setAttribute("aria-hidden", "true");
                const name = document.createElement("strong");
                name.textContent = participant.name;
                const label = document.createElement("span");
                label.className = "participant-label";
                label.textContent = participant.id === participantId() ? "This session" : "Room member";
                row.append(marker, name, label);
                container.append(row);
            });
        }
        setText("participantCount", `${state.participants.length} ${state.participants.length === 1 ? "participant" : "participants"}`);
    }

    function renderCart() {
        const container = document.getElementById("cartItems");
        if (!container) return;
        container.replaceChildren();
        if (!state.cart.length) {
            const empty = emptyState("Your cart is empty", "Add your first shopping item above.");
            empty.classList.add("cart-empty-state");
            container.append(empty);
        } else {
            state.cart.forEach((item) => {
                const row = document.createElement("article");
                row.className = "cart-item";
                const details = document.createElement("div");
                details.className = "cart-item-info";
                const name = document.createElement("h3");
                name.textContent = item.name;
                const byline = document.createElement("p");
                byline.textContent = `${item.quantity} × ${rupees(item.price)} · Added by ${item.addedBy}`;
                const total = document.createElement("strong");
                total.className = "cart-item-total";
                total.textContent = rupees(item.quantity * item.price);
                const remove = document.createElement("button");
                remove.className = "remove-item";
                remove.type = "button";
                remove.dataset.removeItem = item.id;
                remove.setAttribute("aria-label", `Remove ${item.name}`);
                remove.textContent = "Remove";
                details.append(name, byline);
                row.append(details, total, remove);
                container.append(row);
            });
        }
        const sum = totals(state.cart);
        setText("itemCount", `${sum.quantity} ${sum.quantity === 1 ? "item" : "items"}`);
        setText("cartTotal", rupees(sum.amount));
    }

    function appendOrderItem(container, item) {
        const row = document.createElement("article");
        row.className = "checkout-item";
        const details = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = item.name;
        const quantity = document.createElement("span");
        quantity.textContent = `${item.quantity} × ${rupees(item.price)}`;
        details.append(name, quantity);
        const total = document.createElement("strong");
        total.className = "checkout-line-total";
        total.textContent = rupees(item.quantity * item.price);
        row.append(details, total);
        container.append(row);
    }

    function renderCheckoutSummary() {
        const container = document.getElementById("checkoutItems");
        if (!container) return;
        container.replaceChildren();
        if (!state.cart.length) container.append(emptyState("Your cart is empty", "Add items before placing an order."));
        else state.cart.forEach((item) => appendOrderItem(container, item));
        const sum = totals(state.cart);
        setText("checkoutRoomCode", roomCode());
        setText("checkoutItemCount", `${sum.quantity} ${sum.quantity === 1 ? "item" : "items"}`);
        setText("checkoutTotal", rupees(sum.amount));
        const button = document.getElementById("placeOrderButton");
        if (button) button.disabled = state.cart.length === 0;
    }

    async function loadOrder(id) {
        const db = getClient();
        const code = roomCode();
        if (!db || !id || !code) return null;
        const { data: order, error } = await db.from("orders")
            .select("id, room_code, user_name, customer_name, contact_number, delivery_address, item_count, grand_total, created_at")
            .eq("room_code", code).eq("id", id).maybeSingle();
        if (error) throw error;
        if (!order) return null;
        const { data: rows, error: itemError } = await db.from("order_items")
            .select("id, order_id, name, quantity, price").eq("order_id", order.id);
        if (itemError) throw itemError;
        order.items = (rows || []).map((row) => ({
            id: row.id, name: row.name, quantity: Number(row.quantity), price: Number(row.price)
        }));
        return order;
    }

    async function renderReceipt() {
        const body = document.getElementById("receiptItems");
        if (!body) return;
        try {
            const id = new URLSearchParams(location.search).get("orderId");
            const order = id ? await loadOrder(id) : null;
            const items = order ? order.items : state.cart;
            const sum = totals(items);
            body.replaceChildren();
            if (!items.length) {
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
                    [item.name, String(item.quantity), rupees(item.price), rupees(item.quantity * item.price)].forEach((value) => {
                        const cell = document.createElement("td");
                        cell.textContent = value;
                        row.append(cell);
                    });
                    body.append(row);
                });
            }
            setText("receiptItemCount", String(order?.item_count ?? sum.quantity));
            setText("receiptTotal", rupees(order?.grand_total ?? sum.amount));
            setText("receiptRoomCode", roomCode());
            setText("receiptDate", order?.created_at ? new Date(order.created_at).toLocaleString() : new Date().toLocaleString());
            setText("receiptOrderId", order?.id || "");
            const idRow = document.getElementById("receiptOrderIdRow");
            if (idRow) idRow.hidden = !order;
        } catch (error) {
            reportError(error, "Unable to load receipt");
        }
    }

    async function handleAddItem(event) {
        event.preventDefault();
        clearError();
        const db = getClient();
        if (!db) return;
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
            const { error } = await db.from("cart_items").insert({
                id: createId(), room_code: roomCode(), name, quantity, price,
                added_by: currentUser(), created_at: new Date().toISOString()
            });
            if (error) throw error;
            await addActivity("added", name);
            event.currentTarget.reset();
            quantityField.value = "1";
            await Promise.all([loadCart(), loadActivities()]);
        } catch (error) {
            reportError(error, "Unable to add item");
        }
    }

    async function handleRemoveItem(id) {
        const db = getClient();
        if (!db) return;
        const item = state.cart.find((entry) => entry.id === id);
        if (!item) return;
        try {
            const { error } = await db.from("cart_items").delete().eq("id", id).eq("room_code", roomCode());
            if (error) throw error;
            await addActivity("removed", item.name);
            await Promise.all([loadCart(), loadActivities()]);
        } catch (error) {
            reportError(error, "Unable to remove item");
        }
    }

    async function renderRoomData() {
        const context = requireRoom();
        if (!context || !getClient()) return;
        setText("displayUser", context.userName);
        setText("displayRoom", context.roomCode);
        setText("cartRoomCode", context.roomCode);
        try {
            await registerParticipant(context.userName, context.roomCode);
            await loadRoomData();
            clearError();
        } catch (error) {
            reportError(error, "Unable to load room");
        }
    }

    async function placeOrder(event) {
        event.preventDefault();
        clearError();
        const db = getClient();
        if (!db) return;
        const cart = state.cart.map((item) => ({ ...item }));
        if (!cart.length) {
            reportError("Add at least one item to your cart before placing an order.", "Unable to place order");
            return;
        }
        const customerName = document.getElementById("customerName").value.trim();
        const contactNumber = document.getElementById("contactNumber").value.trim();
        const deliveryAddress = document.getElementById("deliveryAddress").value.trim();
        if (!customerName || !contactNumber || !deliveryAddress) return;
        const sum = totals(cart);
        const button = document.getElementById("placeOrderButton");
        button.disabled = true;
        try {
            let id = "";
            let saved = false;
            for (let attempt = 0; attempt < 8; attempt += 1) {
                const random = new Uint32Array(1);
                window.crypto.getRandomValues(random);
                id = `CS-${String(random[0] % 1000000).padStart(6, "0")}`;
                const { error } = await db.from("orders").insert({
                    id, room_code: roomCode(), user_name: currentUser(), customer_name: customerName,
                    contact_number: contactNumber, delivery_address: deliveryAddress,
                    item_count: sum.quantity, grand_total: sum.amount, created_at: new Date().toISOString()
                });
                if (!error) {
                    saved = true;
                    break;
                }
                if (error.code !== "23505" || attempt === 7) throw error;
            }
            if (!saved) throw new Error("Could not reserve a unique order ID. Please try again.");
            const orderRows = cart.map((item) => ({
                id: createId(), order_id: id, name: item.name, quantity: item.quantity, price: item.price
            }));
            const { error: itemError } = await db.from("order_items").insert(orderRows);
            if (itemError) {
                await db.from("orders").delete().eq("id", id).eq("room_code", roomCode());
                throw itemError;
            }
            try {
                await addActivity("placed", id);
                sessionStorage.removeItem("cartShareOrderActivityError");
            } catch (activityError) {
                sessionStorage.setItem("cartShareOrderActivityError", activityError?.message || "Activity could not be saved.");
            }
            sessionStorage.setItem(LAST_ORDER_KEY, id);
            location.href = `order-confirmation.html?orderId=${encodeURIComponent(id)}`;
        } catch (error) {
            button.disabled = false;
            reportError(error, "Unable to place order");
        }
    }

    async function renderConfirmation() {
        const id = new URLSearchParams(location.search).get("orderId") || sessionStorage.getItem(LAST_ORDER_KEY);
        if (!id) {
            location.replace("cart.html");
            return;
        }
        try {
            const order = await loadOrder(id);
            if (!order) {
                reportError("This order could not be found in the current room.", "Unable to load order");
                return;
            }
            sessionStorage.setItem(LAST_ORDER_KEY, id);
            setText("confirmationOrderId", order.id);
            setText("confirmationCustomer", order.customer_name);
            setText("confirmationRoom", order.room_code);
            setText("confirmationDate", order.created_at ? new Date(order.created_at).toLocaleString() : "");
            setText("confirmationTotal", rupees(order.grand_total));
            const container = document.getElementById("confirmationItems");
            container.replaceChildren();
            order.items.forEach((item) => appendOrderItem(container, item));
            document.getElementById("viewOrderReceipt").href = `room.html?orderId=${encodeURIComponent(id)}`;
            const activityError = sessionStorage.getItem("cartShareOrderActivityError");
            if (activityError) {
                sessionStorage.removeItem("cartShareOrderActivityError");
                reportError(activityError, "Order placed, but activity logging failed");
            }
        } catch (error) {
            reportError(error, "Unable to load order");
        }
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

    async function initializeRoomPage() {
        if (!requireRoom()) return;
        subscribeToRoom();
        await renderRoomData();
        if (new URLSearchParams(location.search).has("orderId")) showRoomPanel("receiptPanel");
        document.querySelectorAll("[data-panel-target]").forEach((button) => button.addEventListener("click", () => showRoomPanel(button.dataset.panelTarget)));
        document.querySelectorAll("[data-close-panel]").forEach((button) => button.addEventListener("click", () => {
            document.querySelectorAll("[data-room-panel]").forEach((panel) => { panel.hidden = true; });
        }));
        document.getElementById("printReceipt")?.addEventListener("click", () => window.print());
    }

    async function initializeCartPage() {
        if (!requireRoom()) return;
        await renderRoomData();
        subscribeToRoom();
        document.getElementById("addItemForm")?.addEventListener("submit", handleAddItem);
        document.getElementById("cartItems")?.addEventListener("click", (event) => {
            const button = event.target.closest("[data-remove-item]");
            if (button) handleRemoveItem(button.dataset.removeItem);
        });
    }

    async function initializeCheckoutPage() {
        if (!requireRoom()) return;
        const db = getClient();
        if (!db) return;
        try {
            const { data, error } = await db.from("cart_items")
                .select("id, room_code, name, quantity, price, added_by, created_at")
                .eq("room_code", roomCode()).order("created_at", { ascending: true });
            if (error) throw error;
            state.cart = (data || []).map(mapCart);
            document.getElementById("customerName").value = currentUser();
            renderCheckoutSummary();
            document.getElementById("checkoutForm")?.addEventListener("submit", placeOrder);
            subscribeToRoom();
        } catch (error) {
            reportError(error, "Unable to load checkout");
        }
    }

    async function initializeConfirmationPage() {
        if (!requireRoom()) return;
        await renderConfirmation();
        subscribeToRoom();
    }

    async function refreshOrder(id) {
        try {
            let order = null;
            for (let attempt = 0; attempt < 5; attempt += 1) {
                order = await loadOrder(id);
                if (!order || order.items.length) break;
                await new Promise((resolve) => window.setTimeout(resolve, 250));
            }
            if (!order) return;
            if (document.getElementById("confirmationItems") && new URLSearchParams(location.search).get("orderId") === id) await renderConfirmation();
            if (document.getElementById("receiptItems")) await renderReceipt();
        } catch (error) {
            reportError(error, "Realtime order refresh failed");
        }
    }

    function subscribeToRoom() {
        const db = getClient();
        const code = roomCode();
        if (!db || !code || state.channel) return;
        const channel = db.channel(`cartshare-room-${code}-${participantId()}`);
        channel.on("postgres_changes", { event: "*", schema: "public", table: "cart_items", filter: `room_code=eq.${code}` }, () => {
            loadCart().catch((error) => reportError(error, "Realtime cart refresh failed"));
        });
        channel.on("postgres_changes", { event: "DELETE", schema: "public", table: "cart_items" }, () => {
            loadCart().catch((error) => reportError(error, "Realtime cart refresh failed"));
        });
        channel.on("postgres_changes", { event: "*", schema: "public", table: "participants", filter: `room_code=eq.${code}` }, () => {
            loadParticipants().catch((error) => reportError(error, "Realtime participant refresh failed"));
        });
        channel.on("postgres_changes", { event: "*", schema: "public", table: "activities", filter: `room_code=eq.${code}` }, () => {
            loadActivities().catch((error) => reportError(error, "Realtime activity refresh failed"));
        });
        channel.on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `room_code=eq.${code}` }, (payload) => {
            const id = payload.new?.id || payload.old?.id;
            if (id) window.setTimeout(() => refreshOrder(id), 350);
        });
        state.channel = channel;
        channel.subscribe((status) => {
            if (status === "SUBSCRIBED") {
                loadParticipants().catch((error) => reportError(error, "Unable to refresh room participants"));
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                reportError("Realtime subscription could not connect. Reload to retry.", "Live updates unavailable");
            }
        });
    }

    async function initializePage() {
        if (!getClient()) return;
        const page = document.body.dataset.page;
        if (page === "landing") initializeLandingPage();
        else if (page === "room") await initializeRoomPage();
        else if (page === "cart") await initializeCartPage();
        else if (page === "checkout") await initializeCheckoutPage();
        else if (page === "confirmation") await initializeConfirmationPage();
    }

    document.addEventListener("DOMContentLoaded", () => {
        initializePage().catch((error) => reportError(error, "Application startup failed"));
    });
})();
