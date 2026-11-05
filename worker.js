/**
 * ============================================================================
 * ZENOX WORKER BOT — PRODUCTION SERVERLESS TELEGRAM BOT (CLOUDFLARE WORKERS)
 * Framework: grammY (ES Modules)
 * Storage: Cloudflare KV Binding (`env.DB`)
 * ============================================================================
 */

import { Bot, InlineKeyboard, Keyboard } from "https://esm.sh/grammy@1.35.0";

// ============================================================================
// 1. DEFAULT CONFIGURATION & ENVIRONMENT FALLBACKS
// ============================================================================
const DEFAULT_CONFIG = {
  BOT_TOKEN: "9162764699:AAGUZ-mJ4qAIHyCs0GLNAB5JeZxQjCmALWQ",
  OWNER_ID: "8838351233",
  SUPPORT_USERNAME: "@ZenoxWorker",
  FORCE_CHANNEL: "https://t.me/+ukH5GufIKTthNzA9",
};

const DEFAULT_SETTINGS = {
  maintenanceMode: false,
  forceChannelEnabled: true,
  forceChannelUrl: DEFAULT_CONFIG.FORCE_CHANNEL,
  forceChannelChatId: "", // Optional numeric chat ID (e.g., "-1001234567890") or @username for strict API check
  currencySymbol: "USDT",
  welcomeBonus: 1.5,
  referralBonus: 2.0,
  dailyBonus: 0.5,
  minWithdraw: 10.0,
  supportUsername: DEFAULT_CONFIG.SUPPORT_USERNAME,
  admins: [DEFAULT_CONFIG.OWNER_ID],
};

const DEFAULT_TASKS = [
  {
    id: "task_101",
    title: "📢 Join Official Announcements Channel",
    description: "Subscribe to our official Telegram channel and stay active for updates and reward drops.",
    reward: 1.5,
    url: "https://t.me/+ukH5GufIKTthNzA9",
    active: true,
    createdAt: "2026-11-01T00:00:00.000Z",
  },
  {
    id: "task_102",
    title: "🐦 Follow Partner X (Twitter) & Retweet Pinned Post",
    description: "Follow our official X account, like and retweet the pinned post, then submit your @username as proof.",
    reward: 2.5,
    url: "https://x.com",
    active: true,
    createdAt: "2026-11-01T00:00:00.000Z",
  },
  {
    id: "task_103",
    title: "💬 Invite 3 Active Friends via Referral Link",
    description: "Share your personal referral link in crypto communities and submit a screenshot once completed.",
    reward: 3.0,
    url: "https://t.me/+ukH5GufIKTthNzA9",
    active: true,
    createdAt: "2026-11-01T00:00:00.000Z",
  },
];

// ============================================================================
// 2. CLOUDFLARE KV STORAGE LAYER (`env.DB`)
// ============================================================================
const IN_MEMORY_FALLBACK = new Map();

function getKV(env) {
  if (env && env.DB && typeof env.DB.get === "function") {
    return env.DB;
  }
  // Safe fallback if KV binding is not yet attached during local dry-runs
  return {
    async get(key) {
      return IN_MEMORY_FALLBACK.has(key) ? IN_MEMORY_FALLBACK.get(key) : null;
    },
    async put(key, value) {
      IN_MEMORY_FALLBACK.set(key, value);
    },
    async delete(key) {
      IN_MEMORY_FALLBACK.delete(key);
    },
  };
}

async function kvGetJSON(env, key, fallbackValue) {
  try {
    const kv = getKV(env);
    const raw = await kv.get(key);
    if (!raw) return fallbackValue;
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[KV READ ERROR] Key: ${key}`, err);
    return fallbackValue;
  }
}

async function kvPutJSON(env, key, value) {
  try {
    const kv = getKV(env);
    await kv.put(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error(`[KV WRITE ERROR] Key: ${key}`, err);
    return false;
  }
}

async function kvDelete(env, key) {
  try {
    const kv = getKV(env);
    await kv.delete(key);
    return true;
  } catch (err) {
    console.error(`[KV DELETE ERROR] Key: ${key}`, err);
    return false;
  }
}

// ============================================================================
// 3. DATA ACCESS HELPERS (USERS, SETTINGS, TASKS, SUBMISSIONS, PAYOUTS)
// ============================================================================
function resolveEnvConfig(env) {
  return {
    BOT_TOKEN: env?.BOT_TOKEN || DEFAULT_CONFIG.BOT_TOKEN,
    OWNER_ID: String(env?.OWNER_ID || DEFAULT_CONFIG.OWNER_ID).trim(),
    SUPPORT_USERNAME: env?.SUPPORT_USERNAME || DEFAULT_CONFIG.SUPPORT_USERNAME,
    FORCE_CHANNEL: env?.FORCE_CHANNEL || DEFAULT_CONFIG.FORCE_CHANNEL,
  };
}

async function getSettings(env) {
  const cfg = resolveEnvConfig(env);
  const stored = await kvGetJSON(env, "sys:settings", null);
  const merged = {
    ...DEFAULT_SETTINGS,
    forceChannelUrl: cfg.FORCE_CHANNEL,
    supportUsername: cfg.SUPPORT_USERNAME,
    ...(stored || {}),
  };
  if (!Array.isArray(merged.admins)) {
    merged.admins = [cfg.OWNER_ID];
  }
  if (!merged.admins.includes(cfg.OWNER_ID)) {
    merged.admins.unshift(cfg.OWNER_ID);
  }
  return merged;
}

async function saveSettings(env, settings) {
  return kvPutJSON(env, "sys:settings", settings);
}

async function getUserIndex(env) {
  return kvGetJSON(env, "sys:users_index", []);
}

async function addUserToIndex(env, userId) {
  const uid = String(userId);
  const index = await getUserIndex(env);
  if (!index.includes(uid)) {
    index.push(uid);
    await kvPutJSON(env, "sys:users_index", index);
  }
}

async function getUser(env, userId, fromObj = null) {
  const uid = String(userId);
  let user = await kvGetJSON(env, `user:${uid}`, null);
  const now = new Date().toISOString();

  if (!user && fromObj) {
    const settings = await getSettings(env);
    user = {
      id: uid,
      username: fromObj.username ? `@${fromObj.username}` : "No Username",
      firstName: fromObj.first_name || "User",
      balance: Number(settings.welcomeBonus || 0),
      totalEarned: Number(settings.welcomeBonus || 0),
      withdrawn: 0,
      referralsCount: 0,
      referredBy: null,
      walletAddress: "Not Set",
      completedTasks: [],
      pendingTasks: [],
      verifiedChannel: false,
      banned: false,
      lastDailyBonus: null,
      state: null,
      stateData: {},
      joinedAt: now,
      updatedAt: now,
      isNew: true,
    };
    await kvPutJSON(env, `user:${uid}`, user);
    await addUserToIndex(env, uid);
    return user;
  }

  if (user && fromObj) {
    user.username = fromObj.username ? `@${fromObj.username}` : user.username;
    user.firstName = fromObj.first_name || user.firstName;
    user.updatedAt = now;
    user.isNew = false;
  }
  return user;
}

async function saveUser(env, user) {
  if (!user || !user.id) return false;
  const copy = { ...user };
  delete copy.isNew;
  copy.updatedAt = new Date().toISOString();
  return kvPutJSON(env, `user:${copy.id}`, copy);
}

async function getTasks(env) {
  const tasks = await kvGetJSON(env, "sys:tasks", null);
  if (!tasks) {
    await kvPutJSON(env, "sys:tasks", DEFAULT_TASKS);
    return DEFAULT_TASKS;
  }
  return tasks;
}

async function saveTasks(env, tasks) {
  return kvPutJSON(env, "sys:tasks", tasks);
}

async function getSubmissions(env) {
  return kvGetJSON(env, "sys:submissions", []);
}

async function saveSubmissions(env, submissions) {
  return kvPutJSON(env, "sys:submissions", submissions);
}

async function getPayouts(env) {
  return kvGetJSON(env, "sys:payouts", []);
}

async function savePayouts(env, payouts) {
  return kvPutJSON(env, "sys:payouts", payouts);
}

// ============================================================================
// 4. KEYBOARDS & UI BUILDERS
// ============================================================================
function buildUserReplyKeyboard() {
  return new Keyboard()
    .text("🎯 Earn Tasks")
    .text("💰 My Balance")
    .row()
    .text("💳 Wallet & Withdraw")
    .text("👥 Refer & Earn")
    .row()
    .text("🎁 Daily Bonus")
    .text("🛟 Support")
    .resized()
    .persistent();
}

function buildForceChannelKeyboard(channelUrl) {
  return new InlineKeyboard()
    .url("📢 Join Official Channel", channelUrl)
    .row()
    .text("✅ Verify Membership", "verify_force_channel");
}

function buildAdminPanelKeyboard() {
  return new InlineKeyboard()
    .text("➕ Create / Add", "admin:create_add")
    .text("📋 Manage Custom / Tasks", "admin:manage_tasks")
    .row()
    .text("📝 Review Pending Submissions", "admin:review_submissions")
    .row()
    .text("👥 View All Users", "admin:view_users:0")
    .text("🔍 Inspect User", "admin:inspect_user")
    .row()
    .text("📊 Real-Time Analytics", "admin:analytics")
    .text("💳 Manage Payments / Payouts", "admin:manage_payouts")
    .row()
    .text("🎁 Set Rewards / Bonuses", "admin:set_rewards")
    .text("📢 Force Channel Verification", "admin:force_channel")
    .row()
    .text("👥 Manage Admins", "admin:manage_admins")
    .text("📢 Broadcast System", "admin:broadcast")
    .row()
    .text("⚙️ Maintenance Mode", "admin:maintenance")
    .text("⚠️ Wipe / Reset All Platform Data", "admin:wipe_confirm")
    .row()
    .text("🔙 Close Admin Panel", "admin:close");
}

function buildAdminBackKeyboard() {
  return new InlineKeyboard().text("🔙 Back to Admin Panel", "admin:home");
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatMoney(amount, currency = "USDT") {
  return `${Number(amount || 0).toFixed(2)} ${currency}`;
}

// ============================================================================
// 5. PERMISSION & FORCE CHANNEL VERIFICATION HELPERS
// ============================================================================
function isOwner(userId, env) {
  const cfg = resolveEnvConfig(env);
  return String(userId) === String(cfg.OWNER_ID);
}

async function isAuthorizedAdmin(userId, env) {
  if (isOwner(userId, env)) return true;
  const settings = await getSettings(env);
  return Array.isArray(settings.admins) && settings.admins.includes(String(userId));
}

async function verifyChannelMembership(ctx, env, user, settings) {
  if (!settings.forceChannelEnabled) return true;
  if (await isAuthorizedAdmin(user.id, env)) return true;

  // If numeric Chat ID or @username is configured, verify via Telegram Bot API getChatMember
  if (settings.forceChannelChatId && settings.forceChannelChatId.trim() !== "") {
    try {
      const member = await ctx.api.getChatMember(
        settings.forceChannelChatId.trim(),
        Number(user.id)
      );
      const validStatuses = ["creator", "administrator", "member", "restricted"];
      if (validStatuses.includes(member.status)) {
        user.verifiedChannel = true;
        await saveUser(env, user);
        return true;
      }
      return false;
    } catch (err) {
      console.warn("[ForceChannel API Check Warning]:", err.message);
      // Fall back to user.verifiedChannel flag if bot is not yet admin in private invite channel
    }
  }

  return Boolean(user.verifiedChannel);
}

async function sendForceChannelPrompt(ctx, settings) {
  const text =
    `🚨 <b>Action Required: Channel Subscription</b>\n\n` +
    `Welcome to our platform! To unlock your wallet, tasks, and bonuses, you must join our official channel first.\n\n` +
    `1️⃣ Click <b>"📢 Join Official Channel"</b> below.\n` +
    `2️⃣ Click <b>"✅ Verify Membership"</b> to continue.`;

  await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup: buildForceChannelKeyboard(settings.forceChannelUrl),
  });
}

async function buildAdminDashboardText(env) {
  const settings = await getSettings(env);
  const usersIndex = await getUserIndex(env);
  const tasks = await getTasks(env);
  const submissions = await getSubmissions(env);
  const payouts = await getPayouts(env);

  const pendingSubs = submissions.filter((s) => s.status === "pending").length;
  const pendingPayouts = payouts.filter((p) => p.status === "pending").length;

  return (
    `🛡️ <b>ZENOX EXECUTIVE ADMIN CONTROL PANEL</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👥 <b>Total Registered Users:</b> <code>${usersIndex.length}</code>\n` +
    `📋 <b>Active Tasks:</b> <code>${tasks.filter((t) => t.active).length} / ${tasks.length}</code>\n` +
    `📝 <b>Pending Submissions:</b> <code>${pendingSubs}</code>\n` +
    `💳 <b>Pending Payouts:</b> <code>${pendingPayouts}</code>\n` +
    `📢 <b>Force Channel:</b> <code>${settings.forceChannelEnabled ? "ENABLED 🟢" : "DISABLED 🔴"}</code>\n` +
    `⚙️ <b>Maintenance Mode:</b> <code>${settings.maintenanceMode ? "ACTIVE 🟠" : "OFF 🟢"}</code>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `<i>Select a management module below:</i>`
  );
}

