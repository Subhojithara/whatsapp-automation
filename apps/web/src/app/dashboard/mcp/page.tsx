"use client";

import { useState } from "react";
import {
  Bot,
  Check,
  Copy,
  Terminal,
  QrCode,
  Shield,
  BookOpen,
  Server,
  Zap,
  CheckCircle2,
  Code2,
  RefreshCw,
  Cpu,
  Smartphone,
  MessageSquare,
  Search,
  ExternalLink,
  Layers,
} from "lucide-react";
import { LiquidToggle } from "@/components/ui/LiquidToggle";
import { MagnifyingGlass } from "@/components/ui/MagnifyingGlass";
import { ShimmerButton } from "@/components/ui/ShimmerButton";

export default function McpDocsPage() {
  const [activeTab, setActiveTab] = useState<"config" | "tools" | "qr" | "skill" | "docker">("config");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Agent capability controls
  const [antiBanThrottling, setAntiBanThrottling] = useState(true);
  const [autoSessionRouting, setAutoSessionRouting] = useState(true);
  const [stdioBridgeSandbox, setStdioBridgeSandbox] = useState(true);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const antigravityConfig = JSON.stringify(
    {
      mcpServers: {
        "velurix-reachout": {
          command: "node",
          args: ["c:/client/reachout-automation2.0/apps/mcp-server/dist/index.js"],
          env: {
            VELURIX_API_URL: "https://213-136-76-153.sslip.io/api/v1",
            VELURIX_API_KEY: "xCdANIh_JYwEwczVoPOfp1SdV0YTvhBkNqWPsjkfhVBiazJm6cCyJraMVEo9jxvp",
          },
        },
      },
    },
    null,
    2
  );

  const claudeConfig = JSON.stringify(
    {
      mcpServers: {
        "velurix-reachout": {
          command: "node",
          args: ["c:/client/reachout-automation2.0/apps/mcp-server/dist/index.js"],
          env: {
            VELURIX_API_URL: "https://213-136-76-153.sslip.io/api/v1",
            VELURIX_API_KEY: "xCdANIh_JYwEwczVoPOfp1SdV0YTvhBkNqWPsjkfhVBiazJm6cCyJraMVEo9jxvp",
          },
        },
      },
    },
    null,
    2
  );

  const hermesConfig = JSON.stringify(
    {
      mcp_servers: [
        {
          name: "velurix-reachout",
          transport: "stdio",
          command: "node",
          args: ["c:/client/reachout-automation2.0/apps/mcp-server/dist/index.js"],
          env: {
            VELURIX_API_URL: "https://213-136-76-153.sslip.io/api/v1",
            VELURIX_API_KEY: "xCdANIh_JYwEwczVoPOfp1SdV0YTvhBkNqWPsjkfhVBiazJm6cCyJraMVEo9jxvp",
          },
        },
      ],
    },
    null,
    2
  );

  const toolsData = [
    // Sessions
    { name: "list_sessions", category: "Sessions", desc: "List all WhatsApp sessions with live status and account details." },
    { name: "create_session", category: "Sessions", desc: "Create a new WhatsApp session entry in the database." },
    { name: "get_session", category: "Sessions", desc: "Get single session details including phone number and display name." },
    { name: "delete_session", category: "Sessions", desc: "Delete a session and stop its background engine permanently." },
    { name: "start_session", category: "Sessions", desc: "Start the Baileys WhatsApp engine process for a session." },
    { name: "stop_session", category: "Sessions", desc: "Gracefully stop a running session engine." },
    { name: "restart_session", category: "Sessions", desc: "Restart a running session engine process." },

    // Login & QR
    { name: "login_whatsapp", category: "Login & QR", desc: "Start login flow, retrieve QR code string, and return base64 PNG data URI for AI display." },
    { name: "check_login_status", category: "Login & QR", desc: "Check current authentication status of a session during QR pairing." },
    { name: "get_qr_code", category: "Login & QR", desc: "Retrieve latest QR code image or raw string for an ongoing pairing session." },

    // Chats & Messaging
    { name: "list_chats", category: "Messaging", desc: "List all conversation threads with unread counts and last message previews." },
    { name: "get_chat_messages", category: "Messaging", desc: "Fetch message history for a specific conversation JID." },
    { name: "send_message", category: "Messaging", desc: "Send an outgoing WhatsApp text message to a contact JID or phone number." },
    { name: "send_media_message", category: "Messaging", desc: "Send image, video, audio voice notes, or documents with captions." },
    { name: "mark_chat_read", category: "Messaging", desc: "Mark a conversation as read and clear unread badges on device." },

    // Campaigns & Anti-Ban
    { name: "list_campaigns", category: "Campaigns", desc: "List all bulk messaging campaigns with delivered counts and reply rates." },
    { name: "create_campaign", category: "Campaigns", desc: "Create an anti-ban bulk outreach campaign with Spintax and follow-up steps." },
    { name: "start_campaign", category: "Campaigns", desc: "Start or resume execution of a bulk messaging campaign." },
    { name: "pause_campaign", category: "Campaigns", desc: "Pause an active campaign immediately." },
    { name: "stop_campaign", category: "Campaigns", desc: "Permanently stop campaign execution." },
    { name: "clone_campaign", category: "Campaigns", desc: "Duplicate a campaign configuration including follow-up sequences." },
    { name: "delete_campaign", category: "Campaigns", desc: "Delete a campaign and its associated recipients." },

    // Contacts & Blacklist
    { name: "list_contacts", category: "Contacts", desc: "List all synced WhatsApp contacts with name and phone number." },
    { name: "sync_contacts", category: "Contacts", desc: "Trigger phone address book synchronization from Baileys engine." },
    { name: "get_blacklist", category: "Safety", desc: "Retrieve all phone numbers and domains on the global anti-outreach blacklist." },
    { name: "add_to_blacklist", category: "Safety", desc: "Add a recipient phone number to the blacklist to prevent future messaging." },
    { name: "remove_from_blacklist", category: "Safety", desc: "Remove a recipient phone number from the blacklist." },
  ];

  const categories = ["All", "Sessions", "Login & QR", "Messaging", "Campaigns", "Contacts", "Safety"];

  const filteredTools = toolsData.filter((t) => {
    const matchCat = selectedCategory === "All" || t.category === selectedCategory;
    const matchQuery =
      searchQuery.trim() === "" ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.desc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchQuery;
  });

  const tabItems: { id: "config" | "tools" | "qr" | "skill" | "docker"; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "config", label: "Client Configs", icon: Code2 },
    { id: "tools", label: `Tools Catalog (${toolsData.length})`, icon: Cpu },
    { id: "qr", label: "Agent QR Protocol", icon: QrCode },
    { id: "skill", label: "Antigravity Skill", icon: Bot },
    { id: "docker", label: "Podman & Docker", icon: Server },
  ];

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Shield className="w-4 h-4" />
            </div>
            MCP Protocol & AI Agent Skills Studio
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Standardized Model Context Protocol interfaces for Google Antigravity, Claude Desktop & Hermes Agent
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            49 Stdio Tools Live
          </span>
        </div>
      </div>

      {/* Safety Controls Card (rareui / liquid toggle inspired) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#101115] border border-zinc-200/80 dark:border-white/[0.08] shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <Cpu className="w-4 h-4 text-emerald-500" />
          <h3 className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
            Agent Execution & Safety Controls
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          <LiquidToggle
            checked={antiBanThrottling}
            onChange={setAntiBanThrottling}
            label="Anti-Bot Throttling"
            description="Rate-limits agent tool calls to avoid high-frequency bot detection."
          />
          <LiquidToggle
            checked={autoSessionRouting}
            onChange={setAutoSessionRouting}
            label="Auto Session Routing"
            description="Automatically selects the healthiest READY session for outreach."
          />
          <LiquidToggle
            checked={stdioBridgeSandbox}
            onChange={setStdioBridgeSandbox}
            label="Stdio Bridge Isolation"
            description="Runs process child pipes inside verified isolated sandbox environment."
          />
        </div>
      </div>

      {/* Navigation Tabs (rareui FolderComponent style) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 select-none">
        {tabItems.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 shrink-0 ${
                isActive
                  ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 shadow-md shadow-zinc-900/10 dark:shadow-white/10 scale-[1.02]"
                  : "bg-white dark:bg-[#121316] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 border border-zinc-200/80 dark:border-white/[0.08]"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Client Configurations */}
      {activeTab === "config" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Antigravity */}
          <div className="bg-white dark:bg-[#101115] border border-zinc-200/80 dark:border-white/[0.08] rounded-2xl p-5 space-y-4 shadow-xs flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-emerald-500" /> Google Antigravity
                </span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md font-mono">
                  .gemini/settings.json
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Connects Antigravity CLI and IDE agents directly to the Velurix MCP server via stdio.
              </p>
            </div>
            <div className="relative group">
              <pre className="bg-zinc-950 text-emerald-400 p-3.5 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48 border border-zinc-800">
                {antigravityConfig}
              </pre>
              <button
                onClick={() => handleCopy(antigravityConfig, "antigravity")}
                className="absolute top-2.5 right-2.5 p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
                title="Copy JSON configuration"
              >
                {copiedKey === "antigravity" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Claude Desktop */}
          <div className="bg-white dark:bg-[#101115] border border-zinc-200/80 dark:border-white/[0.08] rounded-2xl p-5 space-y-4 shadow-xs flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-emerald-500" /> Claude Desktop
                </span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md font-mono">
                  claude_desktop_config.json
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Integrates all 49 WhatsApp tools directly into Anthropic's Claude Desktop application.
              </p>
            </div>
            <div className="relative group">
              <pre className="bg-zinc-950 text-emerald-400 p-3.5 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48 border border-zinc-800">
                {claudeConfig}
              </pre>
              <button
                onClick={() => handleCopy(claudeConfig, "claude")}
                className="absolute top-2.5 right-2.5 p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
                title="Copy JSON configuration"
              >
                {copiedKey === "claude" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Hermes Agent */}
          <div className="bg-white dark:bg-[#101115] border border-zinc-200/80 dark:border-white/[0.08] rounded-2xl p-5 space-y-4 shadow-xs flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-500" /> Hermes Agent
                </span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md font-mono">
                  hermes_mcp_config.json
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Empowers autonomous Hermes agents with automated WhatsApp QR login & bulk campaigns.
              </p>
            </div>
            <div className="relative group">
              <pre className="bg-zinc-950 text-emerald-400 p-3.5 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48 border border-zinc-800">
                {hermesConfig}
              </pre>
              <button
                onClick={() => handleCopy(hermesConfig, "hermes")}
                className="absolute top-2.5 right-2.5 p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
                title="Copy JSON configuration"
              >
                {copiedKey === "hermes" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Tools Dictionary */}
      {activeTab === "tools" && (
        <div className="space-y-5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    selectedCategory === cat
                      ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 shadow-sm"
                      : "bg-white dark:bg-[#121316] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 border border-zinc-200/80 dark:border-white/[0.08]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Magnifying Glass Search */}
            <div className="w-full md:w-64">
              <MagnifyingGlass
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search tools..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTools.map((tool) => (
              <div
                key={tool.name}
                className="bg-white dark:bg-[#101115] border border-zinc-200/80 dark:border-white/[0.08] hover:border-emerald-500/40 rounded-2xl p-4 space-y-2 transition-all shadow-xs group"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {tool.name}
                  </span>
                  <span className="text-[10px] bg-zinc-100 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-md font-medium">
                    {tool.category}
                  </span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {tool.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Hermes QR Login Flow */}
      {activeTab === "qr" && (
        <div className="bg-white dark:bg-[#101115] border border-zinc-200/80 dark:border-white/[0.08] rounded-2xl p-6 md:p-8 space-y-6 shadow-xs">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-emerald-500" /> WhatsApp QR Code Login Flow for AI Agents
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-3xl">
              Hermes-agent and other AI assistants can initiate, render, and complete WhatsApp web authentication without human code intervention.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="bg-zinc-50 dark:bg-[#14151a] p-5 rounded-2xl border border-zinc-200/80 dark:border-white/[0.06] space-y-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center">
                1
              </div>
              <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                Call `login_whatsapp`
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                The agent calls <code>login_whatsapp(session_name)</code>. The tool creates a session, starts Baileys, generates the QR, and returns a base64 PNG data URI.
              </p>
            </div>

            <div className="bg-zinc-50 dark:bg-[#14151a] p-5 rounded-2xl border border-zinc-200/80 dark:border-white/[0.06] space-y-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center">
                2
              </div>
              <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                Display QR Image
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                The agent presents the rendered QR image block inline to the user in chat. The user opens WhatsApp on phone ➔ Linked Devices ➔ Scans QR code.
              </p>
            </div>

            <div className="bg-zinc-50 dark:bg-[#14151a] p-5 rounded-2xl border border-zinc-200/80 dark:border-white/[0.06] space-y-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center">
                3
              </div>
              <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                Poll `check_login_status`
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                The agent polls <code>check_login_status(session_id)</code>. As soon as the user scans, status transitions to <code>CONNECTED</code> with account phone number and display name.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Antigravity Skill */}
      {activeTab === "skill" && (
        <div className="bg-white dark:bg-[#101115] border border-zinc-200/80 dark:border-white/[0.08] rounded-2xl p-6 md:p-8 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-emerald-500" /> Installed Antigravity Agent Skill
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Location: <code className="bg-zinc-100 dark:bg-white/10 px-2 py-0.5 rounded text-emerald-500">C:\Users\subho\.gemini\config\skills\reachout-mcp-control\SKILL.md</code>
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 w-fit">
              <CheckCircle2 className="w-3.5 h-3.5" /> Installed & Active
            </span>
          </div>

          <div className="bg-zinc-950 text-emerald-400 p-4 rounded-xl text-xs font-mono overflow-x-auto space-y-2 border border-zinc-800">
            <div className="text-zinc-500"># Skill Prompt Usage Examples:</div>
            <div>"Use reachout MCP to login a new WhatsApp session named MarketingAcc"</div>
            <div>"Create and start a campaign named Q3Leads using session_123 with 30s jitter delay"</div>
            <div>"Check system health and show me all active WhatsApp sessions"</div>
          </div>
        </div>
      )}

      {/* Tab 5: Podman / Docker Deployment */}
      {activeTab === "docker" && (
        <div className="bg-white dark:bg-[#101115] border border-zinc-200/80 dark:border-white/[0.08] rounded-2xl p-6 md:p-8 space-y-6 shadow-xs">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Server className="w-5 h-5 text-emerald-500" /> Containerized Podman / Docker Deployment
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              The MCP server executable is compiled during container image build and packaged inside <code>velurix-backend</code>.
            </p>
          </div>

          <div className="bg-zinc-950 text-emerald-400 p-4 rounded-xl text-xs font-mono overflow-x-auto space-y-2 border border-zinc-800">
            <div className="text-zinc-500"># Run MCP Server directly from running Podman container:</div>
            <div>wsl podman exec -it velurix-backend node /app/apps/mcp-server/dist/index.js</div>
          </div>
        </div>
      )}
    </div>
  );
}
