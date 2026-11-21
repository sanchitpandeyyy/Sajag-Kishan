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

export const AGRICULTURE_OFFICER = ac.newRole({
  parcel: ["read", "create", "verify"],
  declaration: ["read", "create"],
  subsidy: ["read", "plan", "deliver"],
  registry: ["import"],
  advisory: ["publish"],
  report: ["read"],
  farmerAccount: ["issue-password"],
});

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
