import type { Metadata } from "next";
import { QueryProvider } from "@/components/layout/QueryProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "CloudMind — AI Agent for AWS",
  description: "Ask anything about your AWS environment. Context-aware, instant answers.",
  openGraph: {
    title: "CloudMind",
    description: "AI-powered AWS infrastructure Q&A",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-surface text-white antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
