import { Message } from "@/features/chat/types";
import { MessageBubble } from "./MessageBubble";

interface Props {
  messages: Message[];
}

export function MessageList({ messages }: Props) {
  return (
    <>
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
    </>
  );
}
