// "use client";

// import { useState } from "react";
// import { useQuery, useMutation } from "@tanstack/react-query";
// import { apiClient } from "@/lib/api-client";
// import { MessageResponse } from "@/types/message";
// import {
//   Send,
//   Loader2,
//   CheckCircle2,
//   AlertCircle,
//   Smartphone,
//   MessageSquare,
//   Info,
//   Key,
// } from "lucide-react";


// export default function MessagesPage() {
//   const [selectedSessionId, setSelectedSessionId] = useState<string>("");
//   const [recipient, setRecipient] = useState<string>("");
//   const [text, setText] = useState<string>("");
//   const [apiKey, setApiKey] = useState<string>("");

//   const [lastResult, setLastResult] = useState<{
//     success: boolean;
//     data?: MessageResponse;
//     error?: string;
//   } | null>(null);

//   // Fetch all sessions to populate the session dropdown
//   const { data: sessions = [], isLoading: isLoadingSessions } = useQuery({
//     queryKey: ["sessions"],
//     queryFn: () => apiClient.getSessions(),
//     refetchInterval: 5000,
//   });

//   const readySessions = sessions.filter((s) => s.status === "READY");

//   // Auto-select first READY session if none selected
//   if (readySessions.length > 0 && (!selectedSessionId || !readySessions.some((s) => s.id === selectedSessionId))) {
//     setSelectedSessionId(readySessions[0].id);
//   }


//   const sendMutation = useMutation({
//     mutationFn: () =>
//       apiClient.sendTextMessage(
//         selectedSessionId,
//         {
//           to: recipient,
//           text,
//         },
//         apiKey.trim() || undefined
//       ),
//     onSuccess: (data) => {
//       setLastResult({ success: true, data });
//       setText("");
//     },
//     onError: (err: any) => {
//       setLastResult({
//         success: false,
//         error: err?.message || "Failed to send message",
//       });
//     },
//   });


//   const isSending = sendMutation.isPending;
//   const isFormValid =
//     selectedSessionId.trim() !== "" &&
//     recipient.trim() !== "" &&
//     text.trim() !== "" &&
//     !isSending;

//   function handleSubmit(e: React.FormEvent) {
//     e.preventDefault();
//     if (!isFormValid) return;
//     setLastResult(null);
//     sendMutation.mutate();
//   }

//   return (
//     <div className="max-w-3xl mx-auto space-y-8 py-4">
//       <div className="text-center space-y-2 pt-2">
//         <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
//           <span>Single-Message Gateway Pipeline</span>
//         </div>
//         <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
//           Send Test Message
//         </h1>
//         <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
//           Send an outgoing text message to a single recipient using an active, authenticated WhatsApp session.
//         </p>
//       </div>

//       <div className="bg-white dark:bg-[#0e0e11] border border-zinc-200/90 dark:border-zinc-800/90 rounded-2xl p-6 md:p-8 shadow-sm dark:shadow-xl space-y-6">
//         <form onSubmit={handleSubmit} className="space-y-6">
//           {/* Session Selector */}
//           <div className="space-y-2">
//             <label className="block text-xs font-semibold text-zinc-900 dark:text-zinc-200 flex items-center justify-between">
//               <span className="flex items-center gap-1.5">
//                 <Smartphone className="w-4 h-4 text-zinc-500" />
//                 Select WhatsApp Session
//               </span>
//               <span className="text-[11px] font-normal text-zinc-500">
//                 {readySessions.length} session(s) READY
//               </span>
//             </label>

//             {isLoadingSessions ? (
//               <div className="h-10 rounded-xl bg-zinc-100 dark:bg-zinc-900 animate-pulse border border-zinc-200 dark:border-zinc-800 flex items-center px-3">
//                 <Loader2 className="w-4 h-4 text-zinc-400 animate-spin mr-2" />
//                 <span className="text-xs text-zinc-400">Loading sessions...</span>
//               </div>
//             ) : readySessions.length === 0 ? (
//               <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2.5">
//                 <AlertCircle className="w-4 h-4 shrink-0" />
//                 <span>
//                   No active READY session available. Please authenticate a WhatsApp session in the Dashboard first.
//                 </span>
//               </div>
//             ) : (
//               <select
//                 value={selectedSessionId}
//                 onChange={(e) => setSelectedSessionId(e.target.value)}
//                 className="w-full h-11 px-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-700 transition-all"
//               >
//                 <option value="">-- Choose a READY Session --</option>
//                 {readySessions.map((session) => (
//                   <option key={session.id} value={session.id}>
//                     {session.name} ({session.phoneNumber ? `+${session.phoneNumber}` : session.id})
//                   </option>
//                 ))}
//               </select>
//             )}
//           </div>

