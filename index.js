const express = require("express");
const twilio = require("twilio");

const app = express();
app.use(express.json({ limit: "2mb" }));

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER,
  NOTIFY_TO_NUMBER
} = process.env;

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

app.post("/vapi", async (req, res) => {
  try {
    const msg = req.body?.message || {};

    if (msg.type === "status-update") {
      const call = msg.call || {};
      const status = msg.status || call.status;
      const caller = call?.customer?.number || "unknown";
      const toNumber = call?.phoneNumber?.number || "unknown";
      const callId = call?.id || "unknown";

      const text =
        `Vapi inbound call update:\n` +
        `Status: ${status}\n` +
        `From: ${caller}\n` +
        `To: ${toNumber}\n` +
        `CallId: ${callId}`;

      await client.messages.create({
        from: TWILIO_FROM_NUMBER,
        to: NOTIFY_TO_NUMBER,
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