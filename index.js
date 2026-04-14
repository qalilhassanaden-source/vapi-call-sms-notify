const express = require("express");
const twilio = require("twilio");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json({ limit: "5mb" }));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const NOTIFY_TO_NUMBER = process.env.NOTIFY_TO_NUMBER;
const HUMAN_TRANSFER_NUMBER = process.env.HUMAN_TRANSFER_NUMBER || "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE key");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const hasTwilio =
  Boolean(TWILIO_ACCOUNT_SID) &&
  Boolean(TWILIO_AUTH_TOKEN) &&
  Boolean(NOTIFY_TO_NUMBER);

const twilioClient = hasTwilio
  ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
  : null;

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function makeOrderNumber() {
  return `ORD-${Date.now()}`;
}

function getToolCallsFromBody(body) {
  const message = body?.message || {};
  return message.toolCallList || message.toolCalls || [];
}

function getToolName(toolCall) {
  return toolCall?.name || toolCall?.function?.name || "";
}

function getToolParams(toolCall) {
  if (toolCall?.parameters) return toolCall.parameters;
  if (toolCall?.function?.arguments) {
    try {
      return JSON.parse(toolCall.function.arguments);
    } catch {
      return {};
    }
  }
  return {};
}

function formatItemsSingleLine(items) {
  if (!Array.isArray(items) || items.length === 0) return "No items";
  return items
    .map((item) => `${Number(item.quantity || 0)} x ${item.name}`)
    .join(", ");
}

function extractCallerNumber(body) {
  return (
    body?.message?.call?.customer?.number ||
    body?.message?.call?.phoneNumber ||
    body?.message?.customer?.number ||
    body?.message?.customer?.phoneNumber ||
    ""
  );
}

function extractCustomerName(body) {
  return (
    body?.message?.call?.customer?.name ||
    body?.message?.customer?.name ||
    ""
  );
}

function extractSummary(body) {
  const msg = body?.message || {};
  const call = msg?.call || {};
  return (
    msg?.summary ||
    call?.summary ||
    msg?.analysis?.summary ||
    call?.analysis?.summary ||
    ""
  );
}

