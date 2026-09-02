import type { AuthenticatedActor, CompanyRole } from "@/lib/auth/session";

/**
 * ROLE-BASED ACCESS CONTROL.
 *
 * Authorization requires TWO independent checks, and both must pass:
 *
 *   1. RBAC          — does this role hold this permission at all?
 *   2. Resource scope — is this specific resource within the actor's reach?
 *
 * Neither is sufficient alone. A `procurement` role legitimately holds
 * `booking:create`, but only for its OWN company. A `viewer` is legitimately
 * inside a company, but must not cancel its rentals. Systems that check only
 * one of these are exactly where IDOR and privilege-escalation bugs live.
 */

export type Permission =
  // Bookings
  | "booking:read"
  | "booking:create"
  | "booking:cancel"
  | "booking:extend"
  | "booking:approve"
  // Quotes
  | "quote:read"
  | "quote:create"
  | "quote:accept"
  // Finance
  | "invoice:read"
  | "payment:read"
  | "payment:manage"
  | "credit:manage"
  // Company administration
  | "company:read"
  | "company:update"
  | "member:read"
  | "member:manage"
  | "site:read"
  | "site:manage"
  // Documents
  | "document:read"
  // Platform operations (never granted by a company role)
  | "admin:access"
  | "admin:equipment"
  | "admin:inventory"
  | "admin:pricing"
  | "admin:booking"
  | "admin:customer"
  | "admin:finance"
  | "admin:refund"
  | "admin:content"
  | "admin:user"
  | "admin:settings"
  | "admin:audit";

const ROLE_PERMISSIONS: Record<CompanyRole, readonly Permission[]> = {
  owner: [
    "booking:read", "booking:create", "booking:cancel", "booking:extend", "booking:approve",
    "quote:read", "quote:create", "quote:accept",
    "invoice:read", "payment:read", "payment:manage", "credit:manage",
    "company:read", "company:update",
    "member:read", "member:manage",
    "site:read", "site:manage",
    "document:read",
  ],
  admin: [
    "booking:read", "booking:create", "booking:cancel", "booking:extend", "booking:approve",
    "quote:read", "quote:create", "quote:accept",
    "invoice:read", "payment:read",
    "company:read", "company:update",
    "member:read", "member:manage",
    "site:read", "site:manage",
    "document:read",
  ],
  // Raises requests and manages sites, but cannot approve its own spend —
  // separation of duties is the entire point of the procurement role.
  procurement: [
    "booking:read", "booking:create", "booking:extend",
    "quote:read", "quote:create",
    "company:read",
    "member:read",
    "site:read", "site:manage",
    "document:read",
  ],
  // Sees the money, does not commit the company to new rentals.
  finance: [
    "booking:read",
    "quote:read",
    "invoice:read", "payment:read", "payment:manage",
    "company:read",
    "member:read",
    "site:read",
    "document:read",
  ],
  project_manager: [
    "booking:read", "booking:create", "booking:extend", "booking:approve",
    "quote:read", "quote:create",
    "company:read",
    "member:read",
    "site:read", "site:manage",
    "document:read",
  ],
  viewer: ["booking:read", "quote:read", "company:read", "site:read", "document:read"],
};

/**
 * Platform admin permissions.
 *
 * A SEPARATE AXIS from company roles. `isPlatformAdmin` lives on the user
 * record and is never derivable from any company-scoped operation, so no
 * company owner can escalate themselves into internal operations.
 */
const PLATFORM_ADMIN_PERMISSIONS: readonly Permission[] = [
  "admin:access", "admin:equipment", "admin:inventory", "admin:pricing",
  "admin:booking", "admin:customer", "admin:finance", "admin:refund",
  "admin:content", "admin:user", "admin:settings", "admin:audit",
  "booking:read", "quote:read", "invoice:read", "payment:read", "document:read",
];

export function roleHasPermission(role: CompanyRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Which role does this actor hold in this company? Null if not a member. */
export function roleInCompany(actor: AuthenticatedActor, companyId: string): CompanyRole | null {
  return actor.memberships.find((m) => m.companyId === companyId)?.role ?? null;
}

/**
 * Can this actor perform this action in this company?
 *
 * Membership is read from the session actor, which was itself loaded from the
 * database — never from a request parameter. Passing a company id the actor is
 * not a member of returns false, which is the tenant-isolation guarantee.
 */
export function canInCompany(
  actor: AuthenticatedActor,
  companyId: string,
  permission: Permission,
): boolean {
  const role = roleInCompany(actor, companyId);
  if (!role) return false;
  return roleHasPermission(role, permission);
}

export function isPlatformAdmin(actor: AuthenticatedActor | null): boolean {
  return actor?.isPlatformAdmin === true;
}

export function canAdmin(actor: AuthenticatedActor | null, permission: Permission): boolean {
  if (!actor?.isPlatformAdmin) return false;
  return PLATFORM_ADMIN_PERMISSIONS.includes(permission);
}

/**
 * Does the actor have ANY access path to this resource?
 *
 * `ownerUserId` covers individual customers; `companyId` covers company
 * members. Both are supplied by the caller from the RESOURCE ROW, not from the
 * request, which is what makes this an ownership check rather than a
 * self-assertion.
 */
export function canAccessResource(
  actor: AuthenticatedActor,
  resource: { ownerUserId?: string | null; companyId?: string | null },
  permission: Permission,
): boolean {
  if (resource.companyId) {
    return canInCompany(actor, resource.companyId, permission);
  }
  return resource.ownerUserId === actor.userId;
}

/**
 * Company ids the actor may read, for use as a mandatory WHERE predicate.
 * Repository functions take this rather than accepting an id from the request.
 */
export function accessibleCompanyIds(actor: AuthenticatedActor): string[] {
  return actor.memberships.map((m) => m.companyId);
}

export class AuthorizationError extends Error {
  readonly code = "forbidden";
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class AuthenticationError extends Error {
  readonly code = "unauthorized";
  constructor(message = "Please sign in to continue.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export { ROLE_PERMISSIONS, PLATFORM_ADMIN_PERMISSIONS };
