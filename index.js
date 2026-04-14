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
    console.log("VAPI BODY:", JSON.stringify(req.body, null, 2));

    const message = req.body?.message || {};
    const toolCalls = message.toolCallList || message.toolCalls || [];

    if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
      return res.status(200).json({ ok: true });
    }

    const results = [];

    for (const toolCall of toolCalls) {
      const toolCallId = toolCall.id;
      const name = toolCall.name || toolCall.function?.name || "";

      let params = toolCall.parameters || {};
      if (
        (!params || Object.keys(params).length === 0) &&
        toolCall.function?.arguments
      ) {
        try {
          params = JSON.parse(toolCall.function.arguments);
        } catch {
          params = {};
        }
      }

      console.log("TOOL:", name, params);

      if (name === "get_menu") {
        const { data, error } = await supabase
          .from("menu")
          .select("name, price, category, available, description")
          .eq("available", true)
          .order("category", { ascending: true })
          .order("name", { ascending: true });

        if (error) {
          console.error("get_menu error:", error);
          results.push({
            toolCallId,
            result: "Menu is temporarily unavailable."
          });
          continue;
        }

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
        continue;
      }

      if (name === "get_menu_item") {
        const itemName = String(params.item_name || "").trim();

        if (!itemName) {
          results.push({
            toolCallId,
            result: "No item name was provided."
          });
          continue;
        }

        const { data, error } = await supabase
          .from("menu")
          .select("name, price, category, available, description")
          .ilike("name", itemName)
          .limit(1);

        if (error) {
          console.error("get_menu_item error:", error);
          results.push({
            toolCallId,
            result: "That item is temporarily unavailable."
          });
          continue;
        }

        const item = data?.[0];

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
        continue;
      }

      if (name === "create_order") {
        const requestedItems = Array.isArray(params.items) ? params.items : [];

        if (requestedItems.length === 0) {
          results.push({
            toolCallId,
            result: "No items were provided in the order."
          });
          continue;
        }

        const orderNumber = `ORD-${Date.now()}`;

        const { error } = await supabase.from("orders").insert([
          {
            order_number: orderNumber,
            caller_number: String(params.caller_number || ""),
            customer_name: String(params.customer_name || ""),
            customer_phone: String(params.customer_phone || ""),
            items_json: requestedItems,
            order_type: String(params.order_type || "pickup"),
            address: String(params.address || ""),
            notes: String(params.notes || ""),
            subtotal: Number(params.subtotal || 0),
            delivery_fee: Number(params.delivery_fee || 0),
            total: Number(params.total || 0),
            status: "new"
          }
        ]);

        if (error) {
          console.error("create_order error:", error);
          results.push({
            toolCallId,
            result: "Failed to save order."
          });
          continue;
        }

        results.push({
          toolCallId,
          result: `Order saved successfully. Order number: ${orderNumber}.`
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
