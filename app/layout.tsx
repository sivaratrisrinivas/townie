import "./globals.css";
import { Inter_Tight } from "next/font/google";
// One family, weights do the hierarchy.
const sans = Inter_Tight({ subsets: ["latin"], variable: "--f-sans", display: "swap" });
export const metadata = { title: "Townie. Talk like you grew up here.", description: "Swap one reference in your joke for the local one, using Qloo taste data." };
export const viewport = { themeColor: "#ECE7DD" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en" className={sans.variable}><body>{children}</body></html>);
}
