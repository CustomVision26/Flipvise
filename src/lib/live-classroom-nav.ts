import type { LucideIcon } from "lucide-react";
import {
  CalendarClock,
  KeyRound,
  LayoutDashboard,
  Play,
  Settings,
  Swords,
  BarChart3,
} from "lucide-react";
import {
  LIVE_CLASSROOM_HISTORY_PATH,
  LIVE_CLASSROOM_JOIN_PATH,
  LIVE_CLASSROOM_REPORTS_PATH,
  LIVE_CLASSROOM_ROOT_PATH,
  LIVE_CLASSROOM_SCHEDULED_PATH,
  LIVE_CLASSROOM_SETTINGS_PATH,
  LIVE_CLASSROOM_START_PATH,
} from "@/lib/live-classroom-url";

export type LiveClassroomNavItem = {
  title: string;
  path: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
};

export const LIVE_CLASSROOM_NAV: LiveClassroomNavItem[] = [
  {
    title: "Dashboard",
    path: LIVE_CLASSROOM_ROOT_PATH,
    icon: LayoutDashboard,
    isActive: (pathname) => pathname === LIVE_CLASSROOM_ROOT_PATH,
  },
  {
    title: "Start Session",
    path: LIVE_CLASSROOM_START_PATH,
    icon: Play,
    isActive: (pathname) =>
      pathname === LIVE_CLASSROOM_START_PATH ||
      pathname.startsWith(`${LIVE_CLASSROOM_START_PATH}/`),
  },
  {
    title: "Join with code",
    path: LIVE_CLASSROOM_JOIN_PATH,
    icon: KeyRound,
    isActive: (pathname) =>
      pathname === LIVE_CLASSROOM_JOIN_PATH ||
      pathname.startsWith(`${LIVE_CLASSROOM_JOIN_PATH}/`),
  },
  {
    title: "Scheduled Sessions",
    path: LIVE_CLASSROOM_SCHEDULED_PATH,
    icon: CalendarClock,
    isActive: (pathname) =>
      pathname === LIVE_CLASSROOM_SCHEDULED_PATH ||
      pathname.startsWith(`${LIVE_CLASSROOM_SCHEDULED_PATH}/`),
  },
  {
    title: "Battle History",
    path: LIVE_CLASSROOM_HISTORY_PATH,
    icon: Swords,
    isActive: (pathname) =>
      pathname === LIVE_CLASSROOM_HISTORY_PATH ||
      pathname.startsWith(`${LIVE_CLASSROOM_HISTORY_PATH}/`),
  },
  {
    title: "Reports",
    path: LIVE_CLASSROOM_REPORTS_PATH,
    icon: BarChart3,
    isActive: (pathname) =>
      pathname === LIVE_CLASSROOM_REPORTS_PATH ||
      pathname.startsWith(`${LIVE_CLASSROOM_REPORTS_PATH}/`),
  },
  {
    title: "Settings",
    path: LIVE_CLASSROOM_SETTINGS_PATH,
    icon: Settings,
    isActive: (pathname) =>
      pathname === LIVE_CLASSROOM_SETTINGS_PATH ||
      pathname.startsWith(`${LIVE_CLASSROOM_SETTINGS_PATH}/`),
  },
];
