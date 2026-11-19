import type { Metadata } from "next";
import { Michroma, Plus_Jakarta_Sans } from "next/font/google";
import { ConnectionBanner } from "./_components/connection-banner";
import { ToastProvider } from "./_components/toaster";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

// Wordmark only ("STOW"); everything else is Jakarta.
const michroma = Michroma({
  variable: "--font-michroma",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stow",
  description: "Save for goals and pay yourself a budget on schedule. The app refuses to break your plan. Dollars, crypto and tokenized stocks.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-scroll-behavior: Next turns smooth scrolling off while it changes pages, so
    // only in-page links (#how, #faq…) glide; new pages still open at the top at once.
    <html lang="en" data-scroll-behavior="smooth" className={`${jakarta.variable} ${michroma.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ToastProvider>
          <ConnectionBanner />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
