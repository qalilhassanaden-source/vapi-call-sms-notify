const fs = require("fs");
const path = require("path");
const express = require("express");
const twilio = require("twilio");
const { createClient } = require("@supabase/supabase-js");

loadLocalEnv();

const app = express();
app.use(express.json({ limit: "5mb" }));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const DEFAULT_TWILIO_WHATSAPP_FROM = "whatsapp:+14155238886";
const DEFAULT_NOTIFY_TO_NUMBER = "+254746601060";
const DEFAULT_HUMAN_TRANSFER_NUMBER = "+254746601060";

const TWILIO_WHATSAPP_FROM =
  process.env.TWILIO_WHATSAPP_FROM || DEFAULT_TWILIO_WHATSAPP_FROM;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER || "";
const NOTIFY_TO_NUMBER =
  process.env.NOTIFY_TO_NUMBER || DEFAULT_NOTIFY_TO_NUMBER;
const NOTIFY_CHANNEL = String(process.env.NOTIFY_CHANNEL || "whatsapp")
  .trim()
  .toLowerCase();
const HUMAN_TRANSFER_NUMBER = normalizePhone(
  process.env.HUMAN_TRANSFER_NUMBER || DEFAULT_HUMAN_TRANSFER_NUMBER
);

const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);
const supabase = hasSupabase ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const hasTwilio =
  Boolean(TWILIO_ACCOUNT_SID) &&
  Boolean(TWILIO_AUTH_TOKEN) &&
  Boolean(NOTIFY_TO_NUMBER) &&
  (NOTIFY_CHANNEL === "whatsapp" || Boolean(TWILIO_FROM_NUMBER));

const twilioClient = hasTwilio
  ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
  : null;

function loadLocalEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizePhone(value) {
  return String(value || "").trim().replace(/[^\d+]/g, "");
}

function isLikelyE164(value) {
  return /^\+[1-9]\d{6,14}$/.test(normalizePhone(value));
}

function makeOrderNumber() {
  return `ORD-${Date.now()}`;
}

function getToolCallsFromBody(body) {
  const message = body?.message || {};
  if (Array.isArray(message.toolCallList)) return message.toolCallList;
  if (Array.isArray(message.toolCalls)) return message.toolCalls;
  if (message.toolCall) return [message.toolCall];
  return [];
}

function getToolCallId(toolCall) {
  return toolCall?.id || toolCall?.toolCallId || toolCall?.callId || "";
}

function getToolName(toolCall) {
  return (
    toolCall?.name ||
    toolCall?.function?.name ||
    toolCall?.tool?.function?.name ||
    toolCall?.tool?.name ||
    ""
  );
}

