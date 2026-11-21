import type { Session } from "./lib/auth";
import type { Role } from "./shared";

export interface AuthUser {
  id: string;
  role: Role;
  mobile: string;
}

export type AppEnv = {
  Variables: {
    user: AuthUser;
    session: Session;
  };
};
