export type NormalizedUserRole = "admin" | "operator" | "agent" | "user";

type LandingUserInput = {
  username: string;
  role: string; // from token payload.role
  userType: "ADMIN" | "AGENT";
  adminDepartment?: string | null;
  agentDepartment?: string | null;
  /**
   * Phase 4.8b-3: true when the user holds a CRM DB role
   * (crm_manager | crm_operator). Only the login API can populate this
   * (it queries the DB); middleware builds input from the JWT only, so
   * for middleware this stays undefined.
   */
  hasCrmAccess?: boolean;
};

// Only routes that have been verified to exist under app/
const ADMIN_DEPARTMENT_TO_LANDING: Record<string, string> = {
  PRICE: "/operatorsadmins/price-expert",
  INVESTMENT: "/operatorsadmins/Investment",
  PRODUCT: "/operatorsadmins/product-manager",
  SELL: "/operatorsadmins/sell-manager",
};

const OPERATOR_DEPARTMENT_TO_LANDING: Record<string, string> = {
  PRICE: "/operators/price-expert",
  INVESTMENT: "/operators/Investment",
  PRODUCT: "/operators/product-manager",
  SELL: "/operators/sell-manager",
};

// Role-level fallback when no specific department is known
// Must point to an existing route (verified against app/ directory)
const ROLE_FALLBACK_LANDING: Record<NormalizedUserRole, string> = {
  admin: "/admin/panel",
  operator: "/operators/price-expert",
  agent: "/agent/panel",
  user: "/login",
};

export function normalizeRole(role: string): NormalizedUserRole {
  switch (role) {
    case "admin":
      return "admin";
    case "operator":
      return "operator";
    case "agent":
      return "agent";
    case "user":
      return "user";
    default:
      return "user";
  }
}

// Known users mapped to their exact validated landing page.
// Every value in this map has been verified to exist under app/.
const USERNAME_LANDING: Record<string, string> = {
  admin: "/admin/panel",
  price_admin: "/operatorsadmins/price-expert",
  invest_admin: "/operatorsadmins/Investment",
  product_admin: "/operatorsadmins/product-manager",
  sell_admin: "/operatorsadmins/sell-manager",
  operator_price: "/operators/price-expert",
  operator_sell: "/operators/sell-manager",
  operator_product: "/operators/product-manager",
  operator_investment: "/operators/Investment",
  agent1: "/agent/panel",
  user1: "/user/Investment",
  user2: "/user/prepay",
};

function safePrefix(path: string) {
  if (!path.startsWith("/")) return "/" + path;
  return path.endsWith("/") ? path : path + "/";
}

// Set of all valid landing routes for quick validation
const VALID_LANDING_ROUTES = new Set<string>([
  "/admin/panel",
  "/operatorsadmins/price-expert",
  "/operatorsadmins/Investment",
  "/operatorsadmins/product-manager",
  "/operatorsadmins/sell-manager",
  "/operators/price-expert",
  "/operators/Investment",
  "/operators/product-manager",
  "/operators/sell-manager",
  "/agent/panel",
  "/user/Investment",
  "/user/prepay",
  "/login",
]);

/**
 * Returns a verified-valid landing page path for the given user.
 * Guaranteed to never return a non-existent route.
 * If no matching path is found, defaults to the role's fallback or "/login".
 */
export function getLandingPage(user: LandingUserInput): string {
  // 1) Exact username match (fast path)
  //    Known users keep their exact validated landing even when they also
  //    hold a CRM role (e.g. operator_product has crm_operator but must
  //    still land at /operators/product-manager).
  const direct = USERNAME_LANDING[user.username];
  if (direct && VALID_LANDING_ROUTES.has(direct)) return direct;

  // 2) CRM role holders land at the CRM portal.
  //    Checked BEFORE the admin/operator department + role fallbacks below.
  if (user.hasCrmAccess) return "/crm";

  const norm = normalizeRole(user.role);

  // 3) Admin with department
  if (norm === "admin" || user.userType === "ADMIN") {
    const dept = user.adminDepartment ?? null;
    if (dept && ADMIN_DEPARTMENT_TO_LANDING[dept]) {
      const path = ADMIN_DEPARTMENT_TO_LANDING[dept];
      if (VALID_LANDING_ROUTES.has(path)) return path;
    }
    return ROLE_FALLBACK_LANDING.admin;
  }

  // 4) Operator/AGENT with department
  if (norm === "operator" || user.userType === "AGENT") {
    const dept = user.agentDepartment ?? null;
    if (dept && OPERATOR_DEPARTMENT_TO_LANDING[dept]) {
      const path = OPERATOR_DEPARTMENT_TO_LANDING[dept];
      if (VALID_LANDING_ROUTES.has(path)) return path;
    }
    return ROLE_FALLBACK_LANDING.operator;
  }

  // 5) Agent/user fallback
  if (norm === "agent") return ROLE_FALLBACK_LANDING.agent;

  return ROLE_FALLBACK_LANDING.user;
}

/**
 * Returns true if the given pathname is within the user's allowed landing scope.
 */
export function isAllowedPath(user: LandingUserInput, pathname: string): boolean {
  const landing = getLandingPage(user);

  if (pathname === landing) return true;

  const prefix = safePrefix(landing);
  if (pathname.startsWith(prefix)) return true;

  // Allow operator workflow detail pages (shared across all operator departments)
  // Canonical: /operators/workflow/[stepInstanceId]
  // Legacy: /operator/workflow/[stepInstanceId] (redirects to canonical)
  if (
    pathname.startsWith("/operators/workflow/") ||
    pathname.startsWith("/operator/workflow/")
  ) {
    const norm = normalizeRole(user.role);
    if (norm === "operator" || user.userType === "AGENT") return true;
  }

  return false;
}
