import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "WillTech Pesqueiros", template: "%s | WillTech Pesqueiros" },
  description: "Faça seu pedido direto da sua mesa. Bebidas, petiscos e muito mais.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#061208",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${playfair.variable}`}>
      <body>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "#142b1e",
              color: "#f0e8d8",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              fontFamily: "var(--font-inter)",
              fontSize: "0.9rem",
            },
            success: { iconTheme: { primary: "#f4a522", secondary: "#061208" } },
            error:   { iconTheme: { primary: "#ef4444", secondary: "#061208" } },
          }}
        />
      </body>
    </html>
  );
}
