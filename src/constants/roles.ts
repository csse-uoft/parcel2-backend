export enum UserRole {
    ADMIN = "admin",
    ORG_ADMIN = "org_admin",
    USER = "user",
}

export const DEFAULT_USER_ROLES: UserRole[] = [UserRole.USER];

// Convert input roles to valid UserRole array, ensuring at least USER role is present
export function normalizeRoles(roles?: UserRole[] | string[]): UserRole[] {
    if (!roles || roles.length === 0) {
        return [...DEFAULT_USER_ROLES];
    }
    const unique = new Set<UserRole>();
    for (const role of roles as string[]) {
        switch (role) {
        case UserRole.ADMIN:
        case UserRole.ORG_ADMIN:
        case UserRole.USER:
            unique.add(role);
            break;
        default:
            break;
        }
    }
    if (unique.size === 0) {
        DEFAULT_USER_ROLES.forEach(r => unique.add(r));
    }
    if (!unique.has(UserRole.USER)) {
        unique.add(UserRole.USER);
    }
    return Array.from(unique);
}

export function hasRole(roles: string[] | undefined, required: UserRole | UserRole[]): boolean {
    if (!roles || roles.length === 0) return false;
    const normalized = new Set(roles.map(String));
    if (Array.isArray(required)) {
        return required.some(role => normalized.has(role));
    }
    return normalized.has(required);
}
