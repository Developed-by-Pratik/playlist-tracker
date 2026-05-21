import type { Metadata } from "next";
import "./globals.css";
import SmoothScrollLayout from "@/components/SmoothScrollLayout";
import BackgroundPattern from "@/components/BackgroundPattern";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthGate } from "@/components/Auth/AuthGate";

export const metadata: Metadata = {
  title: "Playlist Tracker",
  description: "Track your learning progress across multiple YouTube playlists. Maintain streaks, visualize growth, and stay consistent.",
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
          <BackgroundPattern />
          <AuthGate>
            <SmoothScrollLayout>
              {children}
            </SmoothScrollLayout>
          </AuthGate>
        </ThemeProvider>
      </body>
    </html>
  );
}
