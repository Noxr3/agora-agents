import express from "express";
import { v4 as uuidv4 } from "uuid";
import { getJoke } from "./jokes";

const PAYMENT_ADDRESS =
  process.env.PAYMENT_ADDRESS ||
  "0x4b83a9fb395BE89A52F5539a228d2EB420158359";
const PRICE_USDC = "10000"; // 0.01 USDC (6 decimals)

const app = express();
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", agent: "jokester" });
});

// A2A health check (GET)
app.get("/a2a", (_req, res) => {
  res.json({ status: "ok", agent: "jokester", version: "1.0.0" });
});

// Root health check
app.get("/", (_req, res) => {
  res.json({ status: "ok", agent: "jokester" });
});

// x402 payment gate
function requirePayment(
  req: express.Request,
  res: express.Response
): boolean {
  const paymentSig = req.headers["payment-signature"];
  const paymentResponse = req.headers["payment-response"];

  // If payment has been verified by relay (PAYMENT-RESPONSE header present), allow through
  if (paymentResponse) {
    return false; // no block
  }

  // If caller included a payment signature, let it through (relay will verify)
  if (paymentSig) {
    return false; // no block
  }

  // No payment — return 402
  const paymentRequired = {
    x402Version: 1,
    accepts: [
      {
        scheme: "eip712",
        network: "eip155:84532", // Base Sepolia
        asset: "USDC",
        amount: PRICE_USDC,
        payTo: PAYMENT_ADDRESS,
        maxTimeoutSeconds: 60,
      },
    ],
  };

  const encoded = Buffer.from(JSON.stringify(paymentRequired)).toString(
    "base64"
  );

  res.status(402).set("PAYMENT-REQUIRED", encoded).json({
    error: "Payment required",
    message: "This agent charges 0.01 USDC per joke on Base Sepolia via x402.",
    paymentDetails: paymentRequired,
  });

  return true; // blocked
}

// A2A endpoint
app.post("/a2a", async (req, res) => {
  // Gate with x402 payment
  if (requirePayment(req, res)) return;

  const body = req.body;

  // Handle non-JSON-RPC requests gracefully
  if (!body.jsonrpc) {
    const text =
      body.message?.parts?.[0]?.text ||
      body.message?.text ||
      body.message ||
      body.text ||
      "";
    const joke = await getJoke(text || undefined);
    res.json({
      jsonrpc: "2.0",
      id: body.id || uuidv4(),
      result: {
        id: uuidv4(),
        sessionId: uuidv4(),
        status: { state: "completed" },
        artifacts: [
          {
            parts: [{ type: "text", text: joke }],
          },
        ],
      },
    });
    return;
  }

  // JSON-RPC 2.0 handler
  const { method, params, id } = body;

  if (method !== "tasks/send") {
    res.json({
      jsonrpc: "2.0",
      id,
      error: {
        code: -32601,
        message: `Method not found: ${method}. Supported: tasks/send`,
      },
    });
    return;
  }

  // Extract user message
  const parts = params?.message?.parts || [];
  const userText = parts
    .filter((p: { type: string }) => p.type === "text")
    .map((p: { text: string }) => p.text)
    .join(" ")
    .trim();

  const topic = userText || undefined;
  const joke = await getJoke(topic);

  const taskId = params?.id || uuidv4();
  const sessionId = params?.sessionId || uuidv4();

  res.json({
    jsonrpc: "2.0",
    id,
    result: {
      id: taskId,
      sessionId,
      status: { state: "completed" },
      artifacts: [
        {
          parts: [{ type: "text", text: joke }],
        },
      ],
    },
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Jokester agent listening on port ${PORT}`);
});
