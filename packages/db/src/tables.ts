import type { Enums, Tables } from "./database.types";

export type ProfileRow = Tables<"profiles">;
export type ProjectRow = Tables<"projects">;
export type DeadlineRow = Tables<"deadlines">;
export type GroupRequestRow = Tables<"group_requests">;
export type GroupRow = Tables<"groups">;
export type MessageRow = Tables<"messages">;
export type RoomReportRow = Tables<"room_reports">;
export type MoulinetteReportRow = Tables<"moulinette_reports">;
export type DefenseSwapRow = Tables<"defense_swaps">;
export type AssistantStatusRow = Tables<"assistants_status">;

export type Promo = Enums<"promo">;
export type UserRole = Enums<"user_role">;
