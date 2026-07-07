# Coding Standards

## Project Direction

The current project is a generated frontend prototype. Production work should prioritize maintainability, route structure, typed boundaries, and clear domain modules.

## File Organization

- Keep route files small.
- Put product-specific components in `features/<domain>/components`.
- Put reusable UI primitives in `components/ui`.
- Put validation schemas in `lib/validations` or `features/<domain>/schemas`.
- Put shared types in `types` only when used by multiple features.
- Keep mock data in `fixtures` or story/demo files.

## Component Rules

- Components should have one clear responsibility.
- Avoid large screen components that contain data, layout, tables, modals, and forms together.
- Extract repeated table rows, filters, cards, badges, and modals.
- Prefer existing UI primitives before creating new variants.
- Icon-only buttons require accessible labels.

## TypeScript Rules

- Avoid `any`.
- Model domain statuses as union types.
- Use explicit types for API request and response payloads.
- Validate all external input at API boundaries.
- Do not trust client-side types for authorization or business rules.

## Styling Rules

- Use design tokens and shared variants for buttons, badges, cards, and inputs.
- Avoid hardcoded one-off colors when a shared token exists.
- Keep financial tables dense, readable, and consistent.
- Keep dashboard visuals useful rather than decorative.

## State Rules

- Use URL state for filters, tabs, search, and pagination when it affects page state.
- Use server state for data loaded from the backend.
- Use local state for temporary UI interactions only.
- Do not store authorization decisions only in client state.

## Accessibility Rules

- Every form input needs an associated label.
- Every icon-only action needs an accessible label.
- Modals and drawers must trap focus and close with Escape.
- Keyboard navigation should work for menus, dialogs, tabs, and tables.
- Error messages should be visible and programmatically associated with fields.

## Testing Rules

Minimum MVP coverage:

- Unit tests for business rules and permission helpers.
- API tests for organization scoping and authorization.
- Component tests for critical forms.
- End-to-end smoke test for import to reconciliation workflow.

## Review Checklist

Before merging production code:

- Does the route enforce authentication?
- Does the server enforce authorization?
- Is every database query organization-scoped?
- Are loading, empty, and error states handled?
- Are forms validated?
- Are financial mutations audited?
- Is the UI accessible by keyboard?
- Does the build pass?

