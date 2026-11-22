/**
 * Role-based access control for Better Auth's admin plugin.
 * Three roles: FARMER, AGRICULTURE_OFFICER, SUPER_ADMIN (see src/shared ROLES).
 * Which local level an officer may act in is enforced separately in src/scope.ts.
 *
 * Keep this file dependency-free (only better-auth imports) so the client apps
 * can copy it verbatim for `adminClient({ ac, roles })`.
 */
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

export const statement = {
  ...defaultStatements,
  parcel: ["read", "create", "verify"],
  declaration: ["read", "create"],
  subsidy: ["read", "plan", "deliver"],
  registry: ["import"],
  advisory: ["publish"],
  report: ["read"],
  farmerAccount: ["issue-password"],
} as const;

export const ac = createAccessControl(statement);

export const FARMER = ac.newRole({
  parcel: ["read", "create"],
  declaration: ["read", "create"],
  subsidy: ["read"],
});

/** Agriculture section of a local level: manages its farmers, parcels, subsidy and advisories. */
export const AGRICULTURE_OFFICER = ac.newRole({
  parcel: ["read", "create", "verify"],
  declaration: ["read", "create"],
  subsidy: ["read", "plan", "deliver"],
  registry: ["import"],
  advisory: ["publish"],
  report: ["read"],
  farmerAccount: ["issue-password"],
});

/** Everything, everywhere, plus Better Auth user/session administration. */
export const SUPER_ADMIN = ac.newRole({
  parcel: ["read", "create", "verify"],
  declaration: ["read", "create"],
  subsidy: ["read", "plan", "deliver"],
  registry: ["import"],
  advisory: ["publish"],
  report: ["read"],
  farmerAccount: ["issue-password"],
  ...adminAc.statements,
});

export const roles = { FARMER, AGRICULTURE_OFFICER, SUPER_ADMIN };
