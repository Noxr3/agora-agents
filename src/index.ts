import express from "express";
import { v4 as uuidv4 } from "uuid";
import { getJoke } from "./jokes";

const app = express();
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", agent: "jokester" });
});

// A2A endpoint
app.post("/a2a", async (req, res) => {
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
