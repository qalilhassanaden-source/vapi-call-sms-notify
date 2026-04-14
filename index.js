const express = require("express");
const twilio = require("twilio");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json({ limit: "5mb" }));

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  NOTIFY_TO_NUMBER
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const hasTwilio =
  Boolean(TWILIO_ACCOUNT_SID) &&
  Boolean(TWILIO_AUTH_TOKEN) &&
  Boolean(NOTIFY_TO_NUMBER);

const twilioClient = hasTwilio
  ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
  : null;

function makeOrderNumber() {
  return `ORD-${Date.now()}`;
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function formatItemsSingleLine(items) {
  if (!Array.isArray(items) || items.length === 0) return "No items";
  return items
    .map((item) => `${Number(item.quantity || 0)} x ${item.name}`)
    .join(", ");
}

function getTranscriptText(msg, call) {
  return (
    msg?.transcript ||
    call?.transcript ||
    msg?.artifact?.transcript ||
    call?.artifact?.transcript ||
    msg?.analysis?.transcript ||
    call?.analysis?.transcript ||
    ""
  );
}

function getSummaryText(msg, call) {
  return (
    msg?.summary ||
    call?.summary ||
    msg?.analysis?.summary ||
    call?.analysis?.summary ||
    ""
  );
}

async function getAvailableMenu() {
  const { data, error } = await supabase
    .from("menu")
    .select("name, price, category, available, description")
    .eq("available", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function getSingleMenuItem(itemName) {
  const { data, error } = await supabase
    .from("menu")
    .select("name, price, category, available, description")
    .ilike("name", itemName)
    .limit(1);

  if (error) throw error;
  return data?.[0] || null;
}

async function getMenuItemsByNames(names) {
  if (!Array.isArray(names) || names.length === 0) return [];

  const cleanedNames = names
    .map((name) => String(name || "").trim())
    .filter(Boolean);

  if (cleanedNames.length === 0) return [];

  const { data, error } = await supabase
    .from("menu")
    .select("name, price, category, available, description")
    .in("name", cleanedNames);

  if (error) throw error;
  return data || [];
}

async function sendWhatsAppNotification(body) {
  if (!twilioClient || !NOTIFY_TO_NUMBER) return;

  await twilioClient.messages.create({
    from: "whatsapp:+14155238886",
    to: `whatsapp:${NOTIFY_TO_NUMBER}`,
    body
  });
}

app.post("/vapi", async (req, res) => {
  try {
    const msg = req.body?.message || {};
    const call = msg?.call || {};

    if (msg.type === "end-of-call-report") {
      const callerNumber =
        call?.customer?.number ||
        call?.phoneNumber ||
        msg?.customer?.number ||
        "";

      const customerName =
        call?.customer?.name ||
        msg?.customer?.name ||
        "";

      const summary = getSummaryText(msg, call);
      const transcript = getTranscriptText(msg, call);

      const { error } = await supabase.from("calls").insert([
        {
          caller_number: callerNumber,
          customer_name: customerName,
          summary,
          transcript,
          status: "completed"
        }
      ]);

      if (error) {
        console.error("Calls insert error:", error);
      }

      return res.status(200).json({ ok: true });
    }

    if (msg.type === "tool-calls") {
      const toolCalls = msg.toolCallList || [];
      const results = [];

      for (const toolCall of toolCalls) {
        const name = toolCall.name;
        const p = toolCall.parameters || {};

        if (name === "get_menu") {
          try {
            const menuItems = await getAvailableMenu();

            if (menuItems.length === 0) {
              results.push({
                toolCallId: toolCall.id,
                result: "No menu items are currently available."
              });
              continue;
            }

            const menuText = menuItems
              .map((item) => `${item.name} - ${item.price}`)
              .join(", ");

            results.push({
              toolCallId: toolCall.id,
              result: `Available menu items: ${menuText}`
            });
          } catch (error) {
            console.error("get_menu error:", error);
            results.push({
              toolCallId: toolCall.id,
              result: "Menu is temporarily unavailable right now."
            });
          }
          continue;
        }

        if (name === "get_menu_item") {
          try {
            const itemName = String(p.item_name || "").trim();

            if (!itemName) {
              results.push({
                toolCallId: toolCall.id,
                result: "No item name was provided."
              });
              continue;
            }

            const item = await getSingleMenuItem(itemName);

            if (!item || !item.available) {
              results.push({
                toolCallId: toolCall.id,
                result: `${itemName} is not available on the menu.`
              });
              continue;
            }

            const descriptionText = item.description
              ? ` Description: ${item.description}`
              : "";

            results.push({
              toolCallId: toolCall.id,
              result: `${item.name} costs ${item.price}.${descriptionText}`
            });
          } catch (error) {
            console.error("get_menu_item error:", error);
            results.push({
              toolCallId: toolCall.id,
              result: "That menu item is temporarily unavailable right now."
            });
          }
          continue;
        }

        if (name === "create_order") {
          try {
            const requestedItems = Array.isArray(p.items) ? p.items : [];

            if (requestedItems.length === 0) {
              results.push({
                toolCallId: toolCall.id,
                result: "No items were provided in the order."
              });
              continue;
            }

            const requestedNames = requestedItems
              .map((item) => item.name)
              .filter(Boolean);

            const menuItems = await getMenuItemsByNames(requestedNames);

            const menuMap = new Map(
              menuItems.map((item) => [normalizeName(item.name), item])
            );

            const validatedItems = [];
            const invalidItems = [];

            for (const item of requestedItems) {
              const found = menuMap.get(normalizeName(item.name));

              if (!found || !found.available) {
                invalidItems.push(item.name || "Unknown item");
                continue;
              }

              const quantity = Number(item.quantity || 0);

              if (!Number.isFinite(quantity) || quantity <= 0) {
                invalidItems.push(item.name || "Unknown item");
                continue;
              }

              validatedItems.push({
                name: found.name,
                quantity,
                unit_price: Number(found.price || 0),
                category: found.category
              });
            }

            if (invalidItems.length > 0) {
              results.push({
                toolCallId: toolCall.id,
                result: `These items are not available or invalid: ${invalidItems.join(", ")}`
              });
              continue;
            }

            const subtotal = validatedItems.reduce((sum, item) => {
              return sum + item.quantity * item.unit_price;
            }, 0);

            const deliveryFee = Number(p.delivery_fee || 0);
            const total = subtotal + deliveryFee;
            const orderNumber = makeOrderNumber();

            const callerNumber =
              p.caller_number ||
              call?.customer?.number ||
              "";

            const customerName = String(p.customer_name || "").trim();
            const customerPhone = String(p.customer_phone || "").trim();
            const orderType = String(p.order_type || "pickup").trim();
            const address = String(p.address || "").trim();
            const notes = String(p.notes || "").trim();

            const { error } = await supabase.from("orders").insert([
              {
                order_number: orderNumber,
                caller_number: callerNumber,
                customer_name: customerName,
                customer_phone: customerPhone,
                items_json: validatedItems,
                order_type: orderType,
                address,
                notes,
                subtotal,
                delivery_fee: deliveryFee,
                total,
                status: "new"
              }
            ]);

            if (error) {
              console.error("Order insert error:", error);
              results.push({
                toolCallId: toolCall.id,
                result: "Failed to save order. Please try again."
              });
              continue;
            }

            const notification =
              `🍔 NEW ORDER ${orderNumber}\n\n` +
              `Customer: ${customerName || "Unknown"}\n` +
              `Phone: ${customerPhone || callerNumber || "Unknown"}\n` +
              `Type: ${orderType}\n` +
              `Items: ${formatItemsSingleLine(validatedItems)}\n` +
              `Address: ${address || "-"}\n` +
              `Notes: ${notes || "-"}\n` +
              `Subtotal: ${subtotal}\n` +
              `Delivery Fee: ${deliveryFee}\n` +
              `Total: ${total}`;

            try {
              await sendWhatsAppNotification(notification);
            } catch (notifyError) {
              console.error("WhatsApp notification error:", notifyError);
            }

            results.push({
              toolCallId: toolCall.id,
              result: `Order saved successfully. Order number: ${orderNumber}. Items: ${formatItemsSingleLine(validatedItems)}. Total: ${total}`
            });
          } catch (error) {
            console.error("create_order error:", error);
            results.push({
              toolCallId: toolCall.id,
              result: "There was a problem saving the order."
            });
          }
          continue;
        }

        results.push({
          toolCallId: toolCall.id,
          result: `Unknown tool: ${name}`
        });
      }

      return res.status(200).json({ results });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(200).json({ ok: true });
  }
});

app.post("/vapi", async (req, res) => {
  try {
    const toolCalls = req.body?.message?.toolCalls;

    if (!toolCalls) {
      return res.json({});
    }

    const results = [];

    for (const toolCall of toolCalls) {
      const name = toolCall.function.name;

      if (name === "get_menu") {
        const { data } = await supabase
          .from("menu")
          .select("*")
          .eq("available", true);

        results.push({
          toolCallId: toolCall.id,
          result: { menu: data }
        });
      }

      if (name === "create_order") {
        await supabase.from("orders").insert([{
          order_number: "ORD-" + Date.now()
        }]);

        results.push({
          toolCallId: toolCall.id,
          result: { success: true }
        });
      }
    }

    return res.json({ results });

  } catch (err) {
    console.error(err);
    return res.json({ results: [] });
  }
});

app.get("/", (_, res) => res.send("ok"));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Listening on ${port}`);
});