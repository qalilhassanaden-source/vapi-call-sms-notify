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
