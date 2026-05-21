"use client";

import { Shield, Database, Server, Network, Key, HardDrive, Lock, Boxes, Cpu, Activity } from "lucide-react";

type Question = { text: string; icon: typeof Server };
type Group = { label: string; questions: Question[] };

const GROUPS: Group[] = [
  {
    label: "Compute",
    questions: [
      { text: "Which EC2 instances are running?", icon: Server },
      { text: "List all Lambda functions and their runtimes", icon: Cpu },
      { text: "Which EC2 instances are stopped or terminated?", icon: Activity },
    ],
  },
  {
    label: "Storage & data",
    questions: [
      { text: "Show me all public S3 buckets", icon: HardDrive },
      { text: "Which S3 buckets have versioning enabled?", icon: HardDrive },
      { text: "Which RDS instances are not encrypted?", icon: Database },
    ],
  },
  {
    label: "Network",
    questions: [
      { text: "List all VPCs and their subnets", icon: Network },
      { text: "Show me all load balancers", icon: Boxes },
      { text: "How many resources are in us-east-1?", icon: Network },
    ],
  },
  {
    label: "Security & identity",
    questions: [
      { text: "What security groups allow inbound 0.0.0.0/0?", icon: Shield },
      { text: "List all IAM roles in my account", icon: Key },
      { text: "Which resources have unrestricted SSH access?", icon: Lock },
    ],
  },
];

interface Props {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

export function QuestionsSidebar({ onSelect, disabled }: Props) {
  return (
    <aside className="hidden lg:flex flex-col w-72 shrink-0 border-r border-surface-border/60 bg-surface-card/20 overflow-y-auto">
      <div className="px-4 py-4 border-b border-surface-border/40 sticky top-0 bg-surface-card/40 backdrop-blur-xl z-10">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">
          Try asking
        </p>
        <p className="text-xs text-gray-600 mt-1">Click a question to send it.</p>
      </div>

      <div className="px-3 py-3 space-y-5">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-600 px-2 mb-1.5">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.questions.map(({ text, icon: Icon }) => (
                <button
                  key={text}
                  onClick={() => onSelect(text)}
                  disabled={disabled}
                  className="group w-full flex items-start gap-2.5 px-2 py-2 rounded-lg text-left text-xs text-gray-400 hover:text-white hover:bg-white/[0.04] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Icon className="w-3.5 h-3.5 mt-0.5 text-brand-400/70 shrink-0 group-hover:text-brand-300" />
                  <span className="leading-snug">{text}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
