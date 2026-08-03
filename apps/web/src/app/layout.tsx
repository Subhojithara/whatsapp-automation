import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "Velurix ReachOut Automation",
  description: "Multi-Session WhatsApp Automation Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
