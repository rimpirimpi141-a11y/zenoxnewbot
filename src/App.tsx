/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Copy,
  Check,
  Download,
  Terminal,
  Send,
  Database,
  Shield,
  User,
  RefreshCw,
  FileCode,
  Sliders,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { WORKER_JS_SOURCE, buildWranglerToml } from './workerSource';

interface InlineBtn {
  label: string;
  callbackData?: string;
  url?: string;
}

interface SimMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  inlineKeyboard?: InlineBtn[][];
  deleted?: boolean;
}

interface TaskItem {
  id: string;
  title: string;
  description: string;
  reward: number;
  url: string;
  active: boolean;
}

interface SubmissionItem {
  id: string;
  userId: string;
  userName: string;
  taskId: string;
  taskTitle: string;
  reward: number;
  proof: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

interface PayoutItem {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  wallet: string;
  status: 'pending' | 'paid' | 'rejected';
  createdAt: string;
}

interface UserRecord {
  id: string;
  username: string;
  firstName: string;
  balance: number;
  totalEarned: number;
  withdrawn: number;
  referralsCount: number;
  walletAddress: string;
  completedTasks: string[];
  pendingTasks: string[];
  verifiedChannel: boolean;
  banned: boolean;
  lastDailyBonus: string | null;
  state: string | null;
  stateData?: Record<string, any>;
}

const INITIAL_TASKS: TaskItem[] = [
  {
    id: 'task_101',
    title: '📢 Join Official Announcements Channel',
    description: 'Subscribe to our official Telegram channel and stay active for updates and reward drops.',
    reward: 1.5,
    url: 'https://t.me/+ukH5GufIKTthNzA9',
    active: true,
  },
  {
    id: 'task_102',
    title: '🐦 Follow Partner X (Twitter) & Retweet Pinned Post',
    description: 'Follow our official X account, like and retweet the pinned post, then submit your @username as proof.',
    reward: 2.5,
    url: 'https://x.com',
    active: true,
  },
  {
    id: 'task_103',
    title: '💬 Invite 3 Active Friends via Referral Link',
    description: 'Share your personal referral link in crypto communities and submit a screenshot once completed.',
    reward: 3.0,
    url: 'https://t.me/+ukH5GufIKTthNzA9',
    active: true,
  },
];

const INITIAL_USERS: Record<string, UserRecord> = {
  '8838351233': {
    id: '8838351233',
    username: '@ZenoxOwner',
    firstName: 'Zenox Admin',
    balance: 125.0,
    totalEarned: 240.0,
    withdrawn: 115.0,
    referralsCount: 18,
    walletAddress: 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb',
    completedTasks: ['task_101'],
    pendingTasks: [],
    verifiedChannel: true,
    banned: false,
    lastDailyBonus: null,
    state: null,
  },
  '5519204811': {
    id: '5519204811',
    username: '@AlexTrader',
    firstName: 'Alex Rivera',
    balance: 11.5,
    totalEarned: 11.5,
    withdrawn: 0,
    referralsCount: 2,
    walletAddress: 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7',
    completedTasks: [],
    pendingTasks: ['task_102'],
    verifiedChannel: false,
    banned: false,
    lastDailyBonus: null,
    state: null,
  },
};

const INITIAL_SUBMISSIONS: SubmissionItem[] = [
  {
    id: 'sub_804219',
    userId: '5519204811',
    userName: 'Alex Rivera',
    taskId: 'task_102',
    taskTitle: '🐦 Follow Partner X (Twitter) & Retweet Pinned Post',
    reward: 2.5,
    proof: '@AlexTrader_X — Retweeted link: https://x.com/AlexTrader_X/status/1892341',
    status: 'pending',
    createdAt: '2026-11-04 18:45:00 UTC',
  },
];

const INITIAL_PAYOUTS: PayoutItem[] = [
  {
    id: 'pay_309184',
    userId: '5519204811',
    userName: 'Alex Rivera',
    amount: 10.0,
    wallet: 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7',
    status: 'pending',
    createdAt: '2026-11-04 18:55:12 UTC',
  },
];

function buildAdminPanelButtons(): InlineBtn[][] {
  return [
    [
      { label: '➕ Create / Add', callbackData: 'admin:create_add' },
      { label: '📋 Manage Custom / Tasks', callbackData: 'admin:manage_tasks' },
    ],
    [{ label: '📝 Review Pending Submissions', callbackData: 'admin:review_submissions' }],
    [
      { label: '👥 View All Users', callbackData: 'admin:view_users:0' },
      { label: '🔍 Inspect User', callbackData: 'admin:inspect_user' },
    ],
    [
      { label: '📊 Real-Time Analytics', callbackData: 'admin:analytics' },
      { label: '💳 Manage Payments / Payouts', callbackData: 'admin:manage_payouts' },
    ],
    [
      { label: '🎁 Set Rewards / Bonuses', callbackData: 'admin:set_rewards' },
      { label: '📢 Force Channel Verification', callbackData: 'admin:force_channel' },
    ],
    [
      { label: '👥 Manage Admins', callbackData: 'admin:manage_admins' },
      { label: '📢 Broadcast System', callbackData: 'admin:broadcast' },
    ],
    [
      { label: '⚙️ Maintenance Mode', callbackData: 'admin:maintenance' },
      { label: '⚠️ Wipe / Reset All Platform Data', callbackData: 'admin:wipe_confirm' },
    ],
    [{ label: '🔙 Close Admin Panel', callbackData: 'admin:close' }],
  ];
}

export default function App() {
  const [activeView, setActiveView] = useState<'code' | 'simulator' | 'kv' | 'deploy'>('code');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedToml, setCopiedToml] = useState(false);

  // Environment Config
  const [envConfig, setEnvConfig] = useState({
    botToken: '9162764699:AAGUZ-mJ4qAIHyCs0GLNAB5JeZxQjCmALWQ',
    ownerId: '8838351233',
    supportUsername: '@ZenoxWorker',
    forceChannel: 'https://t.me/+ukH5GufIKTthNzA9',
  });

  // Simulated Cloudflare KV (`env.DB`) state
  const [users, setUsers] = useState<Record<string, UserRecord>>(INITIAL_USERS);
  const [tasks, setTasks] = useState<TaskItem[]>(INITIAL_TASKS);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>(INITIAL_SUBMISSIONS);
  const [payouts, setPayouts] = useState<PayoutItem[]>(INITIAL_PAYOUTS);
  const [settings, setSettings] = useState({
    maintenanceMode: false,
    forceChannelEnabled: true,
    forceChannelUrl: 'https://t.me/+ukH5GufIKTthNzA9',
    forceChannelChatId: '',
    currencySymbol: 'USDT',
    welcomeBonus: 1.5,
    referralBonus: 2.0,
    dailyBonus: 0.5,
    minWithdraw: 10.0,
    admins: ['8838351233'],
  });

