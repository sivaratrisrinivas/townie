import "./globals.css";
import { Bebas_Neue, Permanent_Marker } from "next/font/google";
// Two faces, each with a job: Bebas for stage-sign headings, Marker for the swapped word (the aha).
const sign = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--f-sign", display: "swap" });
const marker = Permanent_Marker({ weight: "400", subsets: ["latin"], variable: "--f-marker", display: "swap" });
export const metadata = { title: "Townie. Talk like you grew up here.", description: "Swap one reference in your joke for the local one, using Qloo taste data." };
export const viewport = { themeColor: "#0b0908" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en" className={`${sign.variable} ${marker.variable}`}><body>{children}</body></html>);
}
