import { CalendarClock, DoorOpen, LayoutDashboard, MoreHorizontal, Users } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/deadlines", key: "deadlines", icon: CalendarClock },
  { href: "/groups", key: "groups", icon: Users },
  { href: "/rooms", key: "rooms", icon: DoorOpen },
  { href: "/more", key: "more", icon: MoreHorizontal },
] as const;

export type NavKey = (typeof NAV_ITEMS)[number]["key"];
export const SECTION_KEYS = NAV_ITEMS.map((i) => i.key).filter((k) => k !== "dashboard");
