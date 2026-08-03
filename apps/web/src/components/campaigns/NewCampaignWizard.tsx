"use client";

import { useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  Settings,
  CheckCircle2,
  AlertTriangle,
  Play,
  X,
  Plus,
  Trash2,
  ShieldAlert,
  Clock,
  Shuffle,
  Eye,
  Users,
} from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { apiClient } from "@/lib/api-client";
import { Session } from "@/types/session";

interface NewCampaignWizardProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: Session[];
  onSuccess: () => void;
}

interface StepConfig {
  delayHours: number;
  messageTemplate: string;
  sourceColumn?: string; // Excel column name — if set, use per-recipient text from this column
  mediaUrl?: string;
  mediaType?: "image" | "document" | "audio" | "video";
}

interface ParsedRow {
  [key: string]: string;
}

export function NewCampaignWizard({
  isOpen,
  onClose,
  sessions,
  onSuccess,
}: NewCampaignWizardProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [campaignName, setCampaignName] = useState("");
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [phoneColumn, setPhoneColumn] = useState<string>("");
  const [variableMappings, setVariableMappings] = useState<Record<string, string>>({});
  
  // Steps configuration
  const [sequenceSteps, setSequenceSteps] = useState<StepConfig[]>([
    {
      delayHours: 0,
      messageTemplate: "",
    },
  ]);

  // Detected message columns from uploaded file
  const [detectedMessageColumns, setDetectedMessageColumns] = useState<string[]>([]);

  // Anti-ban configuration
  const [minDelaySecs, setMinDelaySecs] = useState(30);
  const [maxDelaySecs, setMaxDelaySecs] = useState(120);
  const [typingPresenceEnabled, setTypingPresenceEnabled] = useState(true);
  const [spintaxEnabled, setSpintaxEnabled] = useState(true);
  const [workingHoursEnabled, setWorkingHoursEnabled] = useState(true);
  const [workingHoursStart, setWorkingHoursStart] = useState("09:00");
  const [workingHoursEnd, setWorkingHoursEnd] = useState("19:00");
  const [timezoneAware, setTimezoneAware] = useState(true);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);

  const [validationResults, setValidationResults] = useState<{
    valid: number;
    invalid: number;
    checking: boolean;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // File Parse Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith(".csv")) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            const data = results.data as ParsedRow[];
            const cols = Object.keys(data[0]);
            setHeaders(cols);
            setParsedData(data);
            autoDetectPhoneColumn(cols);
          }
        },
        error: (err) => setError(`CSV Parse Error: ${err.message}`),
      });
    } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: "binary" });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws) as ParsedRow[];
          if (data && data.length > 0) {
            const cols = Object.keys(data[0]);
            setHeaders(cols);
            setParsedData(data);
            autoDetectPhoneColumn(cols);
          }
        } catch (err: any) {
          setError(`Excel Parse Error: ${err.message}`);
        }
      };
      reader.readAsBinaryString(file);
    } else {
      setError("Please upload a valid .csv, .xlsx, or .xls file");
    }
  };

  const autoDetectPhoneColumn = (cols: string[]) => {
    const phoneCol = cols.find((c) =>
      /phone|mobile|number|whatsapp|contact/i.test(c)
    );
    if (phoneCol) {
      setPhoneColumn(phoneCol);
    } else if (cols.length > 0) {
      setPhoneColumn(cols[0]);
    }

    // Auto-detect message columns from the uploaded file
    // Flexible regex to handle variations: "4th Follow Up", "4th Follow-Up", "4th Followup", "Follow Up 4", etc.
    const isMessageColumn = (colName: string): { match: boolean; stepNumber: number } => {
      const lower = colName.toLowerCase().trim();
      if (/^(message|initial\s*message|step\s*1|message\s*1|initial)$/i.test(lower))
        return { match: true, stepNumber: 1 };
      if (/^(1st\s*follow[\s-]*(?:up)?|follow[\s-]*(?:up)?\s*1|step\s*2|message\s*2)$/i.test(lower))
        return { match: true, stepNumber: 2 };
      if (/^(2nd\s*follow[\s-]*(?:up)?|follow[\s-]*(?:up)?\s*2|step\s*3|message\s*3)$/i.test(lower))
        return { match: true, stepNumber: 3 };
      if (/^(3rd\s*follow[\s-]*(?:up)?|follow[\s-]*(?:up)?\s*3|step\s*4|message\s*4)$/i.test(lower))
        return { match: true, stepNumber: 4 };
      if (/^(4th\s*follow[\s-]*(?:up)?|follow[\s-]*(?:up)?\s*4|step\s*5|message\s*5)$/i.test(lower))
        return { match: true, stepNumber: 5 };
      if (/^(5th\s*follow[\s-]*(?:up)?|follow[\s-]*(?:up)?\s*5|step\s*6|message\s*6)$/i.test(lower))
        return { match: true, stepNumber: 6 };
      return { match: false, stepNumber: 0 };
    };

    // Collect non-phone columns as potential message columns
    const phoneLower = (phoneCol || cols[0] || "").toLowerCase();
    const messageCandidates = cols.filter((c) => c.toLowerCase() !== phoneLower);
    setDetectedMessageColumns(messageCandidates);

    // Auto-detect and create steps from detected message columns
    const detectedSteps: { col: string; stepNumber: number }[] = [];
    cols.forEach((col) => {
      const result = isMessageColumn(col);
      if (result.match) detectedSteps.push({ col, stepNumber: result.stepNumber });
    });

    if (detectedSteps.length > 0) {
      detectedSteps.sort((a, b) => a.stepNumber - b.stepNumber);
      const newSteps: StepConfig[] = detectedSteps.map((item, idx) => ({
        delayHours: idx === 0 ? 0 : 24,
        messageTemplate: "", // Will be resolved from sourceColumn at send time
        sourceColumn: item.col,
      }));
      setSequenceSteps(newSteps);
    }
  };

  const addSequenceStep = () => {
    setSequenceSteps([
      ...sequenceSteps,
      {
        delayHours: 24,
        messageTemplate: "",
        sourceColumn: undefined,
      },
    ]);
  };

  const removeSequenceStep = (index: number) => {
    if (sequenceSteps.length <= 1) return;
    setSequenceSteps(sequenceSteps.filter((_, i) => i !== index));
  };

  const handleLaunch = async () => {
    if (!campaignName.trim()) {
      setError("Please enter a campaign name");
      return;
    }
    if (!phoneColumn) {
      setError("Please select the Phone Number column");
      return;
    }
    if (parsedData.length === 0) {
      setError("No recipients loaded from file");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Map parsed data into recipient payloads
      const recipients = parsedData.map((row) => {
        const phone = row[phoneColumn]?.toString() || "";
        const customVariables: Record<string, string> = {};
        headers.forEach((h) => {
          if (h !== phoneColumn && row[h]) {
            customVariables[h] = row[h].toString();
          }
        });
        return { phoneNumber: phone, customVariables };
      });

      const payload: any = {
        name: campaignName.trim(),
        antiBanConfig: {
          minDelaySec: minDelaySecs,
          maxDelaySec: maxDelaySecs,
          typingDurationSec: 3,
          enableSpintax: spintaxEnabled,
          workingHoursStart: workingHoursEnabled ? workingHoursStart : "00:00",
          workingHoursEnd: workingHoursEnabled ? workingHoursEnd : "23:59",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
          maxMessagesPerSessionPerDay: 100,
          warmupEnabled: true,
        },
        steps: sequenceSteps.map((step, idx) => ({
          stepNumber: idx + 1,
          delayAfterPreviousSec: step.delayHours * 3600,
          // If sourceColumn is set, use a placeholder — the backend resolves from custom_variables_json
          templateText: step.sourceColumn
            ? `{${step.sourceColumn}}`
            : (step.messageTemplate || "(No message configured)"),
          mediaUrl: step.mediaUrl || null,
        })),
        recipients,
      };

      const campaign = await apiClient.createCampaign(payload);
      await apiClient.startCampaign(campaign.id);

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create campaign");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                New Bulk Campaign Wizard
              </h2>
              <p className="text-xs text-zinc-500">
                Upload contacts, set follow-up sequences & configure anti-ban protection
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Stepper Bar */}
        <div className="px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-800/30 flex items-center justify-between text-xs">
          <div
            className={`flex items-center gap-2 font-medium ${
              currentStep === 1
                ? "text-emerald-500 font-bold"
                : currentStep > 1
                ? "text-zinc-700 dark:text-zinc-300"
                : "text-zinc-400"
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px]">
              1
            </span>
            <span>1. Upload File</span>
          </div>
          <div className="h-px w-8 bg-zinc-300 dark:bg-zinc-700" />
          <div
            className={`flex items-center gap-2 font-medium ${
              currentStep === 2
                ? "text-emerald-500 font-bold"
                : currentStep > 2
                ? "text-zinc-700 dark:text-zinc-300"
                : "text-zinc-400"
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px]">
              2
            </span>
            <span>2. Map Columns</span>
          </div>
          <div className="h-px w-8 bg-zinc-300 dark:bg-zinc-700" />
          <div
            className={`flex items-center gap-2 font-medium ${
              currentStep === 3
                ? "text-emerald-500 font-bold"
                : currentStep > 3
                ? "text-zinc-700 dark:text-zinc-300"
                : "text-zinc-400"
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px]">
              3
            </span>
            <span>3. Sequence & Anti-Ban</span>
          </div>
          <div className="h-px w-8 bg-zinc-300 dark:bg-zinc-700" />
          <div
            className={`flex items-center gap-2 font-medium ${
              currentStep === 4 ? "text-emerald-500 font-bold" : "text-zinc-400"
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px]">
              4
            </span>
            <span>4. Review & Launch</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Upload File */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g. Q3 Outreach - Product Announcement"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Upload CSV or Excel File (.csv, .xlsx, .xls) *
                </label>
                <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-2xl p-8 text-center bg-zinc-50/50 dark:bg-zinc-800/30 transition-all">
                  <Upload className="w-10 h-10 mx-auto text-zinc-400 mb-3" />
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Drag and drop your contact file here, or click to browse
                  </p>
                  <p className="text-xs text-zinc-500 mb-4">
                    File should contain columns like Phone Number, Name, Company, etc.
                  </p>
                  <input
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="csv-file-input"
                  />
                  <label
                    htmlFor="csv-file-input"
                    className="cursor-pointer px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium text-xs shadow-sm transition-all inline-block"
                  >
                    Select File
                  </label>
                </div>
              </div>

              {parsedData.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      ✓ Successfully loaded {parsedData.length} recipients ({headers.length} columns)
                    </span>
                  </div>

                  {/* Preview Table */}
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-x-auto max-h-48">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        <tr>
                          {headers.map((h, i) => (
                            <th key={i} className="p-2.5 font-semibold border-b">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedData.slice(0, 5).map((row, rIdx) => (
                          <tr
                            key={rIdx}
                            className="border-b border-zinc-100 dark:border-zinc-800/50"
                          >
                            {headers.map((h, cIdx) => (
                              <td key={cIdx} className="p-2.5 truncate max-w-[150px]">
                                {row[h] || "-"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Map Columns */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Select Phone Number Column *
                </label>
                <select
                  value={phoneColumn}
                  onChange={(e) => setPhoneColumn(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Select Phone Column --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                  Detected Template Variables
                </h3>
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <p className="text-xs text-zinc-500">
                    You can use these placeholders in your message templates. They will be auto-replaced for each contact:
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {headers
                      .filter((h) => h !== phoneColumn)
                      .map((h) => (
                        <span
                          key={h}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-medium border border-emerald-500/20"
                        >
                          {`{${h}}`}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Sequence & Anti-Ban Config */}
          {currentStep === 3 && (
            <div className="space-y-6">
              {/* Message Follow-up Sequence */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-500" />
                    Message Follow-up Sequence
                  </h3>
                  <button
                    onClick={addSequenceStep}
                    className="px-3 py-1.5 bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Follow-up Step
                  </button>
                </div>

                {sequenceSteps.map((step, idx) => {
                  const sampleText = step.sourceColumn && parsedData[0]?.[step.sourceColumn];
                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {idx === 0 ? "Step 1: Initial Message" : `Step ${idx + 1}: Follow-up #${idx}`}
                        </span>
                        {idx > 0 && (
                          <button
                            onClick={() => removeSequenceStep(idx)}
                            className="text-rose-500 hover:text-rose-600 p-1 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {idx > 0 && (
                        <div className="flex items-center gap-3">
                          <label className="text-xs text-zinc-500">
                            Send after delay:
                          </label>
                          <input
                            type="number"
                            value={step.delayHours}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const newSteps = [...sequenceSteps];
                              newSteps[idx].delayHours = val;
                              setSequenceSteps(newSteps);
                            }}
                            className="w-20 px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-center"
                            min={1}
                          />
                          <span className="text-xs text-zinc-500">hours after previous step</span>
                        </div>
                      )}

                      {/* Message Source: Dropdown to choose Excel column or custom message */}
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                          Message Source
                        </label>
                        <select
                          value={step.sourceColumn || "__custom__"}
                          onChange={(e) => {
                            const newSteps = [...sequenceSteps];
                            if (e.target.value === "__custom__") {
                              newSteps[idx].sourceColumn = undefined;
                              newSteps[idx].messageTemplate = "";
                            } else {
                              newSteps[idx].sourceColumn = e.target.value;
                              newSteps[idx].messageTemplate = "";
                            }
                            setSequenceSteps(newSteps);
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="__custom__">✏️ Write custom message</option>
                          {detectedMessageColumns.length > 0 && (
                            <optgroup label="📄 Use column from uploaded file">
                              {detectedMessageColumns.map((col) => (
                                <option key={col} value={col}>
                                  📊 Column: "{col}"
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>

                        {/* Show preview when a column is selected */}
                        {step.sourceColumn && (
                          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                Using per-recipient messages from column: <code className="font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded">{step.sourceColumn}</code>
                              </span>
                            </div>
                            {sampleText && (
                              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                                <p className="text-[10px] font-medium text-zinc-400 mb-1">Preview (Row 1):</p>
                                <p className="text-xs text-zinc-700 dark:text-zinc-300 italic">
                                  "{sampleText}"
                                </p>
                              </div>
                            )}
                            <p className="text-[10px] text-zinc-400">
                              Each recipient will receive their own unique message from this column.
                            </p>
                          </div>
                        )}

                        {/* Show textarea when custom message mode */}
                        {!step.sourceColumn && (
                          <div>
                            <textarea
                              value={step.messageTemplate}
                              onChange={(e) => {
                                const newSteps = [...sequenceSteps];
                                newSteps[idx].messageTemplate = e.target.value;
                                setSequenceSteps(newSteps);
                              }}
                              rows={3}
                              placeholder="Write your message template here... Use {Name} variables and {Hi|Hello} Spintax"
                              className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            <p className="text-[11px] text-zinc-400 mt-1">
                              Tip: Use <code className="text-emerald-500 font-mono">{"{{Name}}"}</code> for variables, <code className="text-emerald-500 font-mono">{"{{Hi|Hello}}"}</code> for Spintax.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Anti-Ban Safeguards Panel */}
              <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 space-y-4">
                <h3 className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" />
                  Anti-Ban & Safety Safeguards
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-zinc-600 dark:text-zinc-400 mb-1">
                      Delay Between Messages (Seconds)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={minDelaySecs}
                        onChange={(e) => setMinDelaySecs(parseInt(e.target.value) || 10)}
                        className="w-16 p-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-center"
                      />
                      <span>to</span>
                      <input
                        type="number"
                        value={maxDelaySecs}
                        onChange={(e) => setMaxDelaySecs(parseInt(e.target.value) || 60)}
                        className="w-16 p-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-center"
                      />
                      <span className="text-zinc-400">secs jitter</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-zinc-600 dark:text-zinc-400 mb-1">
                      Working Hours Schedule
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={workingHoursStart}
                        onChange={(e) => setWorkingHoursStart(e.target.value)}
                        className="p-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-center"
                      />
                      <span>to</span>
                      <input
                        type="time"
                        value={workingHoursEnd}
                        onChange={(e) => setWorkingHoursEnd(e.target.value)}
                        className="p-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-center"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={typingPresenceEnabled}
                      onChange={(e) => setTypingPresenceEnabled(e.target.checked)}
                      className="rounded border-zinc-300 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>Simulate Typing Indicator ("composing")</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={spintaxEnabled}
                      onChange={(e) => setSpintaxEnabled(e.target.checked)}
                      className="rounded border-zinc-300 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>Enable Spintax Variations</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={timezoneAware}
                      onChange={(e) => setTimezoneAware(e.target.checked)}
                      className="rounded border-zinc-300 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>Timezone-Aware Scheduling</span>
                  </label>
                </div>
              </div>

              {/* Sessions Allocation */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-500" />
                  Select Active WhatsApp Sessions for Load Balancing
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {sessions
                    .filter((s) => s.status === "READY")
                    .map((s) => {
                      const isSelected = selectedSessionIds.includes(s.id);
                      return (
                        <div
                          key={s.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedSessionIds(selectedSessionIds.filter((id) => id !== s.id));
                            } else {
                              setSelectedSessionIds([...selectedSessionIds, s.id]);
                            }
                          }}
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between text-xs ${
                            isSelected
                              ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                              : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300"
                          }`}
                        >
                          <div>
                            <p className="font-medium">{s.name}</p>
                            <p className="text-[10px] text-zinc-400">{s.phoneNumber || s.engine}</p>
                          </div>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Review & Launch */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 space-y-3">
                <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-500" />
                  Campaign Summary
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-zinc-400 block">Campaign Name</span>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">
                      {campaignName}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block">Total Recipients</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {parsedData.length} leads
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block">Follow-up Steps</span>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">
                      {sequenceSteps.length} steps
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block">Assigned Sessions</span>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">
                      {selectedSessionIds.length > 0 ? `${selectedSessionIds.length} sessions` : "All active sessions"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sample Message Preview */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Sample Message Rendering Preview
                </h4>
                <div className="p-4 rounded-xl bg-zinc-900 text-zinc-100 font-mono text-xs space-y-2 border border-zinc-800">
                  <p className="text-emerald-400 font-bold text-[10px]">
                    [Sample Lead #1 Preview]
                  </p>
                  <p>
                    {sequenceSteps[0]?.messageTemplate.replace(/\{(\w+)\}/g, (_, key) => {
                      const sampleRow = parsedData[0];
                      return sampleRow?.[key] || sampleRow?.[phoneColumn] || `{${key}}`;
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-between">
          <button
            onClick={() => {
              if (currentStep > 1) setCurrentStep((currentStep - 1) as any);
            }}
            disabled={currentStep === 1 || loading}
            className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
          >
            Back
          </button>

          {currentStep < 4 ? (
            <button
              onClick={() => {
                if (currentStep === 1 && (!campaignName.trim() || parsedData.length === 0)) {
                  setError("Please enter a campaign name and upload a contact file");
                  return;
                }
                setError(null);
                setCurrentStep((currentStep + 1) as any);
              }}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-medium shadow-sm transition-all"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleLaunch}
              disabled={loading}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-white" />
              )}
              <span>Launch Campaign</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
