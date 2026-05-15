import type { Metadata } from "next";
import "./globals.css";
import SmoothScrollLayout from "@/components/SmoothScrollLayout";
import BackgroundPattern from "@/components/BackgroundPattern";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "100xDevs Tracker",
  description: "Track your 100xDevs journey, maintain a daily diary, and generate LinkedIn content to build your community.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <SmoothScrollLayout>
            <BackgroundPattern />
            {children}
          </SmoothScrollLayout>
        </ThemeProvider>
      </body>
    </html>
  );
}