//           {/* API Key Input (Optional unless API_KEY is set on backend) */}
//           <div className="space-y-2">
//             <label className="block text-xs font-semibold text-zinc-900 dark:text-zinc-200 flex items-center justify-between">
//               <span className="flex items-center gap-1.5">
//                 <Key className="w-4 h-4 text-zinc-500" />
//                 API Key (X-API-Key)
//               </span>
//               <span className="text-[11px] font-normal text-zinc-500">
//                 Optional if API_KEY env is empty
//               </span>
//             </label>
//             <input
//               type="password"
//               placeholder="Enter API Key if configured in backend"
//               value={apiKey}
//               onChange={(e) => setApiKey(e.target.value)}
//               className="w-full h-11 px-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-700 transition-all"
//             />
//           </div>

//           {/* Recipient Input */}
//           <div className="space-y-2">

//             <label className="block text-xs font-semibold text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
//               <span>Recipient Phone Number</span>
//             </label>
//             <input
//               type="text"
//               placeholder="e.g. +91 98765 43210 or 919876543210"
//               value={recipient}
//               onChange={(e) => setRecipient(e.target.value)}
//               className="w-full h-11 px-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-700 transition-all"
//             />
//             <p className="text-[11px] text-zinc-500 flex items-center gap-1">
//               <Info className="w-3 h-3 shrink-0" />
//               Include country code without special symbols (e.g. 919876543210 for India).
//             </p>
//           </div>

//           {/* Message Text Input */}
//           <div className="space-y-2">
//             <div className="flex items-center justify-between">
//               <label className="block text-xs font-semibold text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
//                 <MessageSquare className="w-4 h-4 text-zinc-500" />
//                 Message Text
//               </label>
//               <span className="text-[11px] text-zinc-500 font-mono">
//                 {text.length}/4096
//               </span>
//             </div>
//             <textarea
//               rows={4}
//               placeholder="Hello from Velurix ReachOut Automation!"
//               value={text}
//               onChange={(e) => setText(e.target.value)}
//               className="w-full p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-700 transition-all resize-none"
//             />
//           </div>

//           {/* Submit Button */}
//           <button
//             type="submit"
//             disabled={!isFormValid}
//             className={`w-full h-11 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm ${
//               isFormValid
//                 ? "bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-zinc-50 dark:text-zinc-950 cursor-pointer"
//                 : "bg-zinc-200 dark:bg-zinc-800/50 text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
//             }`}
//           >
//             {isSending ? (
//               <>
//                 <Loader2 className="w-4 h-4 animate-spin" />
//                 <span>Sending Message via WhatsApp...</span>
//               </>
//             ) : (
//               <>
//                 <Send className="w-4 h-4" />
//                 <span>Send Message</span>
//               </>
//             )}
//           </button>
//         </form>

//         {/* Result Feedback Banner */}
//         {lastResult && (
//           <div
//             className={`p-4 rounded-xl border space-y-2 text-xs transition-all ${
//               lastResult.success
//                 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-200"
//                 : "bg-rose-500/10 border-rose-500/20 text-rose-900 dark:text-rose-200"
//             }`}
//           >
//             <div className="flex items-center gap-2 font-semibold text-sm">
//               {lastResult.success ? (
//                 <>
//                   <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
//                   <span>Message Sent Successfully</span>
//                 </>
//               ) : (
//                 <>
//                   <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
//                   <span>Message Send Failed</span>
//                 </>
//               )}
//             </div>

//             {lastResult.success && lastResult.data && (
//               <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-500/20 text-[11px] font-mono">
//                 <div>
//                   <span className="text-zinc-500">Message ID: </span>
//                   <span className="font-bold">{lastResult.data.id}</span>
//                 </div>
//                 <div>
//                   <span className="text-zinc-500">Recipient: </span>
//                   <span className="font-bold">+{lastResult.data.to}</span>
//                 </div>
//                 <div>
//                   <span className="text-zinc-500">Status: </span>
//                   <span className="uppercase font-bold text-emerald-600 dark:text-emerald-400">
//                     {lastResult.data.status}
//                   </span>
//                 </div>
//                 <div>
//                   <span className="text-zinc-500">WhatsApp ID: </span>
//                   <span className="font-bold">{lastResult.data.externalId || "N/A"}</span>
//                 </div>
//               </div>
//             )}

//             {!lastResult.success && (
//               <p className="text-[11px] font-mono text-rose-600 dark:text-rose-300">
//                 {lastResult.error}
//               </p>
//             )}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }


import { redirect } from "next/navigation";

export default function MessagesPage() {
  redirect("/dashboard/messages/send");
}