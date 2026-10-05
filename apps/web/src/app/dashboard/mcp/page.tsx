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
} from "lucide-react";

export default function McpDocsPage() {
  const [activeTab, setActiveTab] = useState<"config" | "tools" | "qr" | "skill" | "docker">("config");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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
            VELURIX_API_URL: "http://172.21.92.41:8080/api/v1",
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
            VELURIX_API_URL: "http://localhost:8080/api/v1",
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
            VELURIX_API_URL: "http://172.21.92.41:8080/api/v1",
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
    { name: "check_login_status", category: "Login & QR", desc: "Poll session login state after QR scan (returns CONNECTED, WAITING, or FAILED)." },
    { name: "request_pairing_code", category: "Login & QR", desc: "Request an 8-character phone pairing code as an alternative to QR scanning." },

    // Messages
    { name: "send_whatsapp_text", category: "Messages", desc: "Send a text message from a specific session to a WhatsApp number/JID." },
    { name: "send_whatsapp_media", category: "Messages", desc: "Send image, video, document, or audio media from a session." },
    { name: "validate_phone_numbers", category: "Messages", desc: "Batch validate whether phone numbers are registered WhatsApp accounts." },

    // Contacts & Chats
    { name: "list_contacts", category: "Contacts", desc: "List synced contacts for a WhatsApp session." },
    { name: "search_contacts", category: "Contacts", desc: "Search contacts by name or phone number." },
    { name: "sync_contacts", category: "Contacts", desc: "Force trigger contact synchronization from WhatsApp." },
    { name: "get_profile_picture", category: "Contacts", desc: "Fetch profile picture URL for a contact." },
    { name: "list_chats", category: "Chats", desc: "List active WhatsApp chat conversations." },
    { name: "get_chat_messages", category: "Chats", desc: "Retrieve message history for a specific chat." },
    { name: "sync_chats", category: "Chats", desc: "Force sync chat conversations from WhatsApp." },
    { name: "mark_chat_read", category: "Chats", desc: "Mark a chat conversation as read." },

    // Campaigns
    { name: "list_campaigns", category: "Campaigns", desc: "List all campaigns with progress metrics and status." },
    { name: "get_campaign", category: "Campaigns", desc: "Get detailed campaign settings, steps, and anti-ban rules." },
    { name: "create_campaign", category: "Campaigns", desc: "Create a multi-step campaign with anti-ban delay configuration." },
    { name: "update_campaign", category: "Campaigns", desc: "Update existing campaign name, description, or configuration." },
    { name: "delete_campaign", category: "Campaigns", desc: "Delete a campaign and its recipient queue." },
    { name: "clone_campaign", category: "Campaigns", desc: "Clone an existing campaign with all steps and anti-ban settings." },
    { name: "start_campaign", category: "Campaigns", desc: "Start executing a pending or paused campaign." },
    { name: "pause_campaign", category: "Campaigns", desc: "Pause a running campaign execution." },
    { name: "stop_campaign", category: "Campaigns", desc: "Stop a campaign completely." },
    { name: "retry_failed_recipients", category: "Campaigns", desc: "Re-queue all failed recipients for execution retry." },
    { name: "import_recipients", category: "Campaigns", desc: "Import recipient phone numbers and custom variables into a campaign." },
    { name: "export_campaign_results", category: "Campaigns", desc: "Export campaign recipient delivery and reply audit trail as CSV." },

    // Recipients & Logs
    { name: "list_campaign_recipients", category: "Recipients & Logs", desc: "List all recipients in a campaign with delivery status." },
    { name: "update_campaign_recipient", category: "Recipients & Logs", desc: "Update recipient custom variables or reschedule follow-up time." },
    { name: "list_campaign_logs", category: "Recipients & Logs", desc: "List message delivery logs including resolved message text." },

    // Blacklist & Templates
    { name: "get_blacklist", category: "Blacklist & Templates", desc: "Get all global blacklisted phone numbers." },
    { name: "add_to_blacklist", category: "Blacklist & Templates", desc: "Add number(s) to global anti-messaging blacklist." },
    { name: "remove_from_blacklist", category: "Blacklist & Templates", desc: "Remove number from global blacklist." },
    { name: "list_templates", category: "Blacklist & Templates", desc: "List reusable message templates." },
    { name: "get_template", category: "Blacklist & Templates", desc: "Get message template details by ID." },
    { name: "create_template", category: "Blacklist & Templates", desc: "Create a new message template." },
    { name: "update_template", category: "Blacklist & Templates", desc: "Update an existing message template." },
    { name: "delete_template", category: "Blacklist & Templates", desc: "Delete a message template." },

    // Smart Composite
    { name: "send_campaign_message", category: "Smart Composite", desc: "One-shot: validates number and sends text message in a single tool call." },
    { name: "send_bulk_messages", category: "Smart Composite", desc: "Sends messages to multiple numbers with configurable jitter delay." },
    { name: "create_and_start_campaign", category: "Smart Composite", desc: "All-in-one wizard: creates campaign + imports recipients + starts execution." },
    { name: "get_campaign_dashboard", category: "Smart Composite", desc: "Aggregates sent/delivered/failed/replied stats and progress %." },
    { name: "full_system_status", category: "Smart Composite", desc: "Complete system summary across sessions, active campaigns, and health." },
  ];

  const categories = ["All", "Sessions", "Login & QR", "Messages", "Contacts", "Chats", "Campaigns", "Recipients & Logs", "Blacklist & Templates", "Smart Composite"];

  const filteredTools = toolsData.filter((t) => {
    const matchesCat = selectedCategory === "All" || t.category === selectedCategory;
    const matchesQuery = t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.desc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-4">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-emerald-950 p-6 md:p-8 text-white border border-emerald-500/20 shadow-xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <Bot className="w-3.5 h-3.5" /> Model Context Protocol (MCP) & AI Agent Skills
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              AI Agent Control Interface
            </h1>
            <p className="text-zinc-400 text-xs md:text-sm max-w-2xl leading-relaxed">
              Equip <span className="text-emerald-400 font-semibold">Hermes Agent</span>, <span className="text-emerald-400 font-semibold">Antigravity</span>, and <span className="text-emerald-400 font-semibold">Claude Desktop</span> with 49 production-ready tools, QR login image rendering, resources, and custom agent skills.
            </p>
          </div>
          <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-3 shrink-0">
            <div className="px-4 py-2 rounded-xl bg-zinc-800/80 border border-zinc-700/50 text-right backdrop-blur-sm">
              <div className="text-xs text-zinc-400">Total Capabilities</div>
              <div className="text-lg font-bold text-emerald-400">49 Tools • 3 Resources • 3 Prompts</div>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" /> Podman Container Ready
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-zinc-800/80 pt-4">
          <button
            onClick={() => setActiveTab("config")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "config"
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                : "bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800 hover:text-white"
            }`}
          >
            <Code2 className="w-3.5 h-3.5" /> Client Configuration JSON
          </button>
          <button
            onClick={() => setActiveTab("tools")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "tools"
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                : "bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800 hover:text-white"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" /> Tools Dictionary ({toolsData.length})
          </button>
          <button
            onClick={() => setActiveTab("qr")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "qr"
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                : "bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800 hover:text-white"
            }`}
          >
            <QrCode className="w-3.5 h-3.5" /> Hermes QR Login Flow
          </button>
          <button
            onClick={() => setActiveTab("skill")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "skill"
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                : "bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800 hover:text-white"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" /> Antigravity Agent Skill
          </button>
          <button
            onClick={() => setActiveTab("docker")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "docker"
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                : "bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800 hover:text-white"
            }`}
          >
            <Server className="w-3.5 h-3.5" /> Podman / Docker Deployment
          </button>
        </div>
      </div>

      {/* Tab Content 1: Configurations */}
      {activeTab === "config" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Antigravity */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4 shadow-sm flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Bot className="w-4 h-4 text-emerald-500" /> Google Antigravity
                  </span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md font-mono">
                    .gemini/settings.json
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Configures Antigravity CLI and IDE agents to connect directly via stdio.
                </p>
              </div>
              <div className="relative group">
                <pre className="bg-zinc-950 text-emerald-400 p-3 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48 scrollbar-thin">
                  {antigravityConfig}
                </pre>
                <button
                  onClick={() => handleCopy(antigravityConfig, "antigravity")}
                  className="absolute top-2 right-2 p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
                >
                  {copiedKey === "antigravity" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Claude Desktop */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4 shadow-sm flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Bot className="w-4 h-4 text-emerald-500" /> Claude Desktop
                  </span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md font-mono">
                    claude_desktop_config.json
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Integrates all 49 tools directly into Anthropic's Claude Desktop UI app.
                </p>
              </div>
              <div className="relative group">
                <pre className="bg-zinc-950 text-emerald-400 p-3 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48 scrollbar-thin">
                  {claudeConfig}
                </pre>
                <button
                  onClick={() => handleCopy(claudeConfig, "claude")}
                  className="absolute top-2 right-2 p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
                >
                  {copiedKey === "claude" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Hermes Agent */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4 shadow-sm flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-500" /> Hermes Agent
                  </span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md font-mono">
                    hermes_mcp_config.json
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Empowers Hermes AI agent with automated WhatsApp login & campaign execution.
                </p>
              </div>
              <div className="relative group">
                <pre className="bg-zinc-950 text-emerald-400 p-3 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48 scrollbar-thin">
                  {hermesConfig}
                </pre>
                <button
                  onClick={() => handleCopy(hermesConfig, "hermes")}
                  className="absolute top-2 right-2 p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
                >
                  {copiedKey === "hermes" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 2: Tools Dictionary */}
      {activeTab === "tools" && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    selectedCategory === cat
                      ? "bg-emerald-500 text-white shadow-sm"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTools.map((tool) => (
              <div
                key={tool.name}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 space-y-2 hover:border-emerald-500/50 transition-colors shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {tool.name}
                  </span>
                  <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-md">
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

      {/* Tab Content 3: Hermes QR Login Flow */}
      {activeTab === "qr" && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-emerald-500" /> WhatsApp QR Code Login Flow for AI Agents
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-3xl">
              Hermes-agent and other AI assistants can initiate, render, and complete WhatsApp web authentication without human code intervention.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            <div className="bg-zinc-50 dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 font-bold text-xs flex items-center justify-center">
                1
              </div>
              <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                Call `login_whatsapp`
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                The agent calls `login_whatsapp(session_name)`. The tool creates a session, starts Baileys, generates the QR, and returns a base64 PNG data URI (`data:image/png;base64,...`).
              </p>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 font-bold text-xs flex items-center justify-center">
                2
              </div>
              <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                Display QR Image
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                The agent presents the rendered QR image block inline to the user in chat. The user opens WhatsApp on phone ➔ Linked Devices ➔ Scans QR code.
              </p>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 font-bold text-xs flex items-center justify-center">
                3
              </div>
              <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                Poll `check_login_status`
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                The agent polls `check_login_status(session_id)` every 3s. As soon as the user scans, status transitions to `CONNECTED` with account phone number and display name.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 4: Antigravity Skill */}
      {activeTab === "skill" && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-emerald-500" /> Installed Antigravity Agent Skill
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Location: <code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-emerald-500">C:\Users\subho\.gemini\config\skills\reachout-mcp-control\SKILL.md</code>
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" /> Installed & Active
            </span>
          </div>

          <div className="bg-zinc-950 text-emerald-400 p-4 rounded-2xl text-xs font-mono overflow-x-auto space-y-2">
            <div className="text-zinc-500"># Skill Prompt Usage Examples:</div>
            <div>"Use reachout MCP to login a new WhatsApp session named MarketingAcc"</div>
            <div>"Create and start a campaign named Q3Leads using session_123 with 30s jitter delay"</div>
            <div>"Check system health and show me all active WhatsApp sessions"</div>
          </div>
        </div>
      )}

      {/* Tab Content 5: Docker / Podman Deployment */}
      {activeTab === "docker" && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Server className="w-5 h-5 text-emerald-500" /> Containerized Podman / Docker Deployment
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              The MCP server executable is compiled during container image build and packaged inside `velurix-backend`.
            </p>
          </div>

          <div className="bg-zinc-950 text-emerald-400 p-4 rounded-2xl text-xs font-mono overflow-x-auto space-y-2">
            <div className="text-zinc-500"># Run MCP Server directly from running Podman container:</div>
            <div>wsl podman exec -it velurix-backend node /app/apps/mcp-server/dist/index.js</div>
          </div>
        </div>
      )}
    </div>
  );
}