function extractTranscript(body) {
  const msg = body?.message || {};
  const call = msg?.call || {};
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

async function getAvailableMenu() {
  const { data, error } = await supabase
    .from("menu")
    .select("id, name, price, category, available, description")
    .eq("available", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function getSingleMenuItem(itemName) {
  const { data, error } = await supabase
    .from("menu")
    .select("id, name, price, category, available, description")
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
    .select("id, name, price, category, available, description")
    .in("name", cleanedNames);

  if (error) throw error;
  return data || [];
}

async function sendWhatsAppNotification(body) {
  if (!twilioClient) return;

  await twilioClient.messages.create({
    from: "whatsapp:+14155238886",
    to: `whatsapp:${NOTIFY_TO_NUMBER}`,
    body
  });
}

app.post("/vapi", async (req, res) => {
  try {
    console.log("VAPI BODY:", JSON.stringify(req.body, null, 2));

    const message = req.body?.message || {};
    const msgType = message?.type || "";

    if (msgType === "status-update" || msgType === "end-of-call-report") {
      try {
        const callerNumber = extractCallerNumber(req.body);
        const customerName = extractCustomerName(req.body);
        const summary = extractSummary(req.body);
        const transcript = extractTranscript(req.body);

        const { error } = await supabase.from("calls").insert([
          {
            caller_number: callerNumber,
            customer_name: customerName,
            summary,
            transcript,
            status: msgType === "status-update" ? "status-update" : "completed"
          }
        ]);

        if (error) {
          console.error("calls insert error:", error);
        }
      } catch (err) {
        console.error("calls logging error:", err);
      }

      return res.status(200).json({ ok: true });
    }

    const toolCalls = getToolCallsFromBody(req.body);

    if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
      return res.status(200).json({ ok: true });
    }

    const results = [];

    for (const toolCall of toolCalls) {
      const toolCallId = toolCall.id;
      const name = getToolName(toolCall);
      const params = getToolParams(toolCall);

      console.log("TOOL:", name, params);

      if (name === "get_menu") {
        try {
          const data = await getAvailableMenu();

          if (!data || data.length === 0) {
            results.push({
              toolCallId,
              result: "No menu items are currently available."
            });
            continue;
          }

          const menuText = data
            .map((item) => `${item.name} - ${item.price}`)
            .join(", ");

          results.push({
            toolCallId,
            result: `Available menu items: ${menuText}`
          });
        } catch (error) {
          console.error("get_menu error:", error);
          results.push({
            toolCallId,
            result: "Menu is temporarily unavailable right now."
          });
        }
        continue;
      }

      if (name === "get_menu_item") {
        try {
          const itemName = String(params.item_name || "").trim();

          if (!itemName) {
            results.push({
              toolCallId,
              result: "No item name was provided."
            });
            continue;
          }

          const item = await getSingleMenuItem(itemName);

          if (!item || !item.available) {
            results.push({
              toolCallId,
              result: `${itemName} is not available on the menu.`
            });
            continue;
          }

          const descriptionText = item.description
            ? ` Description: ${item.description}`
            : "";

          results.push({
            toolCallId,
            result: `${item.name} costs ${item.price}.${descriptionText}`
          });
        } catch (error) {
          console.error("get_menu_item error:", error);
          results.push({
            toolCallId,
            result: "That menu item is temporarily unavailable right now."
          });
        }
        continue;
      }

      if (name === "create_order") {
        try {
          const requestedItems = Array.isArray(params.items) ? params.items : [];

          if (requestedItems.length === 0) {
            results.push({
              toolCallId,
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
              toolCallId,
              result: `These items are not available or invalid: ${invalidItems.join(", ")}`
            });
            continue;
          }

          const subtotal = validatedItems.reduce((sum, item) => {
            return sum + item.quantity * item.unit_price;
          }, 0);

          const deliveryFee = Number(params.delivery_fee || 0);
          const total = subtotal + deliveryFee;
          const orderNumber = makeOrderNumber();

          const callerNumber =
            String(params.caller_number || "").trim() || extractCallerNumber(req.body);

          const customerName =
            String(params.customer_name || "").trim() || extractCustomerName(req.body);

          const customerPhone =
            String(params.customer_phone || "").trim() || callerNumber;

          const orderType = String(params.order_type || "pickup").trim();
          const address = String(params.address || "").trim();
          const notes = String(params.notes || "").trim();

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
            console.error("create_order insert error:", error);
            results.push({
              toolCallId,
              result: "Failed to save order. Please try again."
            });
            continue;
          }

          const notification =
            `🍔 NEW ORDER ${orderNumber}\n\n` +
            `Customer: ${customerName || "Unknown"}\n` +
            `Phone: ${customerPhone || "Unknown"}\n` +
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
            toolCallId,
            result: `Order saved successfully. Order number: ${orderNumber}. Items: ${formatItemsSingleLine(validatedItems)}. Total: ${total}`
          });
        } catch (error) {
          console.error("create_order error:", error);
          results.push({
            toolCallId,
            result: "There was a problem saving the order."
          });
        }
        continue;
      }

      if (name === "transfer_call") {
        results.push({
          toolCallId,
          result: HUMAN_TRANSFER_NUMBER
            ? `Transfer approved. Connect the caller to ${HUMAN_TRANSFER_NUMBER}.`
            : "No human transfer number is configured."
        });
        continue;
      }

      results.push({
        toolCallId,
        result: `Unknown tool: ${name}`
      });
    }

    return res.status(200).json({ results });
  } catch (err) {
    console.error("VAPI ROUTE ERROR:", err);
    return res.status(200).json({ results: [] });
  }
});

app.get("/test-menu", async (_, res) => {
  try {
    const { data, error } = await supabase
      .from("menu")
      .select("*")
      .eq("available", true);

    return res.status(200).json({ data, error });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

app.get("/", (_, res) => res.send("ok"));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Listening on ${port}`);
});
