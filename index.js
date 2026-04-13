const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json({ limit: "5mb" }));

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  HUMAN_TRANSFER_NUMBER
} = process.env;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getAvailableMenu() {
  const { data, error } = await supabase
    .from("menu")
    .select("name, price, category, available")
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
  return (data && data[0]) || null;
}

function makeOrderNumber() {
  return `ORD-${Date.now()}`;
}

function formatItems(items) {
  if (!Array.isArray(items) || items.length === 0) return "No items";
  return items.map((item) => `- ${item.quantity} x ${item.name}`).join("\n");
}

async function getMenuItemsByNames(names) {
  if (!Array.isArray(names) || names.length === 0) return [];

  const { data, error } = await supabase
    .from("menu")
    .select("id, name, price, category, available")
    .in("name", names);

  if (error) {
    throw error;
  }

  return data || [];
}

app.post("/vapi", async (req, res) => {
  try {
    const msg = req.body?.message || {};
    const call = msg.call || {};

    if (msg.type === "tool-calls") {
      const toolCalls = msg.toolCallList || [];
      const results = [];

      for (const toolCall of toolCalls) {
        const name = toolCall.name;
        const p = toolCall.parameters || {};
        if (name === "get_menu") {
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
            .join("\n");

          results.push({
            toolCallId: toolCall.id,
            result: `Available menu items:\n${menuText}`
          });
          continue;
        }

        if (name === "get_menu_item") {
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

          results.push({
            toolCallId: toolCall.id,
            result:
              `${item.name} costs ${item.price}. ` +
              `${item.description ? "Description: " + item.description : ""}`
          });
          continue;
        }

        if (name === "create_order") {
          const requestedItems = Array.isArray(p.items) ? p.items : [];

          if (requestedItems.length === 0) {s
            results.push({
              toolCallId: toolCall.id,
              result: "No items were provided in the order."
            });
            continue;
          }

          const requestedNames = requestedItems.map((item) => item.name).filter(Boolean);
          const menuItems = await getMenuItemsByNames(requestedNames);

          const menuMap = new Map(
            menuItems.map((item) => [item.name.toLowerCase(), item])
          );

          const validatedItems = [];
          const invalidItems = [];

          for (const item of requestedItems) {
            const lookup = menuMap.get(String(item.name || "").toLowerCase());

            if (!lookup || !lookup.available) {
              invalidItems.push(item.name || "Unknown item");
              continue;
            }

            const quantity = Number(item.quantity || 0);

            validatedItems.push({
              name: lookup.name,
              quantity,
              unit_price: Number(lookup.price || 0),
              category: lookup.category
            });
          }

          if (invalidItems.length > 0) {
            results.push({
              toolCallId: toolCall.id,
              result: `These items are not available: ${invalidItems.join(", ")}`
            });
            continue;
          }

          const subtotal = validatedItems.reduce((sum, item) => {
            return sum + item.quantity * item.unit_price;
          }, 0);

          const deliveryFee = Number(p.delivery_fee || 0);
          const total = subtotal + deliveryFee;
          const orderNumber = makeOrderNumber();

          const { error } = await supabase.from("orders").insert([
            {
              order_number: orderNumber,
              caller_number: p.caller_number || call?.customer?.number || "",
              customer_name: p.customer_name || "",
              customer_phone: p.customer_phone || "",
              items_json: validatedItems,
              order_type: p.order_type || "pickup",
              address: p.address || "",
              notes: p.notes || "",
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

          results.push({
            toolCallId: toolCall.id,
            result:
              `Order saved successfully. ` +
              `Order number: ${orderNumber}. ` +
              `Items:\n${formatItems(validatedItems)}\n` +
              `Total: ${total}`
          });
        }

        if (name === "transfer_call") {
          const transferTo = p.transfer_to || HUMAN_TRANSFER_NUMBER || "";

          results.push({
            toolCallId: toolCall.id,
            result: transferTo
              ? `Transfer approved. Connect the caller to ${transferTo}.`
              : "No human transfer number is configured."
          });
        }
      }

      return res.status(200).json({ results });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(200).json({ ok: true });
  }
});



const twilio = require("twilio");


app.use(express.json({ limit: "2mb" }));

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  NOTIFY_TO_NUMBER
} = process.env;

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

function getTranscriptText(msg, call) {
  const possibleTranscript =
    msg?.transcript ||
    call?.transcript ||
    msg?.artifact?.transcript ||
    call?.artifact?.transcript ||
    msg?.analysis?.transcript ||
    call?.analysis?.transcript ||
    "";

  if (typeof possibleTranscript === "string") {
    return possibleTranscript.trim();
  }

  if (Array.isArray(possibleTranscript)) {
    return possibleTranscript
      .map((item) => {
        if (typeof item === "string") return item;
        const speaker = item?.role || item?.speaker || "Speaker";
        const text = item?.text || item?.message || item?.content || "";
        return text ? `${speaker}: ${text}` : "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  return "";
}

function getSummaryText(msg, call) {
  const possibleSummary =
    msg?.summary ||
    call?.summary ||
    msg?.analysis?.summary ||
    call?.analysis?.summary ||
    msg?.artifact?.summary ||
    call?.artifact?.summary ||
    "";

  if (typeof possibleSummary === "string") {
    return possibleSummary.trim();
  }

  return "";
}

app.post("/vapi", async (req, res) => {
  try {
    const msg = req.body?.message || {};
    const call = msg.call || {};

    if (msg.type === "status-update" || msg.type === "end-of-call-report") {
      const status = msg.status || call.status || msg.type;
      const caller = call?.customer?.number || "unknown";
      const toNumber = call?.phoneNumber?.number || "unknown";
      const callId = call?.id || "unknown";

      const summary = getSummaryText(msg, call);
      const transcript = getTranscriptText(msg, call);

      let text =
        `Vapi call event:\n` +
        `Type: ${msg.type}\n` +
        `Status: ${status}\n` +
        `From: ${caller}\n` +
        `To: ${toNumber}\n` +
        `CallId: ${callId}`;

      if (summary) {
        text += `\n\nSummary:\n${summary}`;
      }

      if (transcript) {
        const shortTranscript =
          transcript.length > 1200
            ? transcript.slice(0, 1200) + "\n...[truncated]"
            : transcript;

        text += `\n\nTranscript:\n${shortTranscript}`;
      }

      await client.messages.create({
        from: "whatsapp:+14155238886",
        to: "whatsapp:" + NOTIFY_TO_NUMBER,
        body: text
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(200).json({ ok: true });
  }
});

app.get("/", (_, res) => res.send("ok"));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on ${port}`));
// force update