// ============================================================================
// 6. BOT FACTORY & HANDLER REGISTRATION
// ============================================================================
function createBotInstance(env) {
  const cfg = resolveEnvConfig(env);
  const bot = new Bot(cfg.BOT_TOKEN);

  // Global Error Handler inside grammY
  bot.catch((err) => {
    console.error("[grammY Bot Error]:", err.error || err);
  });

  // --------------------------------------------------------------------------
  // MIDDLEWARE: User Initialization, Ban Check & Maintenance Guard
  // --------------------------------------------------------------------------
  bot.use(async (ctx, next) => {
    if (!ctx.from) return;

    const settings = await getSettings(env);
    const user = await getUser(env, ctx.from.id, ctx.from);
    ctx.state = { user, settings, cfg };

    const adminAuth = await isAuthorizedAdmin(ctx.from.id, env);

    if (user.banned && !adminAuth) {
      await ctx.reply(
        `🚫 <b>Access Suspended</b>\n\nYour account has been restricted by an administrator. Contact ${escapeHtml(
          settings.supportUsername
        )} for assistance.`,
        { parse_mode: "HTML" }
      );
      return;
    }

    if (settings.maintenanceMode && !adminAuth) {
      await ctx.reply(
        `⚙️ <b>System Maintenance Underway</b>\n\nWe are currently upgrading our servers and reward engine. Please check back shortly!\n\n🛟 Support: ${escapeHtml(
          settings.supportUsername
        )}`,
        { parse_mode: "HTML" }
      );
      return;
    }

    await next();
  });

  // --------------------------------------------------------------------------
  // COMMAND: /start (Welcome, Referral Attribution, Force Channel Check)
  // --------------------------------------------------------------------------
  bot.command("start", async (ctx) => {
    const { user, settings } = ctx.state;
    const payload = ctx.match ? String(ctx.match).trim() : "";

    // Clear any lingering conversational state
    user.state = null;
    user.stateData = {};

    // Process Referral Deep-Link (e.g., /start ref_123456)
    if (user.isNew && payload.startsWith("ref_")) {
      const refId = payload.replace("ref_", "").trim();
      if (refId && refId !== String(user.id)) {
        const referrer = await getUser(env, refId);
        if (referrer && !user.referredBy) {
          user.referredBy = refId;
          const bonus = Number(settings.referralBonus || 0);
          referrer.balance = Number(referrer.balance || 0) + bonus;
          referrer.totalEarned = Number(referrer.totalEarned || 0) + bonus;
          referrer.referralsCount = Number(referrer.referralsCount || 0) + 1;
          await saveUser(env, referrer);

          try {
            await ctx.api.sendMessage(
              Number(refId),
              `🎉 <b>New Referral Joined!</b>\n\n👤 <b>User:</b> ${escapeHtml(
                user.firstName
              )}\n🎁 <b>Bonus Credited:</b> +${formatMoney(bonus, settings.currencySymbol)}`,
              { parse_mode: "HTML" }
            );
          } catch (_) {
            // Ignore if referrer blocked the bot
          }
        }
      }
    }

    await saveUser(env, user);

    // Check Force Channel Subscription
    const isVerified = await verifyChannelMembership(ctx, env, user, settings);
    if (!isVerified) {
      await sendForceChannelPrompt(ctx, settings);
      return;
    }

    const welcomeText =
      `✨ <b>Welcome to Zenox Rewards Hub, ${escapeHtml(user.firstName)}!</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🆔 <b>Account ID:</b> <code>${user.id}</code>\n` +
      `💰 <b>Current Balance:</b> <code>${formatMoney(user.balance, settings.currencySymbol)}</code>\n` +
      `👥 <b>Total Referrals:</b> <code>${user.referralsCount}</code>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🚀 Complete daily tasks, invite friends, and withdraw instant payouts directly to your wallet!\n\n` +
      `👇 <i>Use the interactive menu below to navigate:</i>`;

    await ctx.reply(welcomeText, {
      parse_mode: "HTML",
      reply_markup: buildUserReplyKeyboard(),
    });
  });

  // --------------------------------------------------------------------------
  // COMMAND: /admin (Restricted strictly to OWNER_ID & Authorized Admins)
  // --------------------------------------------------------------------------
  bot.command("admin", async (ctx) => {
    const userId = String(ctx.from.id);
    const authorized = await isAuthorizedAdmin(userId, env);

    if (!authorized) {
      await ctx.reply(
        `⛔ <b>Access Denied</b>\nThis command is restricted strictly to the platform owner.`,
        { parse_mode: "HTML" }
      );
      return;
    }

    const { user } = ctx.state;
    user.state = null;
    user.stateData = {};
    await saveUser(env, user);

    const dashboardText = await buildAdminDashboardText(env);
    await ctx.reply(dashboardText, {
      parse_mode: "HTML",
      reply_markup: buildAdminPanelKeyboard(),
    });
  });

  // --------------------------------------------------------------------------
  // CALLBACK QUERIES: Force Channel Verification
  // --------------------------------------------------------------------------
  bot.callbackQuery("verify_force_channel", async (ctx) => {
    const { user, settings } = ctx.state;

    // If forceChannelChatId is set, verify strictly via Telegram API; otherwise mark verified after click
    if (settings.forceChannelChatId && settings.forceChannelChatId.trim() !== "") {
      const ok = await verifyChannelMembership(ctx, env, user, settings);
      if (!ok) {
        await ctx.answerCallbackQuery({
          text: "❌ You haven't joined the channel yet! Please join first.",
          show_alert: true,
        });
        return;
      }
    } else {
      user.verifiedChannel = true;
      await saveUser(env, user);
    }

    await ctx.answerCallbackQuery({
      text: "✅ Membership verified! Welcome aboard.",
    });

    try {
      await ctx.deleteMessage();
    } catch (_) {}

    await ctx.reply(
      `✅ <b>Verification Successful!</b>\n\nWelcome, <b>${escapeHtml(
        user.firstName
      )}</b>! Your account is now active.\n💰 <b>Balance:</b> <code>${formatMoney(
        user.balance,
        settings.currencySymbol
      )}</code>`,
      {
        parse_mode: "HTML",
        reply_markup: buildUserReplyKeyboard(),
      }
    );
  });

  // --------------------------------------------------------------------------
  // USER INTERACTIVE CALLBACKS (Tasks, Wallet, Withdrawals)
  // --------------------------------------------------------------------------
  bot.callbackQuery(/^task:view:(.+)$/, async (ctx) => {
    const taskId = ctx.match[1];
    const { user, settings } = ctx.state;
    const tasks = await getTasks(env);
    const task = tasks.find((t) => t.id === taskId && t.active);

    if (!task) {
      await ctx.answerCallbackQuery({ text: "⚠️ Task is no longer available.", show_alert: true });
      return;
    }

    const completed = (user.completedTasks || []).includes(task.id);
    const pending = (user.pendingTasks || []).includes(task.id);

    const kb = new InlineKeyboard();
    if (task.url) {
      kb.url("🔗 Open Task Link", task.url).row();
    }
    if (!completed && !pending) {
      kb.text("📤 Submit Proof & Claim Reward", `task:submit:${task.id}`).row();
    }
    kb.text("🔙 Back to Tasks", "user:tasks_list");

    const statusBadge = completed
      ? "✅ Completed"
      : pending
      ? "⏳ Pending Review"
      : "🟢 Available";

    const text =
      `🎯 <b>${escapeHtml(task.title)}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📝 <b>Instructions:</b>\n${escapeHtml(task.description)}\n\n` +
      `🎁 <b>Reward:</b> <code>+${formatMoney(task.reward, settings.currencySymbol)}</code>\n` +
      `📌 <b>Status:</b> ${statusBadge}`;

    await ctx.answerCallbackQuery();
    await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
  });

  bot.callbackQuery("user:tasks_list", async (ctx) => {
    const { user, settings } = ctx.state;
    const tasks = (await getTasks(env)).filter((t) => t.active);

    const kb = new InlineKeyboard();
    for (const t of tasks) {
      const done = (user.completedTasks || []).includes(t.id);
      const pend = (user.pendingTasks || []).includes(t.id);
      const prefix = done ? "✅" : pend ? "⏳" : "🎯";
      kb.text(
        `${prefix} ${t.title} (+${formatMoney(t.reward, settings.currencySymbol)})`,
        `task:view:${t.id}`
      ).row();
    }

    const text =
      tasks.length > 0
        ? `🎯 <b>Available Earning Tasks (${tasks.length})</b>\n\nSelect any task below to view instructions and claim your reward:`
        : `📭 <b>No Active Tasks</b>\n\nAll tasks are completed or being refreshed. Check back soon!`;

    await ctx.answerCallbackQuery();
    await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
  });

  bot.callbackQuery(/^task:submit:(.+)$/, async (ctx) => {
    const taskId = ctx.match[1];
    const { user } = ctx.state;
    const tasks = await getTasks(env);
    const task = tasks.find((t) => t.id === taskId && t.active);

    if (!task) {
      await ctx.answerCallbackQuery({ text: "⚠️ Task not found.", show_alert: true });
      return;
    }

    user.state = "USER_SUBMITTING_TASK";
    user.stateData = { taskId: task.id, taskTitle: task.title, reward: task.reward };
    await saveUser(env, user);

    await ctx.answerCallbackQuery();
    await ctx.reply(
      `📤 <b>Submit Proof for:</b> ${escapeHtml(task.title)}\n\n` +
        `Please send your proof of completion as a text message (e.g., your username, transaction link, or verification details).\n\n` +
        `<i>Type /cancel at any time to abort.</i>`,
      { parse_mode: "HTML" }
    );
  });

  bot.callbackQuery("wallet:set_address", async (ctx) => {
    const { user } = ctx.state;
    user.state = "USER_SETTING_WALLET";
    user.stateData = {};
    await saveUser(env, user);

    await ctx.answerCallbackQuery();
    await ctx.reply(
      `💳 <b>Update Payout Wallet Address</b>\n\n` +
        `Please reply with your valid wallet address (USDT TRC20 / BEP20 or TON address):\n\n` +
        `<i>Type /cancel to abort.</i>`,
      { parse_mode: "HTML" }
    );
  });

  bot.callbackQuery("wallet:withdraw", async (ctx) => {
    const { user, settings } = ctx.state;
    if (!user.walletAddress || user.walletAddress === "Not Set") {
      await ctx.answerCallbackQuery({
        text: "⚠️ Please set your wallet address first!",
        show_alert: true,
      });
      return;
    }
    if (Number(user.balance) < Number(settings.minWithdraw)) {
      await ctx.answerCallbackQuery({
        text: `⚠️ Minimum withdrawal is ${formatMoney(
          settings.minWithdraw,
          settings.currencySymbol
        )}. Your balance is ${formatMoney(user.balance, settings.currencySymbol)}.`,
        show_alert: true,
      });
      return;
    }

    user.state = "USER_WITHDRAW_AMOUNT";
    user.stateData = {};
    await saveUser(env, user);

    await ctx.answerCallbackQuery();
    await ctx.reply(
      `💸 <b>Request Withdrawal</b>\n\n` +
        `💰 <b>Available Balance:</b> <code>${formatMoney(
          user.balance,
          settings.currencySymbol
        )}</code>\n` +
        `🏦 <b>Destination Wallet:</b> <code>${escapeHtml(user.walletAddress)}</code>\n` +
        `📉 <b>Minimum Withdrawal:</b> <code>${formatMoney(
          settings.minWithdraw,
          settings.currencySymbol
        )}</code>\n\n` +
        `Please enter the amount you wish to withdraw:`,
      { parse_mode: "HTML" }
    );
  });

  // ==========================================================================
  // 7. ADMIN PANEL CALLBACK HANDLERS (ALL 14 REQUIRED MODULES)
  // ==========================================================================
  bot.callbackQuery(/^admin:(.+)$/, async (ctx) => {
    const userId = String(ctx.from.id);
    if (!(await isAuthorizedAdmin(userId, env))) {
      await ctx.answerCallbackQuery({
        text: "⛔ Unauthorized: Admin privileges required.",
        show_alert: true,
      });
      return;
    }

    const actionPayload = ctx.match[1];
    const { user, settings, cfg } = ctx.state;

    // Reset admin state when navigating menu
    user.state = null;
    user.stateData = {};
    await saveUser(env, user);

    // 0. Back to Admin Home
    if (actionPayload === "home") {
      await ctx.answerCallbackQuery();
      const text = await buildAdminDashboardText(env);
      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: buildAdminPanelKeyboard(),
      });
      return;
    }

    // 1. ➕ Create / Add
    if (actionPayload === "create_add") {
      await ctx.answerCallbackQuery();
      user.state = "ADMIN_CREATE_TASK";
      await saveUser(env, user);

      const text =
        `➕ <b>Create / Add New Earning Task</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Send the new task details in the following pipe-separated format:\n\n` +
        `<code>Title | Description | RewardAmount | URL</code>\n\n` +
        `<b>Example:</b>\n` +
        `<code>🔥 Join Partner Telegram | Subscribe and stay active | 2.50 | https://t.me/+ukH5GufIKTthNzA9</code>`;

      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: buildAdminBackKeyboard(),
      });
      return;
    }

    // 2. 📋 Manage Custom / Tasks
    if (actionPayload === "manage_tasks") {
      await ctx.answerCallbackQuery();
      const tasks = await getTasks(env);
      const kb = new InlineKeyboard();

      for (const t of tasks) {
        const statusIcon = t.active ? "🟢" : "🔴";
        kb.text(`${statusIcon} ${t.title.slice(0, 22)} (${t.reward})`, `admin:task_toggle:${t.id}`)
          .text("🗑️ Delete", `admin:task_del:${t.id}`)
          .row();
      }
      kb.text("➕ Add New Task", "admin:create_add").row();
      kb.text("🔙 Back to Admin Panel", "admin:home");

      const text =
        `📋 <b>Manage Custom / Tasks (${tasks.length})</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `• Click a task name to toggle <b>Active (🟢) / Paused (🔴)</b>.\n` +
        `• Click <b>🗑️ Delete</b> to permanently remove a task.`;

      await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
      return;
    }

    if (actionPayload.startsWith("task_toggle:")) {
      const taskId = actionPayload.replace("task_toggle:", "");
      const tasks = await getTasks(env);
      const target = tasks.find((t) => t.id === taskId);
      if (target) {
        target.active = !target.active;
        await saveTasks(env, tasks);
        await ctx.answerCallbackQuery({
          text: `Task "${target.title}" is now ${target.active ? "Active 🟢" : "Paused 🔴"}`,
        });
      }
      // Re-render task list
      const kb = new InlineKeyboard();
      for (const t of tasks) {
        const statusIcon = t.active ? "🟢" : "🔴";
        kb.text(`${statusIcon} ${t.title.slice(0, 22)} (${t.reward})`, `admin:task_toggle:${t.id}`)
          .text("🗑️ Delete", `admin:task_del:${t.id}`)
          .row();
      }
      kb.text("➕ Add New Task", "admin:create_add").row();
      kb.text("🔙 Back to Admin Panel", "admin:home");

      await ctx.editMessageReplyMarkup({ reply_markup: kb });
      return;
    }

    if (actionPayload.startsWith("task_del:")) {
      const taskId = actionPayload.replace("task_del:", "");
      let tasks = await getTasks(env);
      tasks = tasks.filter((t) => t.id !== taskId);
      await saveTasks(env, tasks);
      await ctx.answerCallbackQuery({ text: "🗑️ Task deleted!" });

      const kb = new InlineKeyboard();
      for (const t of tasks) {
        const statusIcon = t.active ? "🟢" : "🔴";
        kb.text(`${statusIcon} ${t.title.slice(0, 22)} (${t.reward})`, `admin:task_toggle:${t.id}`)
          .text("🗑️ Delete", `admin:task_del:${t.id}`)
          .row();
      }
      kb.text("➕ Add New Task", "admin:create_add").row();
      kb.text("🔙 Back to Admin Panel", "admin:home");

      await ctx.editMessageText(
        `📋 <b>Manage Custom / Tasks (${tasks.length})</b>\n━━━━━━━━━━━━━━━━━━━━━━\nTask removed successfully.`,
        { parse_mode: "HTML", reply_markup: kb }
      );
      return;
    }

    // 3. 📝 Review Pending Submissions
    if (actionPayload === "review_submissions") {
      await ctx.answerCallbackQuery();
      const submissions = await getSubmissions(env);
      const pending = submissions.filter((s) => s.status === "pending");

      if (pending.length === 0) {
        await ctx.editMessageText(
          `📝 <b>Review Pending Submissions</b>\n━━━━━━━━━━━━━━━━━━━━━━\n✅ All caught up! There are currently <b>0</b> pending task submissions.`,
          { parse_mode: "HTML", reply_markup: buildAdminBackKeyboard() }
        );
        return;
      }

      const item = pending[0];
      const kb = new InlineKeyboard()
        .text(`✅ Approve (+${item.reward})`, `admin:sub_approve:${item.id}`)
        .text("❌ Reject", `admin:sub_reject:${item.id}`)
        .row()
        .text("🔙 Back to Admin Panel", "admin:home");

      const text =
        `📝 <b>Review Pending Submission (1 of ${pending.length})</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🆔 <b>Submission ID:</b> <code>${item.id}</code>\n` +
        `👤 <b>User:</b> ${escapeHtml(item.userName)} (<code>${item.userId}</code>)\n` +
        `🎯 <b>Task:</b> ${escapeHtml(item.taskTitle)}\n` +
        `🎁 <b>Reward:</b> <code>${formatMoney(item.reward, settings.currencySymbol)}</code>\n` +
        `📄 <b>Submitted Proof:</b>\n<code>${escapeHtml(item.proof)}</code>\n` +
        `🕒 <b>Time:</b> <code>${item.createdAt}</code>`;

      await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
      return;
    }

    if (actionPayload.startsWith("sub_approve:") || actionPayload.startsWith("sub_reject:")) {
      const isApprove = actionPayload.startsWith("sub_approve:");
      const subId = actionPayload.split(":")[1];
      const submissions = await getSubmissions(env);
      const sub = submissions.find((s) => s.id === subId);

      if (!sub || sub.status !== "pending") {
        await ctx.answerCallbackQuery({ text: "⚠️ Submission already processed." });
        return;
      }

      sub.status = isApprove ? "approved" : "rejected";
      await saveSubmissions(env, submissions);

      const targetUser = await getUser(env, sub.userId);
      if (targetUser) {
        targetUser.pendingTasks = (targetUser.pendingTasks || []).filter((id) => id !== sub.taskId);
        if (isApprove) {
          if (!targetUser.completedTasks.includes(sub.taskId)) {
            targetUser.completedTasks.push(sub.taskId);
          }
          targetUser.balance = Number(targetUser.balance || 0) + Number(sub.reward || 0);
          targetUser.totalEarned = Number(targetUser.totalEarned || 0) + Number(sub.reward || 0);
        }
        await saveUser(env, targetUser);

        try {
          await ctx.api.sendMessage(
            Number(sub.userId),
            isApprove
              ? `✅ <b>Task Approved!</b>\n\n🎯 <b>Task:</b> ${escapeHtml(
                  sub.taskTitle
                )}\n🎁 <b>Reward Credited:</b> +${formatMoney(sub.reward, settings.currencySymbol)}`
              : `❌ <b>Task Submission Rejected</b>\n\n🎯 <b>Task:</b> ${escapeHtml(
                  sub.taskTitle
                )}\nPlease verify instructions and try again.`,
            { parse_mode: "HTML" }
          );
        } catch (_) {}
      }

      await ctx.answerCallbackQuery({
        text: isApprove ? "✅ Submission Approved & Credited!" : "❌ Submission Rejected.",
      });

      const remaining = submissions.filter((s) => s.status === "pending");
      if (remaining.length === 0) {
        await ctx.editMessageText(
          `📝 <b>Review Pending Submissions</b>\n━━━━━━━━━━━━━━━━━━━━━━\n✅ All pending submissions have been reviewed!`,
          { parse_mode: "HTML", reply_markup: buildAdminBackKeyboard() }
        );
      } else {
        const nextItem = remaining[0];
        const kb = new InlineKeyboard()
          .text(`✅ Approve (+${nextItem.reward})`, `admin:sub_approve:${nextItem.id}`)
          .text("❌ Reject", `admin:sub_reject:${nextItem.id}`)
          .row()
          .text("🔙 Back to Admin Panel", "admin:home");

        await ctx.editMessageText(
          `📝 <b>Review Pending Submission (1 of ${remaining.length})</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🆔 <b>Submission ID:</b> <code>${nextItem.id}</code>\n` +
            `👤 <b>User:</b> ${escapeHtml(nextItem.userName)} (<code>${nextItem.userId}</code>)\n` +
            `🎯 <b>Task:</b> ${escapeHtml(nextItem.taskTitle)}\n` +
            `🎁 <b>Reward:</b> <code>${formatMoney(nextItem.reward, settings.currencySymbol)}</code>\n` +
            `📄 <b>Submitted Proof:</b>\n<code>${escapeHtml(nextItem.proof)}</code>`,
          { parse_mode: "HTML", reply_markup: kb }
        );
      }
      return;
    }

    // 4. 👥 View All Users (Paginated)
    if (actionPayload.startsWith("view_users:")) {
      await ctx.answerCallbackQuery();
      const page = Number(actionPayload.split(":")[1] || 0);
      const pageSize = 8;
      const userIds = await getUserIndex(env);
      const totalPages = Math.max(1, Math.ceil(userIds.length / pageSize));
      const slice = userIds.slice(page * pageSize, (page + 1) * pageSize);

      let listHtml = "";
      for (const uid of slice) {
        const u = await getUser(env, uid);
        if (u) {
          listHtml += `• <code>${u.id}</code> | <b>${escapeHtml(u.firstName)}</b> (${escapeHtml(
            u.username
          )}) — <code>${formatMoney(u.balance, settings.currencySymbol)}</code> ${
            u.banned ? "🚫" : ""
          }\n`;
        }
      }

      if (!listHtml) {
        listHtml = "<i>No registered users found in KV storage yet.</i>\n";
      }

      const kb = new InlineKeyboard();
      if (page > 0) kb.text("⬅️ Prev", `admin:view_users:${page - 1}`);
      if (page + 1 < totalPages) kb.text("Next ➡️", `admin:view_users:${page + 1}`);
      kb.row().text("🔍 Inspect Specific User", "admin:inspect_user");
      kb.row().text("🔙 Back to Admin Panel", "admin:home");

      const text =
        `👥 <b>Registered Platform Users (Total: ${userIds.length})</b>\n` +
        `📄 Page ${page + 1} of ${totalPages}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        listHtml;

      await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
      return;
    }

    // 5. 🔍 Inspect User
    if (actionPayload === "inspect_user") {
      await ctx.answerCallbackQuery();
      user.state = "ADMIN_INSPECT_USER";
      await saveUser(env, user);

      await ctx.editMessageText(
        `🔍 <b>Inspect & Modify User Account</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Please send the <b>Telegram User ID</b> you want to inspect, credit/debit, or ban/unban:`,
        { parse_mode: "HTML", reply_markup: buildAdminBackKeyboard() }
      );
      return;
    }

    if (actionPayload.startsWith("user_mod:")) {
      const [, modAction, targetUid] = actionPayload.split(":");
      const target = await getUser(env, targetUid);
      if (!target) {
        await ctx.answerCallbackQuery({ text: "❌ User not found.", show_alert: true });
        return;
      }

      if (modAction === "ban_toggle") {
        target.banned = !target.banned;
        await saveUser(env, target);
        await ctx.answerCallbackQuery({
          text: target.banned ? "🚫 User Banned!" : "✅ User Unbanned!",
        });
      } else if (modAction === "add_bal") {
        target.balance = Number(target.balance || 0) + 5;
        target.totalEarned = Number(target.totalEarned || 0) + 5;
        await saveUser(env, target);
        await ctx.answerCallbackQuery({ text: "➕ Added +5.00 to user balance!" });
      } else if (modAction === "zero_bal") {
        target.balance = 0;
        await saveUser(env, target);
        await ctx.answerCallbackQuery({ text: "🧹 User balance reset to 0.00!" });
      }

      const kb = new InlineKeyboard()
        .text("➕ Add +5.00 Balance", `admin:user_mod:add_bal:${target.id}`)
        .text("🧹 Reset Balance", `admin:user_mod:zero_bal:${target.id}`)
        .row()
        .text(
          target.banned ? "✅ Unban User" : "🚫 Ban User",
          `admin:user_mod:ban_toggle:${target.id}`
        )
        .row()
        .text("🔙 Back to Admin Panel", "admin:home");

      const inspectHtml =
        `🔍 <b>User Profile Inspection</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🆔 <b>User ID:</b> <code>${target.id}</code>\n` +
        `👤 <b>Name:</b> ${escapeHtml(target.firstName)} (${escapeHtml(target.username)})\n` +
        `💰 <b>Balance:</b> <code>${formatMoney(target.balance, settings.currencySymbol)}</code>\n` +
        `📈 <b>Total Earned:</b> <code>${formatMoney(target.totalEarned, settings.currencySymbol)}</code>\n` +
        `👥 <b>Referrals:</b> <code>${target.referralsCount}</code>\n` +
        `🏦 <b>Wallet:</b> <code>${escapeHtml(target.walletAddress)}</code>\n` +
        `🚦 <b>Status:</b> ${target.banned ? "🚫 BANNED" : "🟢 ACTIVE"}`;

      await ctx.editMessageText(inspectHtml, { parse_mode: "HTML", reply_markup: kb });
      return;
    }

    // 6. 📊 Real-Time Analytics
    if (actionPayload === "analytics") {
      await ctx.answerCallbackQuery({ text: "📊 Refreshing real-time metrics..." });
      const userIds = await getUserIndex(env);
      const tasks = await getTasks(env);
      const submissions = await getSubmissions(env);
      const payouts = await getPayouts(env);

      let totalBalanceCirculating = 0;
      let totalWithdrawnVolume = 0;
      let totalReferrals = 0;

      for (const uid of userIds) {
        const u = await getUser(env, uid);
        if (u) {
          totalBalanceCirculating += Number(u.balance || 0);
          totalWithdrawnVolume += Number(u.withdrawn || 0);
          totalReferrals += Number(u.referralsCount || 0);
        }
      }

      const kb = new InlineKeyboard()
        .text("🔄 Refresh Metrics", "admin:analytics")
        .row()
        .text("🔙 Back to Admin Panel", "admin:home");

      const text =
        `📊 <b>Real-Time Platform Analytics</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👥 <b>Total Users:</b> <code>${userIds.length}</code>\n` +
        `🔗 <b>Total Referrals Generated:</b> <code>${totalReferrals}</code>\n` +
        `💰 <b>Circulating User Balances:</b> <code>${formatMoney(
          totalBalanceCirculating,
          settings.currencySymbol
        )}</code>\n` +
        `💸 <b>Total Paid Out Volume:</b> <code>${formatMoney(
          totalWithdrawnVolume,
          settings.currencySymbol
        )}</code>\n` +
        `📋 <b>Active Tasks:</b> <code>${tasks.filter((t) => t.active).length} / ${tasks.length}</code>\n` +
        `📝 <b>Submissions (Pending / Total):</b> <code>${
          submissions.filter((s) => s.status === "pending").length
        } / ${submissions.length}</code>\n` +
        `💳 <b>Withdrawals (Pending / Total):</b> <code>${
          payouts.filter((p) => p.status === "pending").length
        } / ${payouts.length}</code>\n` +
        `🕒 <b>Timestamp:</b> <code>${new Date().toISOString()}</code>`;

      await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
      return;
    }

    // 7. 💳 Manage Payments / Payouts
    if (actionPayload === "manage_payouts") {
      await ctx.answerCallbackQuery();
      const payouts = await getPayouts(env);
      const pending = payouts.filter((p) => p.status === "pending");

      if (pending.length === 0) {
        await ctx.editMessageText(
          `💳 <b>Manage Payments / Payouts</b>\n━━━━━━━━━━━━━━━━━━━━━━\n✅ There are currently <b>0</b> pending withdrawal requests.`,
          { parse_mode: "HTML", reply_markup: buildAdminBackKeyboard() }
        );
        return;
      }

      const item = pending[0];
      const kb = new InlineKeyboard()
        .text("✅ Mark Paid", `admin:payout_approve:${item.id}`)
        .text("❌ Reject & Refund", `admin:payout_reject:${item.id}`)
        .row()
        .text("🔙 Back to Admin Panel", "admin:home");

      const text =
        `💳 <b>Pending Withdrawal Request (1 of ${pending.length})</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🆔 <b>Payout ID:</b> <code>${item.id}</code>\n` +
        `👤 <b>User:</b> ${escapeHtml(item.userName)} (<code>${item.userId}</code>)\n` +
        `💸 <b>Amount:</b> <code>${formatMoney(item.amount, settings.currencySymbol)}</code>\n` +
        `🏦 <b>Wallet Address:</b>\n<code>${escapeHtml(item.wallet)}</code>\n` +
        `🕒 <b>Requested At:</b> <code>${item.createdAt}</code>`;

      await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
      return;
    }

    if (actionPayload.startsWith("payout_approve:") || actionPayload.startsWith("payout_reject:")) {
      const isApprove = actionPayload.startsWith("payout_approve:");
      const payoutId = actionPayload.split(":")[1];
      const payouts = await getPayouts(env);
      const p = payouts.find((x) => x.id === payoutId);

      if (!p || p.status !== "pending") {
        await ctx.answerCallbackQuery({ text: "⚠️ Payout already processed." });
        return;
      }

      p.status = isApprove ? "paid" : "rejected";
      await savePayouts(env, payouts);

      const u = await getUser(env, p.userId);
      if (u) {
        if (isApprove) {
          u.withdrawn = Number(u.withdrawn || 0) + Number(p.amount || 0);
        } else {
          // Refund balance on rejection
          u.balance = Number(u.balance || 0) + Number(p.amount || 0);
        }
        await saveUser(env, u);

        try {
          await ctx.api.sendMessage(
            Number(p.userId),
            isApprove
              ? `💸 <b>Withdrawal Paid!</b>\n\nYour payout of <code>${formatMoney(
                  p.amount,
                  settings.currencySymbol
                )}</code> to wallet <code>${escapeHtml(p.wallet)}</code> has been completed!`
              : `⚠️ <b>Withdrawal Rejected & Refunded</b>\n\nYour withdrawal request of <code>${formatMoney(
                  p.amount,
                  settings.currencySymbol
                )}</code> was returned to your balance.`,
            { parse_mode: "HTML" }
          );
        } catch (_) {}
      }

      await ctx.answerCallbackQuery({
        text: isApprove ? "✅ Marked as Paid!" : "❌ Rejected & Refunded to User.",
      });

      await ctx.editMessageText(
        `💳 <b>Manage Payments / Payouts</b>\n━━━━━━━━━━━━━━━━━━━━━━\nProcessed payout <code>${p.id}</code> (${p.status.toUpperCase()}).`,
        {
          parse_mode: "HTML",
          reply_markup: new InlineKeyboard()
            .text("💳 Next Pending Payout", "admin:manage_payouts")
            .row()
            .text("🔙 Back to Admin Panel", "admin:home"),
        }
      );
      return;
    }

    // 8. 🎁 Set Rewards / Bonuses
    if (actionPayload === "set_rewards") {
      await ctx.answerCallbackQuery();
      user.state = "ADMIN_SET_REWARDS";
      await saveUser(env, user);

      const text =
        `🎁 <b>Set Rewards / Bonuses Configuration</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `• <b>Welcome Bonus:</b> <code>${formatMoney(settings.welcomeBonus, settings.currencySymbol)}</code>\n` +
        `• <b>Referral Bonus:</b> <code>${formatMoney(settings.referralBonus, settings.currencySymbol)}</code>\n` +
        `• <b>Daily Bonus:</b> <code>${formatMoney(settings.dailyBonus, settings.currencySymbol)}</code>\n` +
        `• <b>Min Withdrawal:</b> <code>${formatMoney(settings.minWithdraw, settings.currencySymbol)}</code>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `To update, send 4 pipe-separated numbers:\n` +
        `<code>WelcomeBonus | ReferralBonus | DailyBonus | MinWithdraw</code>\n\n` +
        `<b>Example:</b>\n` +
        `<code>1.50 | 2.00 | 0.50 | 10.00</code>`;

      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: buildAdminBackKeyboard(),
      });
      return;
    }

    // 9. 📢 Force Channel Verification
    if (actionPayload === "force_channel") {
      await ctx.answerCallbackQuery();
      const kb = new InlineKeyboard()
        .text(
          settings.forceChannelEnabled
            ? "🔴 Disable Force Channel"
            : "🟢 Enable Force Channel",
          "admin:fc_toggle"
        )
        .row()
        .text("✏️ Update Channel URL / Chat ID", "admin:fc_edit")
        .row()
        .text("🔙 Back to Admin Panel", "admin:home");

      const text =
        `📢 <b>Force Channel Verification Settings</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🚦 <b>Status:</b> <code>${settings.forceChannelEnabled ? "ENABLED 🟢" : "DISABLED 🔴"}</code>\n` +
        `🔗 <b>Channel Invite Link:</b>\n<code>${escapeHtml(settings.forceChannelUrl)}</code>\n` +
        `🆔 <b>API Chat ID (Optional):</b> <code>${escapeHtml(
          settings.forceChannelChatId || "Not Set (Uses Click Verification)"
        )}</code>`;

      await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
      return;
    }

    if (actionPayload === "fc_toggle") {
      settings.forceChannelEnabled = !settings.forceChannelEnabled;
      await saveSettings(env, settings);
      await ctx.answerCallbackQuery({
        text: `Force Channel is now ${settings.forceChannelEnabled ? "ENABLED 🟢" : "DISABLED 🔴"}`,
      });

      const kb = new InlineKeyboard()
        .text(
          settings.forceChannelEnabled
            ? "🔴 Disable Force Channel"
            : "🟢 Enable Force Channel",
          "admin:fc_toggle"
        )
        .row()
        .text("✏️ Update Channel URL / Chat ID", "admin:fc_edit")
        .row()
        .text("🔙 Back to Admin Panel", "admin:home");

      await ctx.editMessageText(
        `📢 <b>Force Channel Verification Settings</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🚦 <b>Status:</b> <code>${settings.forceChannelEnabled ? "ENABLED 🟢" : "DISABLED 🔴"}</code>\n` +
          `🔗 <b>Channel Invite Link:</b>\n<code>${escapeHtml(settings.forceChannelUrl)}</code>`,
        { parse_mode: "HTML", reply_markup: kb }
      );
      return;
    }

    if (actionPayload === "fc_edit") {
      await ctx.answerCallbackQuery();
      user.state = "ADMIN_SET_FORCE_CHANNEL";
      await saveUser(env, user);

      await ctx.editMessageText(
        `📢 <b>Update Force Channel Link</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Send the new Telegram channel URL (optionally followed by <code>| ChatID</code>):\n\n` +
          `<b>Example:</b>\n` +
          `<code>https://t.me/+ukH5GufIKTthNzA9</code>\n` +
          `or\n` +
          `<code>https://t.me/+ukH5GufIKTthNzA9 | -100192837465</code>`,
        { parse_mode: "HTML", reply_markup: buildAdminBackKeyboard() }
      );
      return;
    }

    // 10. 👥 Manage Admins
    if (actionPayload === "manage_admins") {
      await ctx.answerCallbackQuery();
      const kb = new InlineKeyboard();
      for (const adminId of settings.admins) {
        const isPrimary = String(adminId) === String(cfg.OWNER_ID);
        kb.text(
          isPrimary ? `👑 Owner (${adminId})` : `🛡️ Admin (${adminId}) — Remove ❌`,
          isPrimary ? "admin:noop" : `admin:remove_admin:${adminId}`
        ).row();
      }
      kb.text("➕ Add Co-Admin by ID", "admin:add_admin_prompt").row();
      kb.text("🔙 Back to Admin Panel", "admin:home");

      const text =
        `👥 <b>Manage Platform Administrators</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👑 <b>Primary Owner ID:</b> <code>${cfg.OWNER_ID}</code>\n` +
        `🛡️ <b>Total Authorized Admins:</b> <code>${settings.admins.length}</code>\n\n` +
        `<i>Click a secondary admin to revoke access, or add a new admin below:</i>`;

      await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
      return;
    }

    if (actionPayload === "noop") {
      await ctx.answerCallbackQuery({
        text: "👑 Primary Owner cannot be removed.",
        show_alert: true,
      });
      return;
    }

    if (actionPayload.startsWith("remove_admin:")) {
      if (!isOwner(userId, env)) {
        await ctx.answerCallbackQuery({
          text: "⛔ Only the Primary Owner can remove admins.",
          show_alert: true,
        });
        return;
      }
      const targetAdmin = actionPayload.replace("remove_admin:", "");
      settings.admins = settings.admins.filter(
        (id) => String(id) !== String(targetAdmin) || String(id) === String(cfg.OWNER_ID)
      );
      await saveSettings(env, settings);
      await ctx.answerCallbackQuery({ text: `Removed Admin ${targetAdmin}` });

      const kb = new InlineKeyboard();
      for (const adminId of settings.admins) {
        const isPrimary = String(adminId) === String(cfg.OWNER_ID);
        kb.text(
          isPrimary ? `👑 Owner (${adminId})` : `🛡️ Admin (${adminId}) — Remove ❌`,
          isPrimary ? "admin:noop" : `admin:remove_admin:${adminId}`
        ).row();
      }
      kb.text("➕ Add Co-Admin by ID", "admin:add_admin_prompt").row();
      kb.text("🔙 Back to Admin Panel", "admin:home");

      await ctx.editMessageReplyMarkup({ reply_markup: kb });
      return;
    }

    if (actionPayload === "add_admin_prompt") {
      if (!isOwner(userId, env)) {
        await ctx.answerCallbackQuery({
          text: "⛔ Only the Primary Owner can add new admins.",
          show_alert: true,
        });
        return;
      }
      await ctx.answerCallbackQuery();
      user.state = "ADMIN_ADD_ADMIN";
      await saveUser(env, user);

      await ctx.editMessageText(
        `👥 <b>Add New Co-Admin</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Please send the numeric <b>Telegram User ID</b> of the new administrator:`,
        { parse_mode: "HTML", reply_markup: buildAdminBackKeyboard() }
      );
      return;
    }

    // 11. 📢 Broadcast System
    if (actionPayload === "broadcast") {
      await ctx.answerCallbackQuery();
      user.state = "ADMIN_BROADCAST";
      await saveUser(env, user);

      const userIds = await getUserIndex(env);
      await ctx.editMessageText(
        `📢 <b>Global Broadcast System</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `👥 <b>Target Audience:</b> <code>${userIds.length} registered users</code>\n\n` +
          `Send the announcement message you want to broadcast to all users (HTML formatting is supported):`,
        { parse_mode: "HTML", reply_markup: buildAdminBackKeyboard() }
      );
      return;
    }

    // 12. ⚙️ Maintenance Mode
    if (actionPayload === "maintenance") {
      settings.maintenanceMode = !settings.maintenanceMode;
      await saveSettings(env, settings);

      await ctx.answerCallbackQuery({
        text: `⚙️ Maintenance Mode is now ${settings.maintenanceMode ? "ACTIVE 🟠" : "OFF 🟢"}`,
        show_alert: true,
      });

      const text = await buildAdminDashboardText(env);
      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: buildAdminPanelKeyboard(),
      });
      return;
    }

    // 13. ⚠️ Wipe / Reset All Platform Data
    if (actionPayload === "wipe_confirm") {
      if (!isOwner(userId, env)) {
        await ctx.answerCallbackQuery({
          text: "⛔ Only the Primary Owner can wipe platform data.",
          show_alert: true,
        });
        return;
      }
      await ctx.answerCallbackQuery();
      const kb = new InlineKeyboard()
        .text("⚠️ YES, WIPE ALL KV DATA NOW", "admin:wipe_execute")
        .row()
        .text("🔙 Cancel & Return Safe", "admin:home");

      await ctx.editMessageText(
        `⚠️ <b>CRITICAL WARNING: WIPE ALL PLATFORM DATA</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Are you sure you want to reset all users, balances, tasks, submissions, and payout logs in <code>env.DB</code>?\n\n` +
          `<i>This action cannot be undone!</i>`,
        { parse_mode: "HTML", reply_markup: kb }
      );
      return;
    }

    if (actionPayload === "wipe_execute") {
      if (!isOwner(userId, env)) {
        await ctx.answerCallbackQuery({ text: "⛔ Unauthorized.", show_alert: true });
        return;
      }
      const userIds = await getUserIndex(env);
      for (const uid of userIds) {
        await kvDelete(env, `user:${uid}`);
      }
      await kvPutJSON(env, "sys:users_index", []);
      await kvPutJSON(env, "sys:tasks", DEFAULT_TASKS);
      await kvPutJSON(env, "sys:submissions", []);
      await kvPutJSON(env, "sys:payouts", []);
      await kvPutJSON(env, "sys:settings", {
        ...DEFAULT_SETTINGS,
        forceChannelUrl: cfg.FORCE_CHANNEL,
        supportUsername: cfg.SUPPORT_USERNAME,
        admins: [cfg.OWNER_ID],
      });

      await ctx.answerCallbackQuery({
        text: "✅ All platform KV data has been wiped and reset to factory defaults.",
        show_alert: true,
      });

      const dashboardText = await buildAdminDashboardText(env);
      await ctx.editMessageText(dashboardText, {
        parse_mode: "HTML",
        reply_markup: buildAdminPanelKeyboard(),
      });
      return;
    }

    // 14. 🔙 Close Admin Panel
    if (actionPayload === "close") {
      await ctx.answerCallbackQuery({ text: "🔒 Admin Panel Closed." });
      try {
        await ctx.deleteMessage();
      } catch (_) {
        await ctx.editMessageText("🔒 <b>Admin Panel Session Closed.</b> Type /admin to reopen.", {
          parse_mode: "HTML",
        });
      }
      return;
    }
  });

  // --------------------------------------------------------------------------
  // COMMAND: /cancel (Clears active user/admin conversational input state)
  // --------------------------------------------------------------------------
  bot.command("cancel", async (ctx) => {
    const { user } = ctx.state;
    user.state = null;
    user.stateData = {};
    await saveUser(env, user);
    await ctx.reply("✅ Current operation cancelled.", {
      reply_markup: buildUserReplyKeyboard(),
    });
  });

  // ==========================================================================
  // 8. MESSAGE HANDLER (Reply Keyboard Buttons & Conversational States)
  // ==========================================================================
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text.trim();
    const { user, settings, cfg } = ctx.state;

    // ------------------------------------------------------------------------
    // A. Handle Active Conversational Input States (Admin & User)
    // ------------------------------------------------------------------------
    if (user.state) {
      const currentState = user.state;

      // 1. Admin Creating Task
      if (currentState === "ADMIN_CREATE_TASK" && (await isAuthorizedAdmin(user.id, env))) {
        const parts = text.split("|").map((s) => s.trim());
        if (parts.length < 3) {
          await ctx.reply(
            `⚠️ <b>Invalid Format!</b> Please use:\n<code>Title | Description | RewardAmount | URL</code>`,
            { parse_mode: "HTML" }
          );
          return;
        }
        const [title, description, rewardRaw, url] = parts;
        const reward = Math.max(0, Number(rewardRaw) || 1.0);
        const tasks = await getTasks(env);
        const newTask = {
          id: `task_${Date.now().toString().slice(-5)}`,
          title,
          description,
          reward,
          url: url || settings.forceChannelUrl,
          active: true,
          createdAt: new Date().toISOString(),
        };
        tasks.push(newTask);
        await saveTasks(env, tasks);

        user.state = null;
        await saveUser(env, user);

        await ctx.reply(
          `✅ <b>New Task Created Successfully!</b>\n\n` +
            `🎯 <b>Title:</b> ${escapeHtml(newTask.title)}\n` +
            `🎁 <b>Reward:</b> <code>${formatMoney(newTask.reward, settings.currencySymbol)}</code>`,
          { parse_mode: "HTML", reply_markup: buildAdminPanelKeyboard() }
        );
        return;
      }

      // 2. Admin Inspecting User by ID
      if (currentState === "ADMIN_INSPECT_USER" && (await isAuthorizedAdmin(user.id, env))) {
        const targetUid = text.replace(/[^0-9]/g, "");
        const target = await getUser(env, targetUid);
        user.state = null;
        await saveUser(env, user);

        if (!target) {
          await ctx.reply(`❌ No user found with ID <code>${escapeHtml(text)}</code>.`, {
            parse_mode: "HTML",
            reply_markup: buildAdminBackKeyboard(),
          });
          return;
        }

        const kb = new InlineKeyboard()
          .text("➕ Add +5.00 Balance", `admin:user_mod:add_bal:${target.id}`)
          .text("🧹 Reset Balance", `admin:user_mod:zero_bal:${target.id}`)
          .row()
          .text(
            target.banned ? "✅ Unban User" : "🚫 Ban User",
            `admin:user_mod:ban_toggle:${target.id}`
          )
          .row()
          .text("🔙 Back to Admin Panel", "admin:home");

        await ctx.reply(
          `🔍 <b>User Profile Inspection</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🆔 <b>User ID:</b> <code>${target.id}</code>\n` +
            `👤 <b>Name:</b> ${escapeHtml(target.firstName)} (${escapeHtml(target.username)})\n` +
            `💰 <b>Balance:</b> <code>${formatMoney(target.balance, settings.currencySymbol)}</code>\n` +
            `📈 <b>Total Earned:</b> <code>${formatMoney(
              target.totalEarned,
              settings.currencySymbol
            )}</code>\n` +
            `👥 <b>Referrals:</b> <code>${target.referralsCount}</code>\n` +
            `🏦 <b>Wallet:</b> <code>${escapeHtml(target.walletAddress)}</code>\n` +
            `🚦 <b>Status:</b> ${target.banned ? "🚫 BANNED" : "🟢 ACTIVE"}`,
          { parse_mode: "HTML", reply_markup: kb }
        );
        return;
      }

      // 3. Admin Updating Rewards
      if (currentState === "ADMIN_SET_REWARDS" && (await isAuthorizedAdmin(user.id, env))) {
        const parts = text.split("|").map((s) => Number(s.trim()));
        if (parts.length < 4 || parts.some((n) => Number.isNaN(n) || n < 0)) {
          await ctx.reply(
            `⚠️ Invalid numbers. Send 4 pipe-separated values:\n<code>WelcomeBonus | ReferralBonus | DailyBonus | MinWithdraw</code>`,
            { parse_mode: "HTML" }
          );
          return;
        }
        settings.welcomeBonus = parts[0];
        settings.referralBonus = parts[1];
        settings.dailyBonus = parts[2];
        settings.minWithdraw = parts[3];
        await saveSettings(env, settings);

        user.state = null;
        await saveUser(env, user);

        await ctx.reply(
          `✅ <b>Rewards & Bonuses Updated!</b>\n\n` +
            `🎁 Welcome: <code>${formatMoney(settings.welcomeBonus, settings.currencySymbol)}</code>\n` +
            `👥 Referral: <code>${formatMoney(settings.referralBonus, settings.currencySymbol)}</code>\n` +
            `📅 Daily Bonus: <code>${formatMoney(settings.dailyBonus, settings.currencySymbol)}</code>\n` +
            `💸 Min Withdraw: <code>${formatMoney(settings.minWithdraw, settings.currencySymbol)}</code>`,
          { parse_mode: "HTML", reply_markup: buildAdminPanelKeyboard() }
        );
        return;
      }

      // 4. Admin Updating Force Channel
      if (currentState === "ADMIN_SET_FORCE_CHANNEL" && (await isAuthorizedAdmin(user.id, env))) {
        const parts = text.split("|").map((s) => s.trim());
        settings.forceChannelUrl = parts[0] || cfg.FORCE_CHANNEL;
        settings.forceChannelChatId = parts[1] || "";
        await saveSettings(env, settings);

        user.state = null;
        await saveUser(env, user);

        await ctx.reply(
          `✅ <b>Force Channel Updated!</b>\n🔗 URL: <code>${escapeHtml(
            settings.forceChannelUrl
          )}</code>\n🆔 Chat ID: <code>${escapeHtml(settings.forceChannelChatId || "None")}</code>`,
          { parse_mode: "HTML", reply_markup: buildAdminPanelKeyboard() }
        );
        return;
      }

      // 5. Admin Adding Co-Admin
      if (currentState === "ADMIN_ADD_ADMIN" && isOwner(user.id, env)) {
        const newAdminId = text.replace(/[^0-9]/g, "");
        if (!newAdminId) {
          await ctx.reply("⚠️ Please send a valid numeric Telegram User ID.");
          return;
        }
        if (!settings.admins.includes(newAdminId)) {
          settings.admins.push(newAdminId);
          await saveSettings(env, settings);
        }
        user.state = null;
        await saveUser(env, user);

        await ctx.reply(`✅ Added <code>${newAdminId}</code> as an authorized Co-Admin!`, {
          parse_mode: "HTML",
          reply_markup: buildAdminPanelKeyboard(),
        });
        return;
      }

      // 6. Admin Broadcasting Message
      if (currentState === "ADMIN_BROADCAST" && (await isAuthorizedAdmin(user.id, env))) {
        const userIds = await getUserIndex(env);
        let delivered = 0;
        let failed = 0;

        for (const uid of userIds) {
          try {
            await ctx.api.sendMessage(
              Number(uid),
              `📢 <b>Official Broadcast</b>\n━━━━━━━━━━━━━━━━━━━━━━\n${text}`,
              { parse_mode: "HTML" }
            );
            delivered++;
          } catch (_) {
            failed++;
          }
        }

        user.state = null;
        await saveUser(env, user);

        await ctx.reply(
          `📢 <b>Broadcast Complete!</b>\n\n✅ <b>Delivered:</b> <code>${delivered}</code>\n❌ <b>Failed/Blocked:</b> <code>${failed}</code>`,
          { parse_mode: "HTML", reply_markup: buildAdminPanelKeyboard() }
        );
        return;
      }

      // 7. User Submitting Task Proof
      if (currentState === "USER_SUBMITTING_TASK") {
        const { taskId, taskTitle, reward } = user.stateData || {};
        const submissions = await getSubmissions(env);
        const newSub = {
          id: `sub_${Date.now().toString().slice(-6)}`,
          userId: user.id,
          userName: user.firstName,
          taskId,
          taskTitle,
          reward,
          proof: text,
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        submissions.push(newSub);
        await saveSubmissions(env, submissions);

        if (!user.pendingTasks.includes(taskId)) {
          user.pendingTasks.push(taskId);
        }
        user.state = null;
        user.stateData = {};
        await saveUser(env, user);

        await ctx.reply(
          `✅ <b>Proof Submitted Successfully!</b>\n\n` +
            `🎯 <b>Task:</b> ${escapeHtml(taskTitle)}\n` +
            `🆔 <b>Ticket:</b> <code>${newSub.id}</code>\n\n` +
            `<i>Our administrators will review your submission and credit your reward shortly.</i>`,
          { parse_mode: "HTML", reply_markup: buildUserReplyKeyboard() }
        );
        return;
      }

      // 8. User Setting Wallet Address
      if (currentState === "USER_SETTING_WALLET") {
        if (text.length < 8) {
          await ctx.reply("⚠️ Please enter a valid wallet address (minimum 8 characters).");
          return;
        }
        user.walletAddress = text;
        user.state = null;
        await saveUser(env, user);

        await ctx.reply(
          `✅ <b>Wallet Address Updated!</b>\n\n🏦 <code>${escapeHtml(user.walletAddress)}</code>`,
          { parse_mode: "HTML", reply_markup: buildUserReplyKeyboard() }
        );
        return;
      }

      // 9. User Requesting Withdrawal Amount
      if (currentState === "USER_WITHDRAW_AMOUNT") {
        const amount = Number(text);
        if (
          Number.isNaN(amount) ||
          amount < Number(settings.minWithdraw) ||
          amount > Number(user.balance)
        ) {
          await ctx.reply(
            `⚠️ Invalid amount! Enter a number between <code>${formatMoney(
              settings.minWithdraw,
              settings.currencySymbol
            )}</code> and <code>${formatMoney(user.balance, settings.currencySymbol)}</code>.`,
            { parse_mode: "HTML" }
          );
          return;
        }

        user.balance = Number(user.balance) - amount;
        user.state = null;
        await saveUser(env, user);

        const payouts = await getPayouts(env);
        const payoutTicket = {
          id: `pay_${Date.now().toString().slice(-6)}`,
          userId: user.id,
          userName: user.firstName,
          amount,
          wallet: user.walletAddress,
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        payouts.push(payoutTicket);
        await savePayouts(env, payouts);

        await ctx.reply(
          `🎉 <b>Withdrawal Request Submitted!</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🆔 <b>Request ID:</b> <code>${payoutTicket.id}</code>\n` +
            `💸 <b>Amount:</b> <code>${formatMoney(amount, settings.currencySymbol)}</code>\n` +
            `🏦 <b>Wallet:</b> <code>${escapeHtml(user.walletAddress)}</code>\n` +
            `⏳ <b>Status:</b> Pending Admin Approval`,
          { parse_mode: "HTML", reply_markup: buildUserReplyKeyboard() }
        );
        return;
      }
    }

    // ------------------------------------------------------------------------
    // B. Enforce Force Channel Verification Before Menu Actions
    // ------------------------------------------------------------------------
    const isVerified = await verifyChannelMembership(ctx, env, user, settings);
    if (!isVerified) {
      await sendForceChannelPrompt(ctx, settings);
      return;
    }

    // ------------------------------------------------------------------------
    // C. Handle User Bottom Reply Keyboard Buttons
    // ------------------------------------------------------------------------
    if (text === "🎯 Earn Tasks") {
      const tasks = (await getTasks(env)).filter((t) => t.active);
      const kb = new InlineKeyboard();
      for (const t of tasks) {
        const done = (user.completedTasks || []).includes(t.id);
        const pend = (user.pendingTasks || []).includes(t.id);
        const prefix = done ? "✅" : pend ? "⏳" : "🎯";
        kb.text(
          `${prefix} ${t.title} (+${formatMoney(t.reward, settings.currencySymbol)})`,
          `task:view:${t.id}`
        ).row();
      }

      await ctx.reply(
        tasks.length > 0
          ? `🎯 <b>Available Earning Tasks (${tasks.length})</b>\n\nSelect any task below to view instructions and claim your reward:`
          : `📭 <b>No Active Tasks</b>\n\nCheck back soon for new reward campaigns!`,
        { parse_mode: "HTML", reply_markup: kb }
      );
      return;
    }

    if (text === "💰 My Balance") {
      const balText =
        `💰 <b>Account Financial Overview</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>User:</b> ${escapeHtml(user.firstName)} (<code>${user.id}</code>)\n` +
        `💵 <b>Available Balance:</b> <code>${formatMoney(
          user.balance,
          settings.currencySymbol
        )}</code>\n` +
        `📈 <b>Total Lifetime Earned:</b> <code>${formatMoney(
          user.totalEarned,
          settings.currencySymbol
        )}</code>\n` +
        `💸 <b>Total Withdrawn:</b> <code>${formatMoney(
          user.withdrawn,
          settings.currencySymbol
        )}</code>\n` +
        `✅ <b>Completed Tasks:</b> <code>${(user.completedTasks || []).length}</code>`;

      await ctx.reply(balText, { parse_mode: "HTML" });
      return;
    }

    if (text === "💳 Wallet & Withdraw") {
      const kb = new InlineKeyboard()
        .text("✏️ Set / Update Wallet Address", "wallet:set_address")
        .row()
        .text("💸 Request Withdrawal", "wallet:withdraw");

      const walletText =
        `💳 <b>Wallet & Payout Center</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🏦 <b>Saved Wallet Address:</b>\n<code>${escapeHtml(user.walletAddress)}</code>\n\n` +
        `💰 <b>Withdrawable Balance:</b> <code>${formatMoney(
          user.balance,
          settings.currencySymbol
        )}</code>\n` +
        `📉 <b>Minimum Withdrawal:</b> <code>${formatMoney(
          settings.minWithdraw,
          settings.currencySymbol
        )}</code>`;

      await ctx.reply(walletText, { parse_mode: "HTML", reply_markup: kb });
      return;
    }

    if (text === "👥 Refer & Earn") {
      const botUsername = ctx.me?.username || "ZenoxWorkerBot";
      const refLink = `https://t.me/${botUsername}?start=ref_${user.id}`;

      const refText =
        `👥 <b>Partner Referral Program</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🎁 <b>Reward Per Referral:</b> <code>+${formatMoney(
          settings.referralBonus,
          settings.currencySymbol
        )}</code>\n` +
        `👥 <b>Your Total Referrals:</b> <code>${user.referralsCount}</code>\n` +
        `💵 <b>Referral Earnings:</b> <code>${formatMoney(
          Number(user.referralsCount) * Number(settings.referralBonus),
          settings.currencySymbol
        )}</code>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🔗 <b>Your Personal Invite Link:</b>\n<code>${refLink}</code>\n\n` +
        `<i>Share your link with friends and earn instant bonuses when they join!</i>`;

      await ctx.reply(refText, { parse_mode: "HTML" });
      return;
    }

    if (text === "🎁 Daily Bonus") {
      const now = Date.now();
      const cooldownMs = 24 * 60 * 60 * 1000;
      const lastClaim = user.lastDailyBonus ? new Date(user.lastDailyBonus).getTime() : 0;

      if (now - lastClaim < cooldownMs) {
        const remainingHours = Math.ceil((cooldownMs - (now - lastClaim)) / (1000 * 60 * 60));
        await ctx.reply(
          `⏳ <b>Daily Bonus Cooldown</b>\n\nYou have already claimed your daily reward today. Please come back in approximately <b>${remainingHours} hour(s)</b>!`,
          { parse_mode: "HTML" }
        );
        return;
      }

      const bonus = Number(settings.dailyBonus || 0.5);
      user.balance = Number(user.balance || 0) + bonus;
      user.totalEarned = Number(user.totalEarned || 0) + bonus;
      user.lastDailyBonus = new Date(now).toISOString();
      await saveUser(env, user);

      await ctx.reply(
        `🎁 <b>Daily Bonus Claimed!</b>\n\n` +
          `➕ <b>Reward Added:</b> <code>+${formatMoney(bonus, settings.currencySymbol)}</code>\n` +
          `💰 <b>New Balance:</b> <code>${formatMoney(user.balance, settings.currencySymbol)}</code>\n\n` +
          `<i>Come back tomorrow for another bonus!</i>`,
        { parse_mode: "HTML" }
      );
      return;
    }

    if (text === "🛟 Support") {
      const supportHandle = settings.supportUsername || cfg.SUPPORT_USERNAME;
      const cleanHandle = supportHandle.replace("@", "");
      const kb = new InlineKeyboard().url("💬 Contact Live Support", `https://t.me/${cleanHandle}`);

      await ctx.reply(
        `🛟 <b>Customer Support & Help Desk</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Need help with tasks, account verification, or payouts?\n\n` +
          `👨‍💻 <b>Official Support:</b> ${escapeHtml(supportHandle)}\n` +
          `🆔 <b>Your Support UID:</b> <code>${user.id}</code>`,
        { parse_mode: "HTML", reply_markup: kb }
      );
      return;
    }

    // Default fallback for unrecognized text
    await ctx.reply(
      `🤖 Please use the menu buttons below or type /start to refresh your dashboard.`,
      { reply_markup: buildUserReplyKeyboard() }
    );
  });

  return bot;
}

