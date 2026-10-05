"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { BoxLogo } from "@/components/box-logo";
import { useAuth } from "@/lib/auth";

export default function Home() {
  const { status } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (status === "signedIn") router.replace("/dashboard/");
    else if (status === "signedOut") router.replace("/login/");
  }, [status, router]);
  return (
    <div className="grid min-h-dvh place-items-center">
      <BoxLogo className="animate-pulse text-5xl" />
    </div>
  );
}
