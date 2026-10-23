"use client";

import React, { useState, useEffect } from "react";
import {
  Cpu,
  Check,
  Copy,
  ShieldCheck,
  Sparkles,
  Bot,
  X,
} from "lucide-react";
import { cn } from "@/components/ui/utils";
import { getMcpPublicUrl } from "@/lib/mcp/types";

interface McpIntegrationCardProps {
  user: { email?: string | null; id?: string } | null;
  role: string | null;
}

export function McpIntegrationCard({ user, role }: McpIntegrationCardProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"claude" | "chatgpt" | "antigravity" | "cursor" | "tools">("claude");
  const [serverStatus, setServerStatus] = useState<"checking" | "online" | "offline">("checking");
  const [toolsCount, setToolsCount] = useState<number>(17);

  // Asegura que aun en localhost:3000 la URL que se muestre y copie sea la desplegada en Vercel
  const mcpUrl = getMcpPublicUrl(typeof window !== "undefined" ? window.location.origin : undefined);

  const userEmail = user?.email || "comercial@firplak.com";
  const userRole = (role || "VENDEDOR").toUpperCase();

  useEffect(() => {
    let isMounted = true;
    async function checkStatus() {
      try {
        const res = await fetch("/api/mcp");
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setServerStatus("online");
            if (data?.capabilities?.tools_count) {
              setToolsCount(data.capabilities.tools_count);
            }
          }
        } else {
          if (isMounted) setServerStatus("offline");
        }
      } catch {
        if (isMounted) setServerStatus("offline");
      }
    }
    checkStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const claudeConfig = JSON.stringify(
    {
      mcpServers: {
        "crm-firplak": {
          command: "node",
          args: ["bin/crm-mcp.mjs"],
          cwd: typeof window !== "undefined" ? "C:\\Users\\isaza\\OneDrive\\Documentos\\CRM FIRPLAK\\CRM" : ".",
          env: {
            CRM_USER_EMAIL: userEmail,
            CRM_USER_ROLE: userRole,
            NEXT_PUBLIC_SUPABASE_URL: "https://lnphhmowklqiomownurw.supabase.co",
          },
        },
      },
    },
    null,
    2
  );

  const antigravityConfig = JSON.stringify(
    {
      mcpServers: {
        "crm-firplak": {
          command: "node",
          args: ["bin/crm-mcp.mjs"],
          cwd: "C:\\Users\\isaza\\OneDrive\\Documentos\\CRM FIRPLAK\\CRM",
          env: {
            CRM_USER_EMAIL: userEmail,
            CRM_USER_ROLE: userRole,
          },
        },
      },
    },
    null,
    2
  );

  const cursorConfig = JSON.stringify(
    {
      mcpServers: {
        "crm-firplak": {
          command: "node",
          args: ["bin/crm-mcp.mjs"],
          env: {
            CRM_USER_ROLE: userRole,
          },
        },
      },
    },
    null,
    2
  );

  return (
    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col justify-between space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-600/10 text-purple-600 flex items-center justify-center font-bold">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 leading-tight">Servidor MCP Firplak</h4>
              <p className="text-[11px] text-slate-500">Model Context Protocol para IAs</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-full border border-slate-200 shadow-2xs">
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                serverStatus === "online"
                  ? "bg-emerald-500 animate-pulse"
                  : serverStatus === "offline"
                  ? "bg-red-400"
                  : "bg-amber-400"
              )}
            />
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
              {serverStatus === "online" ? "En Línea" : serverStatus === "offline" ? "Inactivo" : "Verificando..."}
            </span>
          </div>
        </div>

        {/* URL Box */}
        <div className="mt-3 bg-white p-2.5 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Endpoint API / SSE (Vercel)</span>
              <p className="text-xs font-mono font-medium text-slate-700 truncate">{mcpUrl}</p>
            </div>
            <button
              onClick={() => handleCopy(mcpUrl, "url")}
              className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              title="Copiar URL"
            >
              {copied === "url" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Badges Info */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
            <ShieldCheck className="w-3 h-3 text-emerald-600" /> Cero Borrado
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
            <Bot className="w-3 h-3" /> {toolsCount} Tools
          </span>
          <span className="inline-flex items-center text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
            Rol: {userRole}
          </span>
        </div>
      </div>

      {/* Button to open Modal */}
      <button
        onClick={() => setModalOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-500/20 active:scale-[0.98]"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Ver Credenciales y Conexión IA
      </button>

      {/* Modal con instrucciones y configuraciones */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-bold shadow-md shadow-purple-500/30">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Conexión al Servidor MCP Firplak</h3>
                  <p className="text-xs text-slate-500">Configura Claude Desktop, ChatGPT, Antigravity o Cursor con tus credenciales.</p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-100 bg-slate-50/70 px-6 gap-2 pt-2">
              {(
                [
                  { id: "claude", label: "Claude Desktop" },
                  { id: "antigravity", label: "Antigravity IDE" },
                  { id: "cursor", label: "Cursor / Windsurf" },
                  { id: "chatgpt", label: "ChatGPT Actions" },
                  { id: "tools", label: "Herramientas" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2",
                    activeTab === tab.id
                      ? "border-purple-600 text-purple-700 bg-white"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {activeTab === "claude" && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600">
                    Añade este bloque a tu archivo <code className="bg-slate-100 px-1 py-0.5 rounded text-purple-700">claude_desktop_config.json</code> en Claude Desktop:
                  </p>
                  <div className="relative">
                    <pre className="bg-slate-900 text-slate-100 p-4 rounded-2xl text-xs font-mono overflow-x-auto leading-relaxed">
                      {claudeConfig}
                    </pre>
                    <button
                      onClick={() => handleCopy(claudeConfig, "claude-json")}
                      className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold backdrop-blur-xs transition-colors"
                    >
                      {copied === "claude-json" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied === "claude-json" ? "Copiado" : "Copiar JSON"}</span>
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "antigravity" && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600">
                    Configuración para <code className="bg-slate-100 px-1 py-0.5 rounded text-purple-700">mcp_config.json</code> en Antigravity IDE / Gemini CLI:
                  </p>
                  <div className="relative">
                    <pre className="bg-slate-900 text-slate-100 p-4 rounded-2xl text-xs font-mono overflow-x-auto leading-relaxed">
                      {antigravityConfig}
                    </pre>
                    <button
                      onClick={() => handleCopy(antigravityConfig, "ag-json")}
                      className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold backdrop-blur-xs transition-colors"
                    >
                      {copied === "ag-json" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied === "ag-json" ? "Copiado" : "Copiar JSON"}</span>
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "cursor" && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600">
                    Configuración para <code className="bg-slate-100 px-1 py-0.5 rounded text-purple-700">.cursor/mcp.json</code>:
                  </p>
                  <div className="relative">
                    <pre className="bg-slate-900 text-slate-100 p-4 rounded-2xl text-xs font-mono overflow-x-auto leading-relaxed">
                      {cursorConfig}
                    </pre>
                    <button
                      onClick={() => handleCopy(cursorConfig, "cursor-json")}
                      className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold backdrop-blur-xs transition-colors"
                    >
                      {copied === "cursor-json" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied === "cursor-json" ? "Copiado" : "Copiar JSON"}</span>
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "chatgpt" && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Endpoint para ChatGPT Actions</span>
                    <p className="text-xs font-mono font-bold text-slate-800 break-all">{mcpUrl}</p>
                    <button
                      onClick={() => handleCopy(mcpUrl, "gpt-url")}
                      className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-bold shadow-2xs transition-colors"
                    >
                      {copied === "gpt-url" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied === "gpt-url" ? "Copiado" : "Copiar URL"}</span>
                    </button>
                  </div>

                  <div className="text-xs text-slate-600 space-y-2">
                    <p className="font-bold text-slate-800">Instrucciones de configuración:</p>
                    <ol className="list-decimal pl-4 space-y-1.5">
                      <li>En ChatGPT, crea un Custom GPT y ve a <strong>Actions</strong> &gt; <strong>Create new action</strong>.</li>
                      <li>Introduce la URL del endpoint <code className="bg-slate-100 px-1 py-0.5 rounded text-purple-700">{mcpUrl}</code>.</li>
                      <li>Configura autenticación tipo <strong>Bearer</strong> usando tu token de sesión de Supabase Auth.</li>
                    </ol>
                  </div>
                </div>
              )}

              {activeTab === "tools" && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600">
                    Herramientas operativas habilitadas para tu rol actual (<span className="font-bold text-purple-700">{userRole}</span>):
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-800 block mb-1">Oportunidades</span>
                      <ul className="text-slate-500 space-y-0.5 list-disc pl-3">
                        <li>crm_buscar_oportunidades</li>
                        <li>crm_consultar_oportunidad</li>
                        <li>crm_crear_oportunidad</li>
                        <li>crm_actualizar_oportunidad</li>
                        <li>crm_recuperar_oportunidad</li>
                        {userRole !== "VENDEDOR" && <li>crm_reasignar_oportunidad</li>}
                      </ul>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-800 block mb-1">Cuentas y Contactos</span>
                      <ul className="text-slate-500 space-y-0.5 list-disc pl-3">
                        <li>crm_buscar_cuentas</li>
                        <li>crm_consultar_cuenta</li>
                        <li>crm_crear_cuenta</li>
                        <li>crm_actualizar_cuenta</li>
                        <li>crm_listar_contactos</li>
                        <li>crm_crear_contacto</li>
                      </ul>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-800 block mb-1">Actividades y Agenda</span>
                      <ul className="text-slate-500 space-y-0.5 list-disc pl-3">
                        <li>crm_agenda_diaria</li>
                        <li>crm_listar_actividades</li>
                        <li>crm_crear_actividad</li>
                        <li>crm_actualizar_actividad</li>
                        <li>crm_recuperar_actividad</li>
                      </ul>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-800 block mb-1">Recursos Nativos (crm://)</span>
                      <ul className="text-slate-500 space-y-0.5 list-disc pl-3">
                        <li>crm://canales</li>
                        <li>crm://fases/{'{canal_id}'}</li>
                        <li>crm://clasificaciones-actividad</li>
                        <li>crm://motivos-perdida</li>
                        <li>crm://metricas-embudo</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Identidad activa: <strong>{userEmail}</strong>
              </span>
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
