import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OTP - One Time Password",
  description:
    "Create encrypted, self-destructing messages that can only be opened once.",
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-slate-950 text-slate-100">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