// ============================================================================
// 9. CLOUDFLARE WORKERS FETCH ENTRYPOINT (ZERO-CRASH WEBHOOK HANDLER)
// ============================================================================
export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const cfg = resolveEnvConfig(env);

      // 1. Convenient Webhook Registration Endpoint: GET /setWebhook
      if (request.method === "GET" && url.pathname === "/setWebhook") {
        const webhookUrl = `${url.origin}/`;
        const tgRes = await fetch(
          `https://api.telegram.org/bot${cfg.BOT_TOKEN}/setWebhook?url=${encodeURIComponent(
            webhookUrl
          )}&drop_pending_updates=true`
        );
        const data = await tgRes.json();
        return new Response(JSON.stringify({ ok: true, webhookUrl, telegramResponse: data }, null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // 2. Health Check Endpoint: GET /
      if (request.method === "GET") {
        return new Response(
          JSON.stringify({
            status: "OK",
            service: "Zenox Telegram Worker Bot (grammY)",
            ownerId: cfg.OWNER_ID,
            support: cfg.SUPPORT_USERNAME,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // 3. Telegram Webhook Update Processing: POST /
      if (request.method === "POST") {
        const update = await request.json();
        const bot = createBotInstance(env);

        // Initialize bot metadata if not cached or run update inside try/catch
        await bot.init();
        await bot.handleUpdate(update);

        return new Response("OK", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      }

      return new Response("OK", { status: 200 });
    } catch (error) {
      // Log error internally and ALWAYS return HTTP 200 OK to Telegram so webhooks never retry-flood
      console.error("[Worker Global Webhook Catch]:", error);
      return new Response("OK", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }
  },
};
