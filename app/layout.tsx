import "./globals.css";
import { Bebas_Neue, Permanent_Marker, Courier_Prime } from "next/font/google";
const marquee = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--f-marquee", display: "swap" });
const marker = Permanent_Marker({ weight: "400", subsets: ["latin"], variable: "--f-marker", display: "swap" });
const type = Courier_Prime({ weight: ["400", "700"], subsets: ["latin"], variable: "--f-type", display: "swap" });
export const metadata = { title: "Townie. Talk like you grew up here.", description: "Swap one reference in your joke for the local one, using Qloo taste data." };
export const viewport = { themeColor: "#0b0908" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en" className={`${marquee.variable} ${marker.variable} ${type.variable}`}><body>{children}</body></html>);
}
