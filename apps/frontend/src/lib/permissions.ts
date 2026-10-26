import { UserRole } from "./types";

export const MANAGER_SCREEN_PATHS = ["/settings", "/api-integration", "/logs", "/wallet"];
export function canAccessManagerScreens(role?: UserRole): boolean {
  return role === "MANAGER";
}
