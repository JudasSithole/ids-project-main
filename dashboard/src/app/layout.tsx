import type { Metadata } from "next";
import "@fontsource-variable/inter/wght.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./globals.css";
import "./presentation.css";
import "./hero.css";
import Navigation from "@/components/Navigation";
export const metadata: Metadata = {
  title: "IDS Research | UJ", description: "Offline replay of recorded CICIDS2017 intrusion detection research."
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a className="skip-link" href="#main">Skip to content</a><Navigation/>{children}</body></html>;
}
