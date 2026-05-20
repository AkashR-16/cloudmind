import { Message } from "@/features/chat/types";
import { cn } from "@/lib/utils";
import { Cloud, User } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Props {
  message: Message;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3 py-2 animate-slide-up", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
          isUser
            ? "bg-gradient-to-br from-brand-500 to-violet-500 shadow-lg shadow-brand-500/25"
            : "bg-surface-card border border-white/[0.08]"
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Cloud className="w-4 h-4 text-brand-400" />
        )}
      </div>

      <div
        className={cn(
          "max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed",
          isUser
            ? "bg-gradient-to-br from-brand-500 to-brand-600 text-white rounded-tr-sm shadow-lg shadow-brand-500/20"
            : "bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] text-gray-100 rounded-tl-sm"
        )}
      >
        {isUser ? (
          <span>{message.content}</span>
        ) : (
          <div
            className={cn(
              "prose prose-invert prose-sm max-w-none",
              "prose-p:my-1 prose-li:my-0.5 prose-ul:my-1.5",
              "prose-strong:text-white prose-code:text-brand-400 prose-code:bg-black/20 prose-code:px-1 prose-code:rounded",
              message.isStreaming && "streaming-cursor"
            )}
          >
            <ReactMarkdown>{message.content || " "}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
