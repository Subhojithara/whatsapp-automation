"use client";

import React from "react";
import { Check } from "lucide-react";

export interface StepItem {
  id: number;
  label: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface StepLayerProps {
  steps: StepItem[];
  currentStep: number;
  onStepClick?: (stepId: number) => void;
  className?: string;
}

export function StepLayer({
  steps,
  currentStep,
  onStepClick,
  className = "",
}: StepLayerProps) {
  const total = steps.length;
  /* step centres sit at (i + 0.5) / N of the row; the connectors span
     from the first centre to the last, and the progress line fills the
     same span up to the active step — so line and circles can never
     disagree about where a step is */
  const firstCenter = 100 / (2 * total);
  const spanPct = 100 - firstCenter * 2;
  const progressPct =
    total > 1
      ? ((Math.min(currentStep, total) - 1) / (total - 1)) * spanPct
      : 0;

  return (
    <div className={`w-full ${className}`}>
      <div className="relative">
        {/* base connector + emerald progress fill */}
        <div
          className="absolute top-[18px] -translate-y-1/2 h-0.5 bg-zinc-200 dark:bg-white/10"
          style={{ left: `${firstCenter}%`, right: `${firstCenter}%` }}
        />
        <div
          className="absolute top-[18px] -translate-y-1/2 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 ease-out"
          style={{ left: `${firstCenter}%`, width: `${progressPct}%` }}
        />

        <div className="relative flex items-start justify-between">
          {steps.map((step, index) => {
            const isCompleted = step.id < currentStep;
            const isActive = step.id === currentStep;
            const Icon = step.icon;

            return (
              <div
                key={step.id}
                onClick={() => {
                  if (isCompleted && onStepClick) {
                    onStepClick(step.id);
                  }
                }}
                className={`flex flex-col items-center relative select-none ${
                  isCompleted ? "cursor-pointer group" : ""
                }`}
                style={{ width: `${100 / total}%` }}
              >
                {/* Step circle */}
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-200 ${
                    isCompleted
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30 group-hover:scale-105 group-hover:shadow-lg"
                      : isActive
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 ring-4 ring-emerald-500/20 scale-110"
                      : "bg-zinc-100 dark:bg-[#1a1b20] text-zinc-400 dark:text-zinc-500 ring-1 ring-zinc-200/80 dark:ring-white/10"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4 stroke-[3]" />
                  ) : Icon ? (
                    <Icon className="w-4 h-4" />
                  ) : (
                    step.id
                  )}
                </div>

                {/* Step Label */}
                <div className="mt-2.5 text-center px-1">
                  <p
                    className={`text-[11px] sm:text-xs font-semibold tracking-tight leading-tight transition-colors ${
                      isActive
                        ? "text-emerald-600 dark:text-emerald-400 font-bold"
                        : isCompleted
                        ? "text-zinc-800 dark:text-zinc-200"
                        : "text-zinc-400 dark:text-zinc-500"
                    }`}
                  >
                    {step.label}
                  </p>
                  {step.subtitle && (
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 hidden sm:block mt-0.5 leading-tight">
                      {step.subtitle}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
