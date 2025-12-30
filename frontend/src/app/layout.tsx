import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner"; // <--- IMPORT

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Cinema Studio",
  description: "AI Cinematic Video Generation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        {/* ADD TOASTER HERE - Dark theme to match your app */}
        <Toaster theme="dark" position="top-center" />
      </body>
    </html>
  );
}
