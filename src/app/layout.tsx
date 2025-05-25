import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Diff Digest",
  description: "Website that turns git diffs into live, dual-tone release notes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-900 text-white`}
      >
        {children}
        <footer className="w-full border-t border-zinc-700 bg-zinc-800 mt-12 py-4 px-4 flex flex-col sm:flex-row items-center justify-between text-sm text-zinc-300">
          <div className="flex gap-6 mb-2 sm:mb-0">
            <a href="#" className="hover:underline">Terms & Conditions</a>
            <a href="#" className="hover:underline">Privacy Policy</a>
          </div>
          <div className="text-right w-full sm:w-auto">
            © Diff Digest 2025. All Rights Reserved.
          </div>
        </footer>
      </body>
    </html>
  );
}
