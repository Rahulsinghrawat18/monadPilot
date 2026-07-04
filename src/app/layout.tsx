import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Silkscreen, Press_Start_2P } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const sans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const pixel = Silkscreen({
  variable: "--font-pixel",
  weight: ["400", "700"],
  subsets: ["latin"],
});

const pixelBold = Press_Start_2P({
  variable: "--font-pixel-bold",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ),
  title: "monadPilot — Voice-controlled DeFi on Monad",
  description:
    "Talk to DeFi. Send tokens, swap, explore hackathon projects, and farm the best APYs on Monad — all with one sentence.",
  applicationName: "monadPilot",
  icons: [
    { rel: "icon", url: "/icon.svg", type: "image/svg+xml" },
    { rel: "apple-touch-icon", url: "/icon.svg" },
  ],
  keywords: [
    "Monad",
    "DeFi",
    "AI",
    "Voice",
    "Ambient",
    "Kuru",
    "Swap",
    "Wallet",
    "Copilot",
  ],
  openGraph: {
    title: "monadPilot — Talk to DeFi",
    description: "Voice-controlled DeFi execution on Monad.",
    type: "website",
    images: ["/monad_banner_new.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#06080d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} ${pixel.variable} ${pixelBold.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
