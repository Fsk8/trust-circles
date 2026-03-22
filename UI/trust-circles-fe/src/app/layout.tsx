import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from './providers';
import './globals.css';
import '@rainbow-me/rainbowkit/styles.css'; // Asegúrate de tener esto aquí

const inter = Inter({ subsets: ["latin"] });

// 🚀 CONFIGURACIÓN DE METADATA PARA LA HACKATHON
export const metadata: Metadata = {
  title: "Trust Circles | p2p insurance protocol",
  description: "Círculos de confianza descentralizados sobre Avalanche Fuji. Gestiona tu reputación Web3.",
  openGraph: {
    title: "Trust Circles",
    description: "Crea tu círculo de confianza en Web3",
    siteName: "Trust Circles",
    locale: "es_BO",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Trust Circles",
    description: "Decentralized Trust on Avalanche",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} bg-[#030303] text-slate-200 antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}