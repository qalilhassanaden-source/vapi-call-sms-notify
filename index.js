const express = require("express");
const twilio = require("twilio");

const app = express();
app.use(express.json({ limit: "2mb" }));

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  NOTIFY_TO_NUMBER
} = process.env;

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

app.post("/vapi", async (req, res) => {
  try {
    const msg = req.body?.message || {};

    if (msg.type === "status-update" || msg.type === "end-of-call-report") {
      const call = msg.call || {};
      const status = msg.status || call.status || msg.type;
      const caller = call?.customer?.number || "unknown";
      const toNumber = call?.phoneNumber?.number || "unknown";
      const callId = call?.id || "unknown";

      const text =
        `Vapi call event:\n` +
        `Type: ${msg.type}\n` +
        `Status: ${status}\n` +
        `From: ${caller}\n` +
        `To: ${toNumber}\n` +
        `CallId: ${callId}`;

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
