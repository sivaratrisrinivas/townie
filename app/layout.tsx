import "./globals.css";
export const metadata = { title: "Townie. Talk like you grew up here.", description: "Swap one reference in your joke for the local one, using Qloo taste data." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
