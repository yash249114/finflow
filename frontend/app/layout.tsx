import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter" 
});

export const metadata: Metadata = {
  title: "FinFlow — Smart Financial Management",
  description: "AI-powered cash flow intelligence for SMBs",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans bg-background text-text-primary antialiased`}>
        <AuthProvider>
          {children}
          <Toaster theme="dark" closeButton />
        </AuthProvider>
      </body>
    </html>
  );
}