function parseMaybeJson(value) {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string") return {};

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function getToolParams(toolCall) {
  if (toolCall?.parameters) return parseMaybeJson(toolCall.parameters);
  if (toolCall?.arguments) return parseMaybeJson(toolCall.arguments);
  if (toolCall?.function?.arguments) {
    return parseMaybeJson(toolCall.function.arguments);
  }
  if (toolCall?.tool?.function?.arguments) {
    return parseMaybeJson(toolCall.tool.function.arguments);
  }
  return {};
}

function formatItemsSingleLine(items) {
  if (!Array.isArray(items) || items.length === 0) return "No items";
  return items
    .map((item) => `${Number(item.quantity || 0)} x ${item.name}`)
    .join(", ");
}

function formatMoney(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toFixed(2) : "0.00";
}

function truncateText(value, maxLength) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

function extractCallerNumber(body) {
  return normalizePhone(
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

function getControlUrl(body) {
  const call = body?.message?.call || {};
  return (
    call?.monitor?.controlUrl ||
    call?.controlUrl ||
    body?.message?.monitor?.controlUrl ||
    ""
  );
}

function ensureSupabase() {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
}

async function getAvailableMenu() {
  ensureSupabase();

  const { data, error } = await supabase
    .from("menu")
    .select("id, name, price, category, available, description")
    .eq("available", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

function findMenuItemByName(menuItems, itemName) {
  const requestedName = normalizeName(itemName);
  if (!requestedName) return null;

  const exact = menuItems.find(
    (item) => normalizeName(item.name) === requestedName
  );
  if (exact) return exact;

  const partialMatches = menuItems.filter((item) =>
    normalizeName(item.name).includes(requestedName)
  );

  return partialMatches.length === 1 ? partialMatches[0] : null;
}

async function getSingleMenuItem(itemName) {
  const menuItems = await getAvailableMenu();
  return findMenuItemByName(menuItems, itemName);
}

async function getMenuItemsByNames(names) {
  if (!Array.isArray(names) || names.length === 0) return new Map();

  const menuItems = await getAvailableMenu();
  const menuMap = new Map();

  for (const name of names) {
    const found = findMenuItemByName(menuItems, name);
    if (found) menuMap.set(normalizeName(name), found);
  }

  return menuMap;
}

function getNotificationAddress() {
  if (NOTIFY_CHANNEL === "whatsapp") {
    return toWhatsAppAddress(NOTIFY_TO_NUMBER);
  }

  return NOTIFY_TO_NUMBER;
}

function toWhatsAppAddress(value) {
  const address = String(value || "").trim();
  if (address.toLowerCase().startsWith("whatsapp:")) return address;
  return `whatsapp:${normalizePhone(address)}`;
}

async function sendOrderNotification(body) {
  if (!twilioClient) {
    console.warn("Twilio notification skipped: missing Twilio configuration.");
    return { sent: false, reason: "missing Twilio configuration" };
  }

  const from =
    NOTIFY_CHANNEL === "whatsapp"
      ? toWhatsAppAddress(TWILIO_WHATSAPP_FROM)
      : TWILIO_FROM_NUMBER;
  const to = getNotificationAddress();

  const message = await twilioClient.messages.create({
    from,
    to,
    body
  });

  console.log("Notification sent:", {
    channel: NOTIFY_CHANNEL,
    sid: message.sid,
    status: message.status,
    to
  });

  return { sent: true, sid: message.sid, status: message.status };
}

async function sendCallSummaryNotification({ callerNumber, customerName, summary, transcript }) {
  const summaryText =
    truncateText(summary, 1200) ||
    truncateText(transcript, 1200) ||
    "No summary or transcript was provided by Vapi.";

  const transcriptText = transcript
    ? `\n\nTranscript preview:\n${truncateText(transcript, 1800)}`
    : "";

  const notification =
    `CALL SUMMARY\n\n` +
    `Customer: ${customerName || "Unknown"}\n` +
    `Phone: ${callerNumber || "Unknown"}\n\n` +
    `Summary:\n${summaryText}` +
    transcriptText;

  return sendOrderNotification(notification);
}

async function executeLiveTransfer(body, department) {
  const controlUrl = getControlUrl(body);

  if (!controlUrl) {
    return false;
  }

  const url = controlUrl.endsWith("/control")
    ? controlUrl
    : `${controlUrl.replace(/\/$/, "")}/control`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "transfer",
      destination: {
        type: "number",
        number: HUMAN_TRANSFER_NUMBER
      },
      content: department
        ? `Transferring you to ${department} now.`
        : "Transferring you now."
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Vapi transfer failed: ${response.status} ${text}`);
  }

  return true;
}

function getConfigStatus() {
  const twilioWarnings = [];

  if (TWILIO_ACCOUNT_SID && !/^AC[a-f0-9]{32}$/i.test(TWILIO_ACCOUNT_SID)) {
    twilioWarnings.push("TWILIO_ACCOUNT_SID format looks invalid.");
  }

  if (TWILIO_AUTH_TOKEN && !/^[a-f0-9]{32}$/i.test(TWILIO_AUTH_TOKEN)) {
    twilioWarnings.push("TWILIO_AUTH_TOKEN should be exactly 32 hex characters.");
  }

  return {
    supabase: {
      configured: hasSupabase,
      missing: [
        !SUPABASE_URL ? "SUPABASE_URL" : null,
        !SUPABASE_KEY ? "SUPABASE_SERVICE_ROLE_KEY" : null
      ].filter(Boolean)
    },
    twilio: {
      configured: hasTwilio,
      channel: NOTIFY_CHANNEL,
      missing: [
        !TWILIO_ACCOUNT_SID ? "TWILIO_ACCOUNT_SID" : null,
        !TWILIO_AUTH_TOKEN ? "TWILIO_AUTH_TOKEN" : null,
        !NOTIFY_TO_NUMBER ? "NOTIFY_TO_NUMBER" : null,
        NOTIFY_CHANNEL !== "whatsapp" && !TWILIO_FROM_NUMBER
          ? "TWILIO_FROM_NUMBER"
          : null
      ].filter(Boolean),
      warnings: twilioWarnings
    },
    transfer: {
      configured: isLikelyE164(HUMAN_TRANSFER_NUMBER),
      missing: !HUMAN_TRANSFER_NUMBER ? ["HUMAN_TRANSFER_NUMBER"] : [],
      warning:
        HUMAN_TRANSFER_NUMBER && !isLikelyE164(HUMAN_TRANSFER_NUMBER)
          ? "HUMAN_TRANSFER_NUMBER should be E.164 format, like +15551234567."
          : ""
    }
  };
}

app.post("/vapi", async (req, res) => {
  try {
    console.log("VAPI MESSAGE TYPE:", req.body?.message?.type || "unknown");

    const message = req.body?.message || {};
    const msgType = message?.type || "";

    if (msgType === "transfer-destination-request") {
      if (!isLikelyE164(HUMAN_TRANSFER_NUMBER)) {
        console.error("Transfer requested, but HUMAN_TRANSFER_NUMBER is missing or invalid.");
        return res.status(200).json({
          message: {
            type: "request-start",
            message:
              "I am sorry, the transfer line is not configured right now."
          }
        });
      }

      return res.status(200).json({
        destination: {
          type: "number",
          number: HUMAN_TRANSFER_NUMBER
        },
        message: {
          type: "request-start",
          message: "Transferring you now."
        }
      });
    }

    if (msgType === "status-update" || msgType === "end-of-call-report") {
      try {
        const callerNumber = extractCallerNumber(req.body);
        const customerName = extractCustomerName(req.body);
        const summary = extractSummary(req.body);
        const transcript = extractTranscript(req.body);

        if (supabase) {
          const { error } = await supabase.from("calls").insert([
            {
              caller_number: callerNumber,
              customer_name: customerName,
              summary,
              transcript,
              status:
                msgType === "status-update" ? "status-update" : "completed"
            }
          ]);

          if (error) {
            console.error("calls insert error:", error);
          }
        } else {
          console.warn("Call log skipped: Supabase is not configured.");
        }

        if (msgType === "end-of-call-report") {
          try {
            await sendCallSummaryNotification({
              callerNumber,
              customerName,
              summary,
              transcript
            });
          } catch (notifyError) {
            console.error("call summary notification error:", {
              reason: notifyError.message || String(notifyError),
              code: notifyError.code,
              status: notifyError.status
            });
          }
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
      const toolCallId = getToolCallId(toolCall);
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
            .map((item) => `${item.name} - ${formatMoney(item.price)}`)
            .join(", ");

          results.push({
            toolCallId,
            result: `Available menu items: ${menuText}`
          });
        } catch (error) {
          console.error("get_menu error:", error);
          results.push({
            toolCallId,
            result:
              "Menu is temporarily unavailable. Please ask the caller to try again soon."
          });
        }
        continue;
      }

      if (name === "get_menu_item") {
        try {
          const itemName = String(
            params.item_name || params.itemName || params.name || ""
          ).trim();

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
            result: `${item.name} costs ${formatMoney(item.price)}.${descriptionText}`
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
              result:
                "No items were provided in the order. Ask the caller which menu items and quantities they want."
            });
            continue;
          }

          const requestedNames = requestedItems
            .map((item) => item.name || item.item_name || item.itemName)
            .filter(Boolean);

          const menuMap = await getMenuItemsByNames(requestedNames);

          const validatedItems = [];
          const invalidItems = [];

          for (const item of requestedItems) {
            const rawName = item.name || item.item_name || item.itemName;
            const found = menuMap.get(normalizeName(rawName));

            if (!found || !found.available) {
              invalidItems.push(rawName || "Unknown item");
              continue;
            }

            const quantity = Number(item.quantity || item.qty || 0);

            if (!Number.isInteger(quantity) || quantity <= 0) {
              invalidItems.push(`${rawName || "Unknown item"} quantity`);
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
              result: `These items are not available or invalid: ${invalidItems.join(", ")}. Confirm the item names from the current menu before saving the order.`
            });
            continue;
          }

          const subtotal = validatedItems.reduce((sum, item) => {
            return sum + item.quantity * item.unit_price;
          }, 0);

          const deliveryFee = Number(params.delivery_fee || params.deliveryFee || 0);
          const safeDeliveryFee = Number.isFinite(deliveryFee) ? deliveryFee : 0;
          const total = subtotal + safeDeliveryFee;
          const orderNumber = makeOrderNumber();

          const callerNumber =
            normalizePhone(params.caller_number || params.callerNumber || "") ||
            extractCallerNumber(req.body);

          const customerName = String(
            params.customer_name || params.customerName || extractCustomerName(req.body)
          ).trim();

          const customerPhone =
            normalizePhone(
              params.customer_phone ||
                params.customerPhone ||
                params.phone ||
                ""
            ) || callerNumber;

          const orderType = String(
            params.order_type || params.orderType || "pickup"
          ).trim();
          const address = String(params.address || "").trim();
          const notes = String(params.notes || params.note || "").trim();

          ensureSupabase();

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
              delivery_fee: safeDeliveryFee,
              total,
              status: "new"
            }
          ]);

          if (error) {
            console.error("create_order insert error:", error);
            results.push({
              toolCallId,
              result:
                "Failed to save the order because the order database rejected it. Please confirm all required order fields are configured."
            });
            continue;
          }

          const notification =
            `NEW ORDER ${orderNumber}\n\n` +
            `Customer: ${customerName || "Unknown"}\n` +
            `Phone: ${customerPhone || "Unknown"}\n` +
            `Type: ${orderType}\n` +
            `Items: ${formatItemsSingleLine(validatedItems)}\n` +
            `Address: ${address || "-"}\n` +
            `Notes: ${notes || "-"}\n` +
            `Subtotal: ${formatMoney(subtotal)}\n` +
            `Delivery Fee: ${formatMoney(safeDeliveryFee)}\n` +
            `Total: ${formatMoney(total)}`;

          let notificationResult = { sent: false, reason: "not attempted" };

          try {
            notificationResult = await sendOrderNotification(notification);
          } catch (notifyError) {
            notificationResult = {
              sent: false,
              reason: notifyError.message || String(notifyError),
              code: notifyError.code,
              status: notifyError.status
            };
            console.error("notification error:", notificationResult);
          }

          results.push({
            toolCallId,
            result: `Order saved successfully. Order number: ${orderNumber}. Items: ${formatItemsSingleLine(validatedItems)}. Total: ${formatMoney(total)}. Notification sent: ${notificationResult.sent ? "yes" : "no"}`
          });
        } catch (error) {
          console.error("create_order error:", error);
          results.push({
            toolCallId,
            result:
              "There was a problem saving the order. Please ask the caller to repeat the order or transfer them to a person."
          });
        }
        continue;
      }

      if (name === "transfer_call" || name === "transferCall") {
        if (!isLikelyE164(HUMAN_TRANSFER_NUMBER)) {
          results.push({
            toolCallId,
            result:
              "No valid human transfer number is configured. HUMAN_TRANSFER_NUMBER must look like +15551234567."
          });
          continue;
        }

        try {
          const transferred = await executeLiveTransfer(
            req.body,
            params.department || params.reason || ""
          );

          results.push({
            toolCallId,
            result: transferred
              ? "Transfer started successfully."
              : `Transfer approved. Use ${HUMAN_TRANSFER_NUMBER} as the transfer destination.`
          });
        } catch (error) {
          console.error("transfer_call error:", error);
          results.push({
            toolCallId,
            result:
              "Transfer failed on the phone system. Apologize to the caller and offer to take a message."
          });
        }
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
    return res.status(200).json({
      results: [],
      error: "Webhook handler failed before a tool response could be built."
    });
  }
});

app.get("/test-menu", async (_, res) => {
  try {
    const data = await getAvailableMenu();
    return res.status(200).json({ data, error: null });
  } catch (err) {
    return res.status(500).json({ data: null, error: String(err.message || err) });
  }
});

app.get("/health", (_, res) => {
  res.status(200).json({
    ok: true,
    config: getConfigStatus()
  });
});

app.get("/", (_, res) => res.send("ok"));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Listening on ${port}`);
  console.log("Config status:", JSON.stringify(getConfigStatus(), null, 2));
});
