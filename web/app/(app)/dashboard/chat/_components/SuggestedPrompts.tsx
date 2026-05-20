import { Shield, Database, Server, Network, Key, HardDrive } from "lucide-react";

const PROMPTS = [
  { text: "Which EC2 instances are running?", icon: Server },
  { text: "Show me all public S3 buckets", icon: HardDrive },
  { text: "What security groups allow inbound 0.0.0.0/0?", icon: Shield },
  { text: "How many resources are in us-east-1?", icon: Network },
  { text: "List all IAM roles in my account", icon: Key },
  { text: "Which RDS instances are not encrypted?", icon: Database },
];

interface Props {
  onSelect: (prompt: string) => void;
}

export function SuggestedPrompts({ onSelect }: Props) {
  return (
    <div className="max-w-3xl mx-auto">
      <p className="text-xs text-gray-600 mb-3 text-center uppercase tracking-wider font-medium">
        Try asking
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {PROMPTS.map(({ text, icon: Icon }) => (
          <button
            key={text}
            onClick={() => onSelect(text)}
            className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.07] text-left text-sm text-gray-400 hover:text-white hover:bg-white/[0.06] hover:border-brand-500/30 transition-all duration-200"
          >
            <div className="w-7 h-7 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center shrink-0 group-hover:bg-brand-500/20 transition-colors">
              <Icon className="w-3.5 h-3.5 text-brand-400" />
            </div>
            <span className="leading-snug">{text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
