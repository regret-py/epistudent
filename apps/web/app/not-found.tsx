import Link from "next/link";
import { BoxLogo } from "@/components/box-logo";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center text-center">
      <div className="space-y-4">
        <BoxLogo className="text-6xl">404</BoxLogo>
        <p>
          <Link href="/" className="link font-bold lowercase">
            epistudent.fr
          </Link>
        </p>
      </div>
    </main>
  );
}