  // Active Simulator Persona ('8838351233' Owner or '5519204811' Standard User)
  const [activeUserId, setActiveUserId] = useState<string>('8838351233');
  const [chatInput, setChatInput] = useState('');
  const [toastAlert, setToastAlert] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<SimMessage[]>([
    {
      id: 'msg_init_1',
      sender: 'user',
      text: '/admin',
      timestamp: '19:11',
    },
    {
      id: 'msg_init_2',
      sender: 'bot',
      text:
        `🛡️ ZENOX EXECUTIVE ADMIN CONTROL PANEL\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👥 Total Registered Users: 2\n` +
        `📋 Active Tasks: 3 / 3\n` +
        `📝 Pending Submissions: 1\n` +
        `💳 Pending Payouts: 1\n` +
        `📢 Force Channel: ENABLED 🟢\n` +
        `⚙️ Maintenance Mode: OFF 🟢\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Select a management module below:`,
      timestamp: '19:11',
      inlineKeyboard: buildAdminPanelButtons(),
    },
  ]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const showToast = (msg: string) => {
    setToastAlert(msg);
    setTimeout(() => setToastAlert(null), 3200);
  };

  const handleCopyWorker = async () => {
    await navigator.clipboard.writeText(WORKER_JS_SOURCE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownloadWorker = () => {
    const blob = new Blob([WORKER_JS_SOURCE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'worker.js';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyToml = async () => {
    await navigator.clipboard.writeText(buildWranglerToml(envConfig));
    setCopiedToml(true);
    setTimeout(() => setCopiedToml(false), 2000);
  };

  const currentTime = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const formatMoney = (val: number) => `${Number(val || 0).toFixed(2)} ${settings.currencySymbol}`;

  const buildDashboardSummary = (
    uMap = users,
    tList = tasks,
    sList = submissions,
    pList = payouts,
    cfg = settings
  ) => {
    const userCount = Object.keys(uMap).length;
    const activeTasks = tList.filter((t) => t.active).length;
    const pendSubs = sList.filter((s) => s.status === 'pending').length;
    const pendPays = pList.filter((p) => p.status === 'pending').length;

    return (
      `🛡️ ZENOX EXECUTIVE ADMIN CONTROL PANEL\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👥 Total Registered Users: ${userCount}\n` +
      `📋 Active Tasks: ${activeTasks} / ${tList.length}\n` +
      `📝 Pending Submissions: ${pendSubs}\n` +
      `💳 Pending Payouts: ${pendPays}\n` +
      `📢 Force Channel: ${cfg.forceChannelEnabled ? 'ENABLED 🟢' : 'DISABLED 🔴'}\n` +
      `⚙️ Maintenance Mode: ${cfg.maintenanceMode ? 'ACTIVE 🟠' : 'OFF 🟢'}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Select a management module below:`
    );
  };

  const appendBotReply = (text: string, inlineKeyboard?: InlineBtn[][]) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        sender: 'bot',
        text,
        timestamp: currentTime(),
        inlineKeyboard,
      },
    ]);
  };

  const editMessageById = (msgId: string, text: string, inlineKeyboard?: InlineBtn[][]) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, text, inlineKeyboard } : m))
    );
  };

  const isUserAdmin = (uid: string) =>
    uid === envConfig.ownerId || settings.admins.includes(uid);

  // Simulate sending a command or text message to the grammY bot
  const handleSendCommandOrText = (rawText: string) => {
    const text = rawText.trim();
    if (!text) return;

    const activeUser = users[activeUserId];
    setMessages((prev) => [
      ...prev,
      {
        id: `msg_u_${Date.now()}`,
        sender: 'user',
        text,
        timestamp: currentTime(),
      },
    ]);
    setChatInput('');

    // Maintenance & Ban check for non-admins
    if (!isUserAdmin(activeUserId)) {
      if (activeUser.banned) {
        appendBotReply(
          `🚫 Access Suspended\n\nYour account has been restricted by an administrator. Contact ${envConfig.supportUsername} for assistance.`
        );
        return;
      }
      if (settings.maintenanceMode) {
        appendBotReply(
          `⚙️ System Maintenance Underway\n\nWe are currently upgrading our servers and reward engine. Please check back shortly!\n\n🛟 Support: ${envConfig.supportUsername}`
        );
        return;
      }
    }

    if (text === '/cancel') {
      setUsers((prev) => ({
        ...prev,
        [activeUserId]: { ...prev[activeUserId], state: null, stateData: {} },
      }));
      appendBotReply('✅ Current operation cancelled.');
      return;
    }

    // /start command
    if (text.startsWith('/start')) {
      setUsers((prev) => ({
        ...prev,
        [activeUserId]: { ...prev[activeUserId], state: null, stateData: {} },
      }));

      if (settings.forceChannelEnabled && !activeUser.verifiedChannel && !isUserAdmin(activeUserId)) {
        appendBotReply(
          `🚨 Action Required: Channel Subscription\n\n` +
            `Welcome to our platform! To unlock your wallet, tasks, and bonuses, you must join our official channel first.\n\n` +
            `1️⃣ Click "📢 Join Official Channel" below.\n` +
            `2️⃣ Click "✅ Verify Membership" to continue.`,
          [
            [{ label: '📢 Join Official Channel', url: settings.forceChannelUrl }],
            [{ label: '✅ Verify Membership', callbackData: 'verify_force_channel' }],
          ]
        );
        return;
      }

      appendBotReply(
        `✨ Welcome to Zenox Rewards Hub, ${activeUser.firstName}!\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🆔 Account ID: ${activeUser.id}\n` +
          `💰 Current Balance: ${formatMoney(activeUser.balance)}\n` +
          `👥 Total Referrals: ${activeUser.referralsCount}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🚀 Complete daily tasks, invite friends, and withdraw instant payouts directly to your wallet!\n\n` +
          `👇 Use the interactive menu below to navigate:`
      );
      return;
    }

    // /admin command
    if (text === '/admin') {
      if (!isUserAdmin(activeUserId)) {
        appendBotReply(
          `⛔ Access Denied\nThis command is restricted strictly to the platform owner (${envConfig.ownerId}).`
        );
        return;
      }
      setUsers((prev) => ({
        ...prev,
        [activeUserId]: { ...prev[activeUserId], state: null, stateData: {} },
      }));
      appendBotReply(buildDashboardSummary(), buildAdminPanelButtons());
      return;
    }

    // Conversational State Machine
    if (activeUser.state) {
      const st = activeUser.state;

      if (st === 'ADMIN_CREATE_TASK' && isUserAdmin(activeUserId)) {
        const parts = text.split('|').map((s) => s.trim());
        if (parts.length < 3) {
          appendBotReply(
            `⚠️ Invalid Format! Please use:\nTitle | Description | RewardAmount | URL`
          );
          return;
        }
        const [title, description, rewardRaw, url] = parts;
        const newTask: TaskItem = {
          id: `task_${Date.now().toString().slice(-4)}`,
          title,
          description,
          reward: Math.max(0.1, Number(rewardRaw) || 1.0),
          url: url || settings.forceChannelUrl,
          active: true,
        };
        const updatedTasks = [...tasks, newTask];
        setTasks(updatedTasks);
        setUsers((prev) => ({
          ...prev,
          [activeUserId]: { ...prev[activeUserId], state: null },
        }));
        appendBotReply(
          `✅ New Task Created Successfully!\n\n🎯 Title: ${newTask.title}\n🎁 Reward: ${formatMoney(
            newTask.reward
          )}`,
          buildAdminPanelButtons()
        );
        return;
      }

      if (st === 'ADMIN_INSPECT_USER' && isUserAdmin(activeUserId)) {
        const targetUid = text.replace(/[^0-9]/g, '');
        const target = users[targetUid];
        setUsers((prev) => ({
          ...prev,
          [activeUserId]: { ...prev[activeUserId], state: null },
        }));
        if (!target) {
          appendBotReply(`❌ No user found with ID ${text}. Add or inspect 8838351233 or 5519204811.`, [
            [{ label: '🔙 Back to Admin Panel', callbackData: 'admin:home' }],
          ]);
          return;
        }
        appendBotReply(
          `🔍 User Profile Inspection\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🆔 User ID: ${target.id}\n` +
            `👤 Name: ${target.firstName} (${target.username})\n` +
            `💰 Balance: ${formatMoney(target.balance)}\n` +
            `📈 Total Earned: ${formatMoney(target.totalEarned)}\n` +
            `👥 Referrals: ${target.referralsCount}\n` +
            `🏦 Wallet: ${target.walletAddress}\n` +
            `🚦 Status: ${target.banned ? '🚫 BANNED' : '🟢 ACTIVE'}`,
          [
            [
              { label: '➕ Add +5.00 Balance', callbackData: `admin:user_mod:add_bal:${target.id}` },
              { label: '🧹 Reset Balance', callbackData: `admin:user_mod:zero_bal:${target.id}` },
            ],
            [
              {
                label: target.banned ? '✅ Unban User' : '🚫 Ban User',
                callbackData: `admin:user_mod:ban_toggle:${target.id}`,
              },
            ],
            [{ label: '🔙 Back to Admin Panel', callbackData: 'admin:home' }],
          ]
        );
        return;
      }

      if (st === 'ADMIN_SET_REWARDS' && isUserAdmin(activeUserId)) {
        const parts = text.split('|').map((s) => Number(s.trim()));
        if (parts.length < 4 || parts.some((n) => Number.isNaN(n) || n < 0)) {
          appendBotReply(
            `⚠️ Invalid numbers. Send 4 pipe-separated values:\nWelcomeBonus | ReferralBonus | DailyBonus | MinWithdraw`
          );
          return;
        }
        const nextSettings = {
          ...settings,
          welcomeBonus: parts[0],
          referralBonus: parts[1],
          dailyBonus: parts[2],
          minWithdraw: parts[3],
        };
        setSettings(nextSettings);
        setUsers((prev) => ({
          ...prev,
          [activeUserId]: { ...prev[activeUserId], state: null },
        }));
        appendBotReply(
          `✅ Rewards & Bonuses Updated!\n\n` +
            `🎁 Welcome: ${formatMoney(nextSettings.welcomeBonus)}\n` +
            `👥 Referral: ${formatMoney(nextSettings.referralBonus)}\n` +
            `📅 Daily Bonus: ${formatMoney(nextSettings.dailyBonus)}\n` +
            `💸 Min Withdraw: ${formatMoney(nextSettings.minWithdraw)}`,
          buildAdminPanelButtons()
        );
        return;
      }

      if (st === 'ADMIN_SET_FORCE_CHANNEL' && isUserAdmin(activeUserId)) {
        const parts = text.split('|').map((s) => s.trim());
        const nextSettings = {
          ...settings,
          forceChannelUrl: parts[0] || envConfig.forceChannel,
          forceChannelChatId: parts[1] || '',
        };
        setSettings(nextSettings);
        setUsers((prev) => ({
          ...prev,
          [activeUserId]: { ...prev[activeUserId], state: null },
        }));
        appendBotReply(
          `✅ Force Channel Updated!\n🔗 URL: ${nextSettings.forceChannelUrl}\n🆔 Chat ID: ${
            nextSettings.forceChannelChatId || 'None'
          }`,
          buildAdminPanelButtons()
        );
        return;
      }

      if (st === 'ADMIN_ADD_ADMIN' && isUserAdmin(activeUserId)) {
        const newId = text.replace(/[^0-9]/g, '');
        if (!newId) {
          appendBotReply('⚠️ Please send a valid numeric Telegram User ID.');
          return;
        }
        const nextAdmins = settings.admins.includes(newId)
          ? settings.admins
          : [...settings.admins, newId];
        setSettings({ ...settings, admins: nextAdmins });
        setUsers((prev) => ({
          ...prev,
          [activeUserId]: { ...prev[activeUserId], state: null },
        }));
        appendBotReply(`✅ Added ${newId} as an authorized Co-Admin!`, buildAdminPanelButtons());
        return;
      }

      if (st === 'ADMIN_BROADCAST' && isUserAdmin(activeUserId)) {
        const totalUsers = Object.keys(users).length;
        setUsers((prev) => ({
          ...prev,
          [activeUserId]: { ...prev[activeUserId], state: null },
        }));
        appendBotReply(
          `📢 Broadcast Complete!\n\n✅ Delivered: ${totalUsers}\n❌ Failed/Blocked: 0\n\nMessage Preview:\n"${text}"`,
          buildAdminPanelButtons()
        );
        return;
      }

      if (st === 'USER_SUBMITTING_TASK') {
        const { taskId, taskTitle, reward } = activeUser.stateData || {};
        const newSub: SubmissionItem = {
          id: `sub_${Date.now().toString().slice(-6)}`,
          userId: activeUser.id,
          userName: activeUser.firstName,
          taskId,
          taskTitle,
          reward,
          proof: text,
          status: 'pending',
          createdAt: new Date().toISOString(),
        };
        setSubmissions((prev) => [...prev, newSub]);
        setUsers((prev) => ({
          ...prev,
          [activeUserId]: {
            ...prev[activeUserId],
            pendingTasks: [...prev[activeUserId].pendingTasks, taskId],
            state: null,
            stateData: {},
          },
        }));
        appendBotReply(
          `✅ Proof Submitted Successfully!\n\n🎯 Task: ${taskTitle}\n🆔 Ticket: ${newSub.id}\n\nOur administrators will review your submission and credit your reward shortly.`
        );
        return;
      }

      if (st === 'USER_SETTING_WALLET') {
        setUsers((prev) => ({
          ...prev,
          [activeUserId]: { ...prev[activeUserId], walletAddress: text, state: null },
        }));
        appendBotReply(`✅ Wallet Address Updated!\n\n🏦 ${text}`);
        return;
      }

      if (st === 'USER_WITHDRAW_AMOUNT') {
        const amount = Number(text);
        if (Number.isNaN(amount) || amount < settings.minWithdraw || amount > activeUser.balance) {
          appendBotReply(
            `⚠️ Invalid amount! Enter a number between ${formatMoney(
              settings.minWithdraw
            )} and ${formatMoney(activeUser.balance)}.`
          );
          return;
        }
        const ticket: PayoutItem = {
          id: `pay_${Date.now().toString().slice(-6)}`,
          userId: activeUser.id,
          userName: activeUser.firstName,
          amount,
          wallet: activeUser.walletAddress,
          status: 'pending',
          createdAt: new Date().toISOString(),
        };
        setPayouts((prev) => [...prev, ticket]);
        setUsers((prev) => ({
          ...prev,
          [activeUserId]: {
            ...prev[activeUserId],
            balance: prev[activeUserId].balance - amount,
            state: null,
          },
        }));
        appendBotReply(
          `🎉 Withdrawal Request Submitted!\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🆔 Request ID: ${ticket.id}\n` +
            `💸 Amount: ${formatMoney(amount)}\n` +
            `🏦 Wallet: ${activeUser.walletAddress}\n` +
            `⏳ Status: Pending Admin Approval`
        );
        return;
      }
    }

    // Check Force Channel before Bottom Keyboard Menu Actions
    if (settings.forceChannelEnabled && !activeUser.verifiedChannel && !isUserAdmin(activeUserId)) {
      appendBotReply(
        `🚨 Action Required: Channel Subscription\n\nPlease join our official channel and verify membership first.`,
        [
          [{ label: '📢 Join Official Channel', url: settings.forceChannelUrl }],
          [{ label: '✅ Verify Membership', callbackData: 'verify_force_channel' }],
        ]
      );
      return;
    }

    // User Bottom Keyboard Buttons
    if (text === '🎯 Earn Tasks') {
      const activeList = tasks.filter((t) => t.active);
      const rows: InlineBtn[][] = activeList.map((t) => {
        const done = activeUser.completedTasks.includes(t.id);
        const pend = activeUser.pendingTasks.includes(t.id);
        const prefix = done ? '✅' : pend ? '⏳' : '🎯';
        return [
          {
            label: `${prefix} ${t.title} (+${formatMoney(t.reward)})`,
            callbackData: `task:view:${t.id}`,
          },
        ];
      });
      appendBotReply(
        activeList.length > 0
          ? `🎯 Available Earning Tasks (${activeList.length})\n\nSelect any task below to view instructions and claim your reward:`
          : `📭 No Active Tasks\n\nCheck back soon for new reward campaigns!`,
        rows
      );
      return;
    }

    if (text === '💰 My Balance') {
      appendBotReply(
        `💰 Account Financial Overview\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `👤 User: ${activeUser.firstName} (${activeUser.id})\n` +
          `💵 Available Balance: ${formatMoney(activeUser.balance)}\n` +
          `📈 Total Lifetime Earned: ${formatMoney(activeUser.totalEarned)}\n` +
          `💸 Total Withdrawn: ${formatMoney(activeUser.withdrawn)}\n` +
          `✅ Completed Tasks: ${activeUser.completedTasks.length}`
      );
      return;
    }

    if (text === '💳 Wallet & Withdraw') {
      appendBotReply(
        `💳 Wallet & Payout Center\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🏦 Saved Wallet Address:\n${activeUser.walletAddress}\n\n` +
          `💰 Withdrawable Balance: ${formatMoney(activeUser.balance)}\n` +
          `📉 Minimum Withdrawal: ${formatMoney(settings.minWithdraw)}`,
        [
          [{ label: '✏️ Set / Update Wallet Address', callbackData: 'wallet:set_address' }],
          [{ label: '💸 Request Withdrawal', callbackData: 'wallet:withdraw' }],
        ]
      );
      return;
    }

    if (text === '👥 Refer & Earn') {
      const refLink = `https://t.me/ZenoxWorkerBot?start=ref_${activeUser.id}`;
      appendBotReply(
        `👥 Partner Referral Program\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🎁 Reward Per Referral: +${formatMoney(settings.referralBonus)}\n` +
          `👥 Your Total Referrals: ${activeUser.referralsCount}\n` +
          `💵 Referral Earnings: ${formatMoney(
            activeUser.referralsCount * settings.referralBonus
          )}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🔗 Your Personal Invite Link:\n${refLink}`
      );
      return;
    }

    if (text === '🎁 Daily Bonus') {
      const bonus = settings.dailyBonus;
      const newBal = activeUser.balance + bonus;
      setUsers((prev) => ({
        ...prev,
        [activeUserId]: {
          ...prev[activeUserId],
          balance: newBal,
          totalEarned: prev[activeUserId].totalEarned + bonus,
          lastDailyBonus: new Date().toISOString(),
        },
      }));
      appendBotReply(
        `🎁 Daily Bonus Claimed!\n\n➕ Reward Added: +${formatMoney(bonus)}\n💰 New Balance: ${formatMoney(
          newBal
        )}`
      );
      return;
    }

    if (text === '🛟 Support') {
      const cleanHandle = envConfig.supportUsername.replace('@', '');
      appendBotReply(
        `🛟 Customer Support & Help Desk\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Need help with tasks, account verification, or payouts?\n\n` +
          `👨‍💻 Official Support: ${envConfig.supportUsername}\n` +
          `🆔 Your Support UID: ${activeUser.id}`,
        [[{ label: '💬 Contact Live Support', url: `https://t.me/${cleanHandle}` }]]
      );
      return;
    }

    appendBotReply(
      `🤖 Please use the menu buttons below or type /start or /admin to navigate.`
    );
  };

  // Simulate clicking an InlineKeyboard button in Telegram
  const handleInlineCallback = (msgId: string, btn: InlineBtn) => {
    if (btn.url) {
      showToast(`🔗 Opening external URL: ${btn.url}`);
      return;
    }
    const cb = btn.callbackData || '';
    const activeUser = users[activeUserId];

    // Force channel verification
    if (cb === 'verify_force_channel') {
      setUsers((prev) => ({
        ...prev,
        [activeUserId]: { ...prev[activeUserId], verifiedChannel: true },
      }));
      showToast('✅ Membership verified! Welcome aboard.');
      editMessageById(
        msgId,
        `✅ Verification Successful!\n\nWelcome, ${activeUser.firstName}! Your account is now active.\n💰 Balance: ${formatMoney(
          activeUser.balance
        )}`
      );
      return;
    }

    // User Task Callbacks
    if (cb.startsWith('task:view:')) {
      const taskId = cb.replace('task:view:', '');
      const task = tasks.find((t) => t.id === taskId && t.active);
      if (!task) {
        showToast('⚠️ Task is no longer available.');
        return;
      }
      const completed = activeUser.completedTasks.includes(task.id);
      const pending = activeUser.pendingTasks.includes(task.id);
      const statusBadge = completed
        ? '✅ Completed'
        : pending
        ? '⏳ Pending Review'
        : '🟢 Available';

      const rows: InlineBtn[][] = [[{ label: '🔗 Open Task Link', url: task.url }]];
      if (!completed && !pending) {
        rows.push([
          { label: '📤 Submit Proof & Claim Reward', callbackData: `task:submit:${task.id}` },
        ]);
      }
      rows.push([{ label: '🔙 Back to Tasks', callbackData: 'user:tasks_list' }]);

      editMessageById(
        msgId,
        `🎯 ${task.title}\n━━━━━━━━━━━━━━━━━━━━━━\n📝 Instructions:\n${
          task.description
        }\n\n🎁 Reward: +${formatMoney(task.reward)}\n📌 Status: ${statusBadge}`,
        rows
      );
      return;
    }

    if (cb === 'user:tasks_list') {
      const activeList = tasks.filter((t) => t.active);
      const rows: InlineBtn[][] = activeList.map((t) => {
        const done = activeUser.completedTasks.includes(t.id);
        const pend = activeUser.pendingTasks.includes(t.id);
        const prefix = done ? '✅' : pend ? '⏳' : '🎯';
        return [
          {
            label: `${prefix} ${t.title} (+${formatMoney(t.reward)})`,
            callbackData: `task:view:${t.id}`,
          },
        ];
      });
      editMessageById(
        msgId,
        `🎯 Available Earning Tasks (${activeList.length})\n\nSelect any task below to view instructions and claim your reward:`,
        rows
      );
      return;
    }

    if (cb.startsWith('task:submit:')) {
      const taskId = cb.replace('task:submit:', '');
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      setUsers((prev) => ({
        ...prev,
        [activeUserId]: {
          ...prev[activeUserId],
          state: 'USER_SUBMITTING_TASK',
          stateData: { taskId: task.id, taskTitle: task.title, reward: task.reward },
        },
      }));
      appendBotReply(
        `📤 Submit Proof for: ${task.title}\n\nPlease send your proof of completion as a text message in the input box below (or type /cancel to abort):`
      );
      return;
    }

    if (cb === 'wallet:set_address') {
      setUsers((prev) => ({
        ...prev,
        [activeUserId]: { ...prev[activeUserId], state: 'USER_SETTING_WALLET' },
      }));
      appendBotReply(
        `💳 Update Payout Wallet Address\n\nPlease reply with your valid wallet address (USDT TRC20 / BEP20 or TON address):`
      );
      return;
    }

    if (cb === 'wallet:withdraw') {
      if (activeUser.balance < settings.minWithdraw) {
        showToast(
          `⚠️ Minimum withdrawal is ${formatMoney(settings.minWithdraw)}. Your balance is ${formatMoney(
            activeUser.balance
          )}.`
        );
        return;
      }
      setUsers((prev) => ({
        ...prev,
        [activeUserId]: { ...prev[activeUserId], state: 'USER_WITHDRAW_AMOUNT' },
      }));
      appendBotReply(
        `💸 Request Withdrawal\n\n💰 Available Balance: ${formatMoney(
          activeUser.balance
        )}\n🏦 Destination Wallet: ${activeUser.walletAddress}\n\nPlease enter the amount you wish to withdraw:`
      );
      return;
    }

    // Admin Panel Callbacks
    if (cb.startsWith('admin:')) {
      if (!isUserAdmin(activeUserId)) {
        showToast('⛔ Unauthorized: Restricted strictly to OWNER_ID.');
        return;
      }

      const action = cb.replace('admin:', '');

      if (action === 'home') {
        editMessageById(msgId, buildDashboardSummary(), buildAdminPanelButtons());
        return;
      }

      if (action === 'create_add') {
        setUsers((prev) => ({
          ...prev,
          [activeUserId]: { ...prev[activeUserId], state: 'ADMIN_CREATE_TASK' },
        }));
        editMessageById(
          msgId,
          `➕ Create / Add New Earning Task\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `Send the new task details in the chat box using pipe-separated format:\n\n` +
            `Title | Description | RewardAmount | URL\n\n` +
            `Example:\n` +
            `🔥 Join Partner Channel | Subscribe & verify | 2.50 | https://t.me/+ukH5GufIKTthNzA9`,
          [[{ label: '🔙 Back to Admin Panel', callbackData: 'admin:home' }]]
        );
        return;
      }

      if (action === 'manage_tasks') {
        const rows: InlineBtn[][] = tasks.map((t) => [
          {
            label: `${t.active ? '🟢' : '🔴'} ${t.title.slice(0, 24)} (${t.reward})`,
            callbackData: `admin:task_toggle:${t.id}`,
          },
          { label: '🗑️ Delete', callbackData: `admin:task_del:${t.id}` },
        ]);
        rows.push([{ label: '➕ Add New Task', callbackData: 'admin:create_add' }]);
        rows.push([{ label: '🔙 Back to Admin Panel', callbackData: 'admin:home' }]);

        editMessageById(
          msgId,
          `📋 Manage Custom / Tasks (${tasks.length})\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `• Click a task name to toggle Active (🟢) / Paused (🔴).\n` +
            `• Click 🗑️ Delete to permanently remove a task.`,
          rows
        );
        return;
      }

      if (action.startsWith('task_toggle:')) {
        const tid = action.replace('task_toggle:', '');
        const nextTasks = tasks.map((t) => (t.id === tid ? { ...t, active: !t.active } : t));
        setTasks(nextTasks);
        showToast('🔄 Toggled task status.');
        const rows: InlineBtn[][] = nextTasks.map((t) => [
          {
            label: `${t.active ? '🟢' : '🔴'} ${t.title.slice(0, 24)} (${t.reward})`,
            callbackData: `admin:task_toggle:${t.id}`,
          },
          { label: '🗑️ Delete', callbackData: `admin:task_del:${t.id}` },
        ]);
        rows.push([{ label: '➕ Add New Task', callbackData: 'admin:create_add' }]);
        rows.push([{ label: '🔙 Back to Admin Panel', callbackData: 'admin:home' }]);
        editMessageById(
          msgId,
          `📋 Manage Custom / Tasks (${nextTasks.length})\n━━━━━━━━━━━━━━━━━━━━━━\nTask status updated in env.DB.`,
          rows
        );
        return;
      }

      if (action.startsWith('task_del:')) {
        const tid = action.replace('task_del:', '');
        const nextTasks = tasks.filter((t) => t.id !== tid);
        setTasks(nextTasks);
        showToast('🗑️ Task deleted from KV.');
        const rows: InlineBtn[][] = nextTasks.map((t) => [
          {
            label: `${t.active ? '🟢' : '🔴'} ${t.title.slice(0, 24)} (${t.reward})`,
            callbackData: `admin:task_toggle:${t.id}`,
          },
          { label: '🗑️ Delete', callbackData: `admin:task_del:${t.id}` },
        ]);
        rows.push([{ label: '➕ Add New Task', callbackData: 'admin:create_add' }]);
        rows.push([{ label: '🔙 Back to Admin Panel', callbackData: 'admin:home' }]);
        editMessageById(
          msgId,
          `📋 Manage Custom / Tasks (${nextTasks.length})\n━━━━━━━━━━━━━━━━━━━━━━\nTask removed successfully.`,
          rows
        );
        return;
      }

      if (action === 'review_submissions') {
        const pending = submissions.filter((s) => s.status === 'pending');
        if (pending.length === 0) {
          editMessageById(
            msgId,
            `📝 Review Pending Submissions\n━━━━━━━━━━━━━━━━━━━━━━\n✅ All caught up! There are currently 0 pending task submissions.`,
            [[{ label: '🔙 Back to Admin Panel', callbackData: 'admin:home' }]]
          );
          return;
        }
        const item = pending[0];
        editMessageById(
          msgId,
          `📝 Review Pending Submission (1 of ${pending.length})\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🆔 Submission ID: ${item.id}\n` +
            `👤 User: ${item.userName} (${item.userId})\n` +
            `🎯 Task: ${item.taskTitle}\n` +
            `🎁 Reward: ${formatMoney(item.reward)}\n` +
            `📄 Submitted Proof:\n${item.proof}\n` +
            `🕒 Time: ${item.createdAt}`,
          [
            [
              { label: `✅ Approve (+${item.reward})`, callbackData: `admin:sub_approve:${item.id}` },
              { label: '❌ Reject', callbackData: `admin:sub_reject:${item.id}` },
            ],
            [{ label: '🔙 Back to Admin Panel', callbackData: 'admin:home' }],
          ]
        );
        return;
      }

      if (action.startsWith('sub_approve:') || action.startsWith('sub_reject:')) {
        const isApprove = action.startsWith('sub_approve:');
        const subId = action.split(':')[1];
        const sub = submissions.find((s) => s.id === subId);
        if (!sub) return;

        const nextSubs: SubmissionItem[] = submissions.map((s) =>
          s.id === subId ? { ...s, status: isApprove ? 'approved' : 'rejected' } : s
        );
        setSubmissions(nextSubs);

        if (users[sub.userId]) {
          const u = users[sub.userId];
          setUsers({
            ...users,
            [sub.userId]: {
              ...u,
              pendingTasks: u.pendingTasks.filter((id) => id !== sub.taskId),
              completedTasks: isApprove ? [...u.completedTasks, sub.taskId] : u.completedTasks,
              balance: isApprove ? u.balance + sub.reward : u.balance,
              totalEarned: isApprove ? u.totalEarned + sub.reward : u.totalEarned,
            },
          });
        }
        showToast(isApprove ? '✅ Submission Approved & Credited!' : '❌ Submission Rejected.');
        editMessageById(
          msgId,
          `📝 Review Pending Submissions\n━━━━━━━━━━━━━━━━━━━━━━\nProcessed submission ${subId} (${
            isApprove ? 'APPROVED' : 'REJECTED'
          }).`,
          [[{ label: '🔙 Back to Admin Panel', callbackData: 'admin:home' }]]
        );
        return;
      }

      if (action.startsWith('view_users:')) {
        const uList = Object.values(users);
        const lines = uList
          .map(
            (u) =>
              `• ${u.id} | ${u.firstName} (${u.username}) — ${formatMoney(u.balance)} ${
                u.banned ? '🚫' : ''
              }`
          )
          .join('\n');
        editMessageById(
          msgId,
          `👥 Registered Platform Users (Total: ${uList.length})\n` +
            `📄 Page 1 of 1\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            lines,
          [
            [{ label: '🔍 Inspect Specific User', callbackData: 'admin:inspect_user' }],
            [{ label: '🔙 Back to Admin Panel', callbackData: 'admin:home' }],
          ]
        );
        return;
      }

      if (action === 'inspect_user') {
        setUsers((prev) => ({
          ...prev,
          [activeUserId]: { ...prev[activeUserId], state: 'ADMIN_INSPECT_USER' },
        }));
        editMessageById(
          msgId,
          `🔍 Inspect & Modify User Account\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `Please send the Telegram User ID in the chat box below (e.g. 5519204811 or 8838351233):`,
          [
            [{ label: '🔍 Quick Inspect: 5519204811 (Alex)', callbackData: 'admin:user_mod:view:5519204811' }],
            [{ label: '🔙 Back to Admin Panel', callbackData: 'admin:home' }],
          ]
        );
        return;
      }

      if (action.startsWith('user_mod:')) {
        const [, modAction, targetUid] = action.split(':');
        const target = users[targetUid];
        if (!target) return;

        const updatedTarget = { ...target };
        if (modAction === 'ban_toggle') {
          updatedTarget.banned = !updatedTarget.banned;
          showToast(updatedTarget.banned ? '🚫 User Banned!' : '✅ User Unbanned!');
        } else if (modAction === 'add_bal') {
          updatedTarget.balance += 5;
          updatedTarget.totalEarned += 5;
          showToast('➕ Added +5.00 USDT to user balance!');
        } else if (modAction === 'zero_bal') {
          updatedTarget.balance = 0;
          showToast('🧹 Reset user balance to 0.00!');
        }

        setUsers((prev) => ({ ...prev, [targetUid]: updatedTarget }));
        editMessageById(
          msgId,
          `🔍 User Profile Inspection\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🆔 User ID: ${updatedTarget.id}\n` +
            `👤 Name: ${updatedTarget.firstName} (${updatedTarget.username})\n` +
            `💰 Balance: ${formatMoney(updatedTarget.balance)}\n` +
            `📈 Total Earned: ${formatMoney(updatedTarget.totalEarned)}\n` +
            `👥 Referrals: ${updatedTarget.referralsCount}\n` +
            `🏦 Wallet: ${updatedTarget.walletAddress}\n` +
            `🚦 Status: ${updatedTarget.banned ? '🚫 BANNED' : '🟢 ACTIVE'}`,
          [
            [
              {
                label: '➕ Add +5.00 Balance',
                callbackData: `admin:user_mod:add_bal:${updatedTarget.id}`,
              },
              {
                label: '🧹 Reset Balance',
                callbackData: `admin:user_mod:zero_bal:${updatedTarget.id}`,
              },
            ],
            [
              {
                label: updatedTarget.banned ? '✅ Unban User' : '🚫 Ban User',
                callbackData: `admin:user_mod:ban_toggle:${updatedTarget.id}`,
              },
            ],
            [{ label: '🔙 Back to Admin Panel', callbackData: 'admin:home' }],
          ]
        );
        return;
      }

      if (action === 'analytics') {
        const uList = Object.values(users);
        const totalBal = uList.reduce((acc, u) => acc + u.balance, 0);
        const totalPaid = uList.reduce((acc, u) => acc + u.withdrawn, 0);
        const totalRefs = uList.reduce((acc, u) => acc + u.referralsCount, 0);

        editMessageById(
          msgId,
          `📊 Real-Time Platform Analytics\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `👥 Total Users: ${uList.length}\n` +
            `🔗 Total Referrals Generated: ${totalRefs}\n` +
            `💰 Circulating User Balances: ${formatMoney(totalBal)}\n` +
            `💸 Total Paid Out Volume: ${formatMoney(totalPaid)}\n` +
            `📋 Active Tasks: ${tasks.filter((t) => t.active).length} / ${tasks.length}\n` +
            `📝 Submissions (Pending / Total): ${
              submissions.filter((s) => s.status === 'pending').length
            } / ${submissions.length}\n` +
            `💳 Withdrawals (Pending / Total): ${
              payouts.filter((p) => p.status === 'pending').length
            } / ${payouts.length}`,
          [
            [{ label: '🔄 Refresh Metrics', callbackData: 'admin:analytics' }],
            [{ label: '🔙 Back to Admin Panel', callbackData: 'admin:home' }],
          ]
        );
        return;
      }

      if (action === 'manage_payouts') {
        const pending = payouts.filter((p) => p.status === 'pending');
        if (pending.length === 0) {
          editMessageById(
            msgId,
            `💳 Manage Payments / Payouts\n━━━━━━━━━━━━━━━━━━━━━━\n✅ There are currently 0 pending withdrawal requests.`,
            [[{ label: '🔙 Back to Admin Panel', callbackData: 'admin:home' }]]
          );
          return;
        }
        const item = pending[0];
        editMessageById(
          msgId,
          `💳 Pending Withdrawal Request (1 of ${pending.length})\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🆔 Payout ID: ${item.id}\n` +
            `👤 User: ${item.userName} (${item.userId})\n` +
            `💸 Amount: ${formatMoney(item.amount)}\n` +
            `🏦 Wallet Address:\n${item.wallet}\n` +
            `🕒 Requested At: ${item.createdAt}`,
          [
            [
              { label: '✅ Mark Paid', callbackData: `admin:payout_approve:${item.id}` },
              { label: '❌ Reject & Refund', callbackData: `admin:payout_reject:${item.id}` },
            ],
            [{ label: '🔙 Back to Admin Panel', callbackData: 'admin:home' }],
          ]
        );
        return;
      }

      if (action.startsWith('payout_approve:') || action.startsWith('payout_reject:')) {
        const isApprove = action.startsWith('payout_approve:');
        const pid = action.split(':')[1];
        const p = payouts.find((x) => x.id === pid);
        if (!p) return;

        setPayouts((prev) =>
          prev.map((x) => (x.id === pid ? { ...x, status: isApprove ? 'paid' : 'rejected' } : x))
        );
        if (users[p.userId]) {
          const u = users[p.userId];
          setUsers({
            ...users,
            [p.userId]: {
              ...u,
              withdrawn: isApprove ? u.withdrawn + p.amount : u.withdrawn,
              balance: isApprove ? u.balance : u.balance + p.amount,
            },
          });
        }
        showToast(isApprove ? '✅ Marked Payout as Paid!' : '❌ Rejected & Refunded to User.');
        editMessageById(
          msgId,
          `💳 Manage Payments / Payouts\n━━━━━━━━━━━━━━━━━━━━━━\nProcessed payout ${pid} (${
            isApprove ? 'PAID' : 'REJECTED & REFUNDED'
          }).`,
          [[{ label: '🔙 Back to Admin Panel', callbackData: 'admin:home' }]]
        );
        return;
      }

      if (action === 'set_rewards') {
        setUsers((prev) => ({
          ...prev,
          [activeUserId]: { ...prev[activeUserId], state: 'ADMIN_SET_REWARDS' },
        }));
        editMessageById(
          msgId,
          `🎁 Set Rewards / Bonuses Configuration\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `• Welcome Bonus: ${formatMoney(settings.welcomeBonus)}\n` +
            `• Referral Bonus: ${formatMoney(settings.referralBonus)}\n` +
            `• Daily Bonus: ${formatMoney(settings.dailyBonus)}\n` +
            `• Min Withdrawal: ${formatMoney(settings.minWithdraw)}\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `To update, send 4 pipe-separated numbers in the chat box:\n` +
            `WelcomeBonus | ReferralBonus | DailyBonus | MinWithdraw\n\n` +
            `Example: 2.00 | 3.00 | 1.00 | 15.00`,
          [[{ label: '🔙 Back to Admin Panel', callbackData: 'admin:home' }]]
        );
        return;
      }

      if (action === 'force_channel') {
        editMessageById(
          msgId,
          `📢 Force Channel Verification Settings\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🚦 Status: ${settings.forceChannelEnabled ? 'ENABLED 🟢' : 'DISABLED 🔴'}\n` +
            `🔗 Channel Invite Link:\n${settings.forceChannelUrl}\n` +
            `🆔 API Chat ID: ${
              settings.forceChannelChatId || 'Not Set (Uses Click Verification)'
            }`,
          [
            [
              {
                label: settings.forceChannelEnabled
                  ? '🔴 Disable Force Channel'
                  : '🟢 Enable Force Channel',
                callbackData: 'admin:fc_toggle',
              },
            ],
            [{ label: '✏️ Update Channel URL / Chat ID', callbackData: 'admin:fc_edit' }],
            [{ label: '🔙 Back to Admin Panel', callbackData: 'admin:home' }],
          ]
        );
        return;
      }

      if (action === 'fc_toggle') {
        const next = { ...settings, forceChannelEnabled: !settings.forceChannelEnabled };
        setSettings(next);
        showToast(
          `Force Channel is now ${next.forceChannelEnabled ? 'ENABLED 🟢' : 'DISABLED 🔴'}`
        );
        editMessageById(
          msgId,
          `📢 Force Channel Verification Settings\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🚦 Status: ${next.forceChannelEnabled ? 'ENABLED 🟢' : 'DISABLED 🔴'}\n` +
            `🔗 Channel Invite Link:\n${next.forceChannelUrl}`,
          [
            [
              {
                label: next.forceChannelEnabled
                  ? '🔴 Disable Force Channel'
                  : '🟢 Enable Force Channel',
                callbackData: 'admin:fc_toggle',
              },
            ],
            [{ label: '✏️ Update Channel URL / Chat ID', callbackData: 'admin:fc_edit' }],
            [{ label: '🔙 Back to Admin Panel', callbackData: 'admin:home' }],
          ]
        );
        return;
      }

      if (action === 'fc_edit') {
        setUsers((prev) => ({
          ...prev,
          [activeUserId]: { ...prev[activeUserId], state: 'ADMIN_SET_FORCE_CHANNEL' },
        }));
        editMessageById(
          msgId,
          `📢 Update Force Channel Link\n━━━━━━━━━━━━━━━━━━━━━━\nSend the new Telegram channel URL in the input box below:`,
          [[{ label: '🔙 Back to Admin Panel', callbackData: 'admin:home' }]]
        );
        return;
      }

      if (action === 'manage_admins') {
        const rows: InlineBtn[][] = settings.admins.map((aid) => {
          const isPrimary = aid === envConfig.ownerId;
          return [
            {
              label: isPrimary ? `👑 Owner (${aid})` : `🛡️ Admin (${aid}) — Remove ❌`,
              callbackData: isPrimary ? 'admin:noop' : `admin:remove_admin:${aid}`,
            },
          ];
        });
        rows.push([{ label: '➕ Add Co-Admin by ID', callbackData: 'admin:add_admin_prompt' }]);
        rows.push([{ label: '🔙 Back to Admin Panel', callbackData: 'admin:home' }]);

        editMessageById(
          msgId,
          `👥 Manage Platform Administrators\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `👑 Primary Owner ID: ${envConfig.ownerId}\n` +
            `🛡️ Total Authorized Admins: ${settings.admins.length}`,
          rows
        );
        return;
      }

      if (action === 'noop') {
        showToast('👑 Primary Owner cannot be removed.');
        return;
      }

      if (action.startsWith('remove_admin:')) {
        const remId = action.replace('remove_admin:', '');
        const nextAdmins = settings.admins.filter(
          (a) => a !== remId || a === envConfig.ownerId
        );
        setSettings({ ...settings, admins: nextAdmins });
        showToast(`Removed Co-Admin ${remId}`);
        editMessageById(msgId, buildDashboardSummary(), buildAdminPanelButtons());
        return;
      }

      if (action === 'add_admin_prompt') {
        setUsers((prev) => ({
          ...prev,
          [activeUserId]: { ...prev[activeUserId], state: 'ADMIN_ADD_ADMIN' },
        }));
        editMessageById(
          msgId,
          `👥 Add New Co-Admin\n━━━━━━━━━━━━━━━━━━━━━━\nSend the numeric Telegram User ID of the new administrator in the input box:`,
          [[{ label: '🔙 Back to Admin Panel', callbackData: 'admin:home' }]]
        );
        return;
      }

      if (action === 'broadcast') {
        setUsers((prev) => ({
          ...prev,
          [activeUserId]: { ...prev[activeUserId], state: 'ADMIN_BROADCAST' },
        }));
        editMessageById(
          msgId,
          `📢 Global Broadcast System\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `👥 Target Audience: ${Object.keys(users).length} registered users\n\n` +
            `Send the announcement message you want to broadcast in the input box below:`,
          [[{ label: '🔙 Back to Admin Panel', callbackData: 'admin:home' }]]
        );
        return;
      }

      if (action === 'maintenance') {
        const next = { ...settings, maintenanceMode: !settings.maintenanceMode };
        setSettings(next);
        showToast(
          `⚙️ Maintenance Mode is now ${next.maintenanceMode ? 'ACTIVE 🟠' : 'OFF 🟢'}`
        );
        editMessageById(
          msgId,
          buildDashboardSummary(users, tasks, submissions, payouts, next),
          buildAdminPanelButtons()
        );
        return;
      }

      if (action === 'wipe_confirm') {
        editMessageById(
          msgId,
          `⚠️ CRITICAL WARNING: WIPE ALL PLATFORM DATA\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `Are you sure you want to reset all users, balances, tasks, submissions, and payout logs in env.DB?\n\n` +
            `This action cannot be undone!`,
          [
            [{ label: '⚠️ YES, WIPE ALL KV DATA NOW', callbackData: 'admin:wipe_execute' }],
            [{ label: '🔙 Cancel & Return Safe', callbackData: 'admin:home' }],
          ]
        );
        return;
      }

      if (action === 'wipe_execute') {
        const resetUsers: Record<string, UserRecord> = {
          [envConfig.ownerId]: {
            id: envConfig.ownerId,
            username: '@ZenoxOwner',
            firstName: 'Zenox Admin',
            balance: 1.5,
            totalEarned: 1.5,
            withdrawn: 0,
            referralsCount: 0,
            walletAddress: 'Not Set',
            completedTasks: [],
            pendingTasks: [],
            verifiedChannel: true,
            banned: false,
            lastDailyBonus: null,
            state: null,
          },
        };
        setUsers(resetUsers);
        setTasks(INITIAL_TASKS);
        setSubmissions([]);
        setPayouts([]);
        showToast('✅ All platform KV data wiped and reset to factory defaults.');
        editMessageById(
          msgId,
          buildDashboardSummary(resetUsers, INITIAL_TASKS, [], [], settings),
          buildAdminPanelButtons()
        );
        return;
      }

      if (action === 'close') {
        showToast('🔒 Admin Panel Closed.');
        editMessageById(msgId, '🔒 Admin Panel Session Closed. Type /admin to reopen.', []);
        return;
      }
    }
  };

  const userBottomButtons = [
    ['🎯 Earn Tasks', '💰 My Balance'],
    ['💳 Wallet & Withdraw', '👥 Refer & Earn'],
    ['🎁 Daily Bonus', '🛟 Support'],
  ];

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-slate-800/80 bg-[#0B0F17]/95 sticky top-0 z-30">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveView('code');
          }}
          className="text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          Zenox Worker Studio
        </a>

        <nav className="flex items-center gap-6 text-sm font-medium text-slate-400 overflow-x-auto">
          <button
            onClick={() => setActiveView('code')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeView === 'code'
                ? 'text-white border-sky-400'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            worker.js Source
          </button>
          <button
            onClick={() => setActiveView('simulator')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeView === 'simulator'
                ? 'text-white border-sky-400'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Interactive Bot Simulator
          </button>
          <button
            onClick={() => setActiveView('kv')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeView === 'kv'
                ? 'text-white border-sky-400'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Cloudflare KV (env.DB)
          </button>
          <button
            onClick={() => setActiveView('deploy')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeView === 'deploy'
                ? 'text-white border-sky-400'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Wrangler Config
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleCopyWorker}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedCode ? 'Copied worker.js' : 'Copy worker.js'}
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-6">
        {/* Spec & Metadata Bar (Zero-Pill Unboxed Typography) */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-800/80">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Cloudflare Workers Telegram Bot — Single-File ES Module
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-400 font-mono tabular-nums">
              <span>Framework: grammY v1.35.0</span>
              <span aria-hidden="true">·</span>
              <span>KV Binding: env.DB</span>
              <span aria-hidden="true">·</span>
              <span>OWNER_ID: {envConfig.ownerId}</span>
              <span aria-hidden="true">·</span>
              <span>SUPPORT: {envConfig.supportUsername}</span>
              <span aria-hidden="true">·</span>
              <span>Webhook Response: HTTP 200 OK</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setActiveView('simulator')}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5 text-sky-400" />
              Test `/admin` & `/start` Live
            </button>
            <button
              onClick={handleDownloadWorker}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              Download worker.js
            </button>
          </div>
        </div>

        {/* VIEW 1: COMPLETE WORKER.JS SOURCE CODE + QUICK PREVIEW */}
        {activeView === 'code' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Code Viewer (8 cols) */}
            <div className="lg:col-span-8 border border-slate-800 rounded-xl bg-[#0F1623] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/60">
                <div className="flex items-center gap-2.5 text-xs font-mono text-slate-300">
                  <FileCode className="w-4 h-4 text-sky-400" />
                  <span>worker.js</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-400">
                    {WORKER_JS_SOURCE.split('\n').length} lines
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-400">ES Module</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyWorker}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {copiedCode ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copiedCode ? 'Copied to Clipboard' : 'Copy Full Code'}
                  </button>
                </div>
              </div>
              <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto max-h-[700px] leading-relaxed select-all">
                <code>{WORKER_JS_SOURCE}</code>
              </pre>
            </div>

            {/* Architecture & 14 Admin Modules Summary (4 cols) */}
            <div className="lg:col-span-4 space-y-6">
              <div className="p-5 border border-slate-800 rounded-xl bg-[#0F1623]">
                <h2 className="text-sm font-semibold text-white mb-3">
                  Configured Environment Variables
                </h2>
                <div className="space-y-3 text-xs font-mono tabular-nums">
                  <div className="pb-2.5 border-b border-slate-800/80">
                    <div className="text-slate-400 mb-0.5">BOT_TOKEN</div>
                    <div className="text-slate-200 break-all">{envConfig.botToken}</div>
                  </div>
                  <div className="pb-2.5 border-b border-slate-800/80">
                    <div className="text-slate-400 mb-0.5">OWNER_ID</div>
                    <div className="text-sky-400">{envConfig.ownerId}</div>
                  </div>
                  <div className="pb-2.5 border-b border-slate-800/80">
                    <div className="text-slate-400 mb-0.5">SUPPORT_USERNAME</div>
                    <div className="text-slate-200">{envConfig.supportUsername}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 mb-0.5">FORCE_CHANNEL</div>
                    <div className="text-slate-200 break-all">{envConfig.forceChannel}</div>
                  </div>
                </div>
              </div>

              <div className="p-5 border border-slate-800 rounded-xl bg-[#0F1623]">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-white">
                    14 Interactive `/admin` Modules
                  </h2>
                  <button
                    onClick={() => setActiveView('simulator')}
                    className="text-xs text-sky-400 hover:underline cursor-pointer"
                  >
                    Open Simulator →
                  </button>
                </div>
                <ul className="space-y-2 text-xs text-slate-300">
                  <li>➕ Create / Add (Pipe-formatted task creator)</li>
                  <li>📋 Manage Custom / Tasks (Toggle active & delete)</li>
                  <li>📝 Review Pending Submissions (Approve & auto-credit)</li>
                  <li>👥 View All Users (Paginated KV user directory)</li>
                  <li>🔍 Inspect User (Balance credit/reset & ban toggle)</li>
                  <li>📊 Real-Time Analytics (Live KV circulation metrics)</li>
                  <li>💳 Manage Payments / Payouts (Mark paid or refund)</li>
                  <li>🎁 Set Rewards / Bonuses (Welcome, Referral, Daily, Min)</li>
                  <li>📢 Force Channel Verification (Toggle & link editor)</li>
                  <li>👥 Manage Admins (Owner-protected co-admin manager)</li>
                  <li>📢 Broadcast System (Global HTML push to all users)</li>
                  <li>⚙️ Maintenance Mode (Instant non-admin traffic lock)</li>
                  <li>⚠️ Wipe / Reset All Platform Data (2-step safety reset)</li>
                  <li>🔙 Close Admin Panel (Clean session dismissal)</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: INTERACTIVE TELEGRAM BOT SIMULATOR */}
        {activeView === 'simulator' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Simulator Controls & Persona Switcher (4 cols) */}
            <div className="lg:col-span-4 space-y-5">
              <div className="p-5 border border-slate-800 rounded-xl bg-[#0F1623]">
                <h2 className="text-sm font-semibold text-white mb-1">
                  Active Telegram User Persona
                </h2>
                <p className="text-xs text-slate-400 mb-4">
                  Switch between the Owner account (`8838351233`) and a regular user to test `/admin` guards and force-channel verification.
                </p>

                <div className="space-y-2.5">
                  <button
                    onClick={() => setActiveUserId('8838351233')}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                      activeUserId === '8838351233'
                        ? 'bg-sky-950/40 border-sky-500/60 text-white'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Shield className="w-4 h-4 text-sky-400 shrink-0" />
                      <div>
                        <div className="text-xs font-semibold">Zenox Admin (OWNER_ID)</div>
                        <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                          ID: 8838351233 · Full /admin access
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-sky-400">
                      {formatMoney(users['8838351233']?.balance || 0)}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveUserId('5519204811')}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                      activeUserId === '5519204811'
                        ? 'bg-sky-950/40 border-sky-500/60 text-white'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <User className="w-4 h-4 text-slate-400 shrink-0" />
                      <div>
                        <div className="text-xs font-semibold">Alex Rivera (Standard User)</div>
                        <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                          ID: 5519204811 · {users['5519204811']?.verifiedChannel ? 'Verified' : 'Unverified'}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-slate-300">
                      {formatMoney(users['5519204811']?.balance || 0)}
                    </span>
                  </button>
                </div>

                {/* Quick Command Triggers */}
                <div className="mt-5 pt-4 border-t border-slate-800">
                  <div className="text-xs font-medium text-slate-400 mb-2.5">
                    Quick Bot Commands
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleSendCommandOrText('/start')}
                      className="px-3 py-1.5 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md transition-colors cursor-pointer"
                    >
                      /start
                    </button>
                    <button
                      onClick={() => handleSendCommandOrText('/admin')}
                      className="px-3 py-1.5 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-md transition-colors cursor-pointer"
                    >
                      /admin
                    </button>
                    <button
                      onClick={() => handleSendCommandOrText('/cancel')}
                      className="px-3 py-1.5 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md transition-colors cursor-pointer"
                    >
                      /cancel
                    </button>
                    <button
                      onClick={() => setMessages([])}
                      className="px-3 py-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 rounded-md transition-colors cursor-pointer ml-auto"
                    >
                      Clear Chat
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom Reply Keyboard Emulation */}
              <div className="p-5 border border-slate-800 rounded-xl bg-[#0F1623]">
                <h2 className="text-sm font-semibold text-white mb-1">
                  User Reply Keyboard (`buildUserReplyKeyboard`)
                </h2>
                <p className="text-xs text-slate-400 mb-3">
                  Click any persistent bottom keyboard button to trigger its handler:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {userBottomButtons.flat().map((label) => (
                    <button
                      key={label}
                      onClick={() => handleSendCommandOrText(label)}
                      className="px-3 py-2 text-xs font-medium text-slate-100 bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 rounded-lg transition-colors text-center whitespace-nowrap truncate cursor-pointer"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Telegram Chat Window (8 cols) */}
            <div className="lg:col-span-8 border border-slate-800 rounded-xl bg-[#0F1623] flex flex-col h-[680px] overflow-hidden">
              {/* Chat Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/70">
                <div>
                  <div className="text-sm font-semibold text-white">
                    Zenox Rewards Bot (@ZenoxWorkerBot)
                  </div>
                  <div className="text-xs text-slate-400 font-mono tabular-nums">
                    Acting as: {users[activeUserId]?.firstName} (ID: {activeUserId})
                    {users[activeUserId]?.state ? ` · State: ${users[activeUserId]?.state}` : ''}
                  </div>
                </div>
                {toastAlert && (
                  <div className="px-3 py-1.5 text-xs font-medium bg-sky-500/20 border border-sky-500/40 text-sky-200 rounded-lg">
                    {toastAlert}
                  </div>
                )}
              </div>

              {/* Messages Scroll Viewport */}
              <div className="flex-1 p-5 overflow-y-auto space-y-4">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-500">
                    <p className="text-sm">No messages in current session.</p>
                    <p className="text-xs mt-1">
                      Click <code className="text-sky-400">/start</code> or{' '}
                      <code className="text-sky-400">/admin</code> to begin testing.
                    </p>
                  </div>
                )}

                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${
                      m.sender === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[540px] rounded-xl px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap font-sans ${
                        m.sender === 'user'
                          ? 'bg-sky-600 text-white'
                          : 'bg-slate-800/90 border border-slate-700/80 text-slate-100'
                      }`}
                    >
                      {m.text}
                      <div
                        className={`text-[10px] mt-1.5 text-right font-mono tabular-nums ${
                          m.sender === 'user' ? 'text-sky-200' : 'text-slate-400'
                        }`}
                      >
                        {m.timestamp}
                      </div>
                    </div>

                    {/* Inline Keyboard Rows */}
                    {m.inlineKeyboard && m.inlineKeyboard.length > 0 && (
                      <div className="mt-1.5 w-full max-w-[540px] space-y-1.5">
                        {m.inlineKeyboard.map((row, rIdx) => (
                          <div key={rIdx} className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {row.map((btn, bIdx) => (
                              <button
                                key={bIdx}
                                onClick={() => handleInlineCallback(m.id, btn)}
                                className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-100 bg-slate-900/95 hover:bg-slate-800 border border-slate-700/90 rounded-lg transition-colors cursor-pointer ${
                                  row.length === 1 ? 'sm:col-span-2' : ''
                                }`}
                              >
                                <span className="truncate">{btn.label}</span>
                                {btn.url && <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Message Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendCommandOrText(chatInput);
                }}
                className="p-3.5 border-t border-slate-800 bg-slate-900/70 flex items-center gap-2.5"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={
                    users[activeUserId]?.state
                      ? `Active State (${users[activeUserId]?.state}): Enter value or /cancel...`
                      : 'Type /start, /admin, or any message...'
                  }
                  className="flex-1 bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send
                </button>
              </form>
            </div>
          </div>
        )}

        {/* VIEW 3: CLOUDFLARE KV (env.DB) LIVE INSPECTOR */}
        {activeView === 'kv' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 border border-slate-800 rounded-xl bg-[#0F1623]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Database className="w-4 h-4 text-sky-400" />
                    <span>Key: sys:settings</span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">JSON Value</span>
                </div>
                <pre className="p-3.5 rounded-lg bg-slate-950 border border-slate-800/80 text-xs font-mono text-slate-300 overflow-x-auto">
                  {JSON.stringify(settings, null, 2)}
                </pre>
              </div>

              <div className="p-5 border border-slate-800 rounded-xl bg-[#0F1623]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Database className="w-4 h-4 text-sky-400" />
                    <span>Key: user:* Records ({Object.keys(users).length})</span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">JSON Value</span>
                </div>
                <pre className="p-3.5 rounded-lg bg-slate-950 border border-slate-800/80 text-xs font-mono text-slate-300 overflow-x-auto max-h-[280px]">
                  {JSON.stringify(users, null, 2)}
                </pre>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 border border-slate-800 rounded-xl bg-[#0F1623]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Database className="w-4 h-4 text-sky-400" />
                    <span>Key: sys:tasks ({tasks.length})</span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">JSON Value</span>
                </div>
                <pre className="p-3.5 rounded-lg bg-slate-950 border border-slate-800/80 text-xs font-mono text-slate-300 overflow-x-auto max-h-[260px]">
                  {JSON.stringify(tasks, null, 2)}
                </pre>
              </div>

              <div className="p-5 border border-slate-800 rounded-xl bg-[#0F1623]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Database className="w-4 h-4 text-sky-400" />
                    <span>Key: sys:submissions & sys:payouts</span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">JSON Value</span>
                </div>
                <pre className="p-3.5 rounded-lg bg-slate-950 border border-slate-800/80 text-xs font-mono text-slate-300 overflow-x-auto max-h-[260px]">
                  {JSON.stringify({ submissions, payouts }, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: WRANGLER CONFIG & DEPLOYMENT */}
        {activeView === 'deploy' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-6 p-5 border border-slate-800 rounded-xl bg-[#0F1623] space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Sliders className="w-4 h-4 text-sky-400" />
                <span>Environment Variables (`wrangler.toml`)</span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-mono">BOT_TOKEN</label>
                  <input
                    type="text"
                    value={envConfig.botToken}
                    onChange={(e) => setEnvConfig({ ...envConfig, botToken: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-mono">OWNER_ID</label>
                  <input
                    type="text"
                    value={envConfig.ownerId}
                    onChange={(e) => setEnvConfig({ ...envConfig, ownerId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-mono">SUPPORT_USERNAME</label>
                  <input
                    type="text"
                    value={envConfig.supportUsername}
                    onChange={(e) =>
                      setEnvConfig({ ...envConfig, supportUsername: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-mono">FORCE_CHANNEL</label>
                  <input
                    type="text"
                    value={envConfig.forceChannel}
                    onChange={(e) => setEnvConfig({ ...envConfig, forceChannel: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-slate-200"
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 p-5 border border-slate-800 rounded-xl bg-[#0F1623] space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white font-mono">wrangler.toml</span>
                <button
                  onClick={handleCopyToml}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
                >
                  {copiedToml ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedToml ? 'Copied wrangler.toml' : 'Copy wrangler.toml'}
                </button>
              </div>
              <pre className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed">
                {buildWranglerToml(envConfig)}
              </pre>
              <div className="text-xs text-slate-400 space-y-1.5 pt-2">
                <p className="font-semibold text-slate-200">1-Click Webhook Activation:</p>
                <p>
                  Once deployed to Cloudflare Workers, visit{' '}
                  <code className="text-sky-400">https://your-worker.workers.dev/setWebhook</code>{' '}
                  in your browser to automatically bind the Telegram webhook with{' '}
                  <code>drop_pending_updates=true</code>.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
