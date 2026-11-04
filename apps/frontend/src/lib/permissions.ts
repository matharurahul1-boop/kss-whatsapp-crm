import { UserRole } from "./types";

export const MANAGER_SCREEN_PATHS = ["/settings", "/api-integration", "/logs", "/wallet"];
export function canAccessManagerScreens(role?: UserRole): boolean {
  return role === "MANAGER";
}

export const USERS_PATH = "/users";
export function canAccessUsersPage(role?: UserRole): boolean {
  return role === "ADMIN" || role === "MANAGER";
}
