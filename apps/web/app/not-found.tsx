import { BoxLogo } from "@/components/box-logo";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center text-center">
      <div className="space-y-6">
        <BoxLogo className="text-7xl">404</BoxLogo>
        <p>
          <a href="/" className="link font-bold lowercase">
            retour au budget
          </a>
        </p>
      </div>
    </main>
  );
}
