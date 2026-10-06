import type { Metadata } from "next";
import { BoxLogo } from "@/components/box-logo";

export const metadata: Metadata = { title: "Page introuvable", robots: { index: false } };

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="space-y-6">
        <BoxLogo className="text-7xl">404</BoxLogo>
        <h1 className="display text-3xl">page introuvable.</h1>
        <p>
          <a href="/" className="link inline-block py-2 font-bold lowercase">
            → calculer mon budget
          </a>
        </p>
      </div>
    </main>
  );
}
