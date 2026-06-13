import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Argus — LLM Observability",
  description: "Real-time tracing for Anthropic API calls",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen font-mono antialiased">
        <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <span className="text-purple-400 font-bold tracking-tight">Argus</span>
            <span className="text-gray-600 text-sm">LLM Observability</span>
          </a>
          <div className="flex items-center gap-2 text-xs text-green-400">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            Live
          </div>
        </nav>
        <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
