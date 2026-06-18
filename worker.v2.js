export default {
  async fetch(request) {
    // ====== CONFIG — fill these in ======
    const BOT_TOKEN = "YOUR_BOT_TOKEN";
    const CHAT_ID = "YOUR_CHAT_ID";
    // const THREAD_ID = <topic_id>; // uncomment this line if you're using a topic/thread

    // Only accept POST requests from GitHub
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }
    
    // Route to the correct handler based on the GitHub event type
    const eventType = request.headers.get("x-github-event");

    if (eventType === "push") {
      await handlePush(data, BOT_TOKEN, CHAT_ID, THREAD_ID);
    } else if (eventType === "pull_request") {
      await handlePR(data, BOT_TOKEN, CHAT_ID, THREAD_ID);
    }

    return new Response("OK", { status: 200 });
  }
};

// ====== PUSH HANDLER ======
async function handlePush(data, botToken, chatId, threadId) {
  const repo = data.repository?.full_name || "unknown";
  const branch = data.ref?.split("/").pop() || "unknown";
  const commits = data.commits || [];

  if (commits.length === 0) return;

  let msg;

  if (commits.length === 1) {
    const commit = commits[0];
    msg =
`🚀 *New Push*

📦 Repo: ${escMd(repo)}
🌿 Branch: ${escMd(branch)}
👤 Author: ${escMd(commit.author?.name)}
🕐 Time: ${escMd(formatDate(commit.timestamp))}
📝 Message: ${escMd(truncate(commit.message, 300))}
✅ Status: Success
🔗 [View Commit](${commit.url})`;
  } else {
    const commitLines = commits.map((c, i) =>
      `${i + 1}\\. ${escMd(truncate(c.message, 100))} \\— ${escMd(c.author?.name)}`
    ).join("\n");

    msg =
`🚀 *${escMd(String(commits.length))} Commits Pushed*

📦 Repo: ${escMd(repo)}
🌿 Branch: ${escMd(branch)}
🕐 Time: ${escMd(formatDate(commits[commits.length - 1].timestamp))}
✅ Status: Success

📝 *Commits:*
${commitLines}

🔗 [View Changes](${data.compare})`;
  }

  await sendTelegram(botToken, chatId, threadId, msg);
}

// ====== PULL REQUEST HANDLER ======
async function handlePR(data, botToken, chatId, threadId) {
  const action = data.action;
  if (!["opened", "closed", "merged"].includes(action)) return;

  const pr = data.pull_request;
  const statusEmoji = action === "opened" ? "🟢" : pr.merged ? "🟣" : "🔴";
  const status = pr.merged ? "Merged" : action.charAt(0).toUpperCase() + action.slice(1);

  const msg =
`${statusEmoji} *Pull Request ${escMd(status)}*

📦 Repo: ${escMd(data.repository?.full_name)}
🔀 Branch: \`${escMd(pr.head?.ref)}\` → \`${escMd(pr.base?.ref)}\`
👤 Author: ${escMd(pr.user?.login)}
📝 Title: ${escMd(truncate(pr.title, 200))}
✅ Status: ${escMd(status)}
🔗 [View PR](${pr.html_url})`;

  await sendTelegram(botToken, chatId, threadId, msg);
}

// ====== TELEGRAM SENDER ======
async function sendTelegram(botToken, chatId, threadId, text) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_thread_id: threadId,
      text,
      parse_mode: "MarkdownV2",
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    console.error("Telegram error:", JSON.stringify(err));
  }
}

// ====== HELPERS ======
function truncate(text, max) {
  if (!text) return "";
  const firstLine = text.split("\n")[0];
  return firstLine.length > max ? firstLine.slice(0, max) + "…" : firstLine;
}

function formatDate(iso) {
  if (!iso) return "unknown";
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Tehran",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

function escMd(text) {
  if (!text) return "";
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}