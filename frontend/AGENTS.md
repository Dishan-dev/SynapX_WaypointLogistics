<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Waypoint Logistics frontend instructions

These instructions apply to every change inside this frontend project.

## Product and design system

- Product: Waypoint Logistics.
- Team: SynapX.
- Build a calm, information-dense operational interface rather than a generic marketing or SaaS dashboard.
- Preserve visual and interaction consistency across Dispatcher, Loader, Driver, and Store Manager experiences.
- Treat the implemented Figma role screens—especially Dispatcher—as the primary evidence for recurring product colors, density, and component treatment. Use the Style Guide for brand intent and reconcile it with patterns that actually recur in the screens.
- Use the existing shadcn/ui components in `components/ui` as the primitive component layer.
- Compose Waypoint-specific patterns from those primitives instead of adding another component library.
- Use Lucide icons through `lucide-react`. Do not introduce a second icon system.

## Theme source of truth

- `app/globals.css` is the source of truth for colors, typography, radii, borders, focus rings, charts, and sidebar colors.
- Use semantic Tailwind classes such as `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `border-border`, `border-input`, `bg-primary`, `bg-accent`, `bg-success-muted`, `bg-warning-muted`, `bg-info-muted`, and `bg-destructive-muted`.
- Do not hardcode Waypoint brand colors in JSX when an existing semantic token represents the same purpose.
- Do not replace the Waypoint theme with shadcn defaults, Slate, Zinc, Indigo, or another preset.
- Light mode is the primary product experience. Maintain dark-mode token compatibility when creating shared components.

### Waypoint palette

| Purpose | Token | Reference color |
| --- | --- | --- |
| Primary actions and active controls | `primary` | `#18385F` |
| Deep brand, navigation, and strong identity | `brand-strong` | `#092C4C` |
| Subtle selected and hover surface | `accent` | `#E8EDF3` |
| Positive and synchronized state | `success` | `#3D7954` |
| Operational warning | `warning` | `#A37A3B` |
| Informational state and focus | `info` | `#1E63C4` |
| Destructive and critical state | `destructive` | `#AD3D3D` |
| Application background | `background` | `#F6F6F3` |
| Cards and elevated surfaces | `card` | `#FFFFFF` |
| Main text | `foreground` | `#171A1F` |
| Secondary text | `muted-foreground` | `#6B7280` |
| Borders and dividers | `border` | `#E5E5E2` |
| Form control borders | `input` | `#AEBCCF` |

Use the matching `*-muted` token for status backgrounds and the base semantic token for icons, borders, or solid treatments. Do not use `accent` as a synonym for success.

## Typography and layout

- Inter Variable is the default interface font and is self-hosted through `@fontsource-variable/inter`.
- Use `font-sans`; do not add remote Google Font imports.
- Use the established type hierarchy instead of arbitrary font sizes.
- Keep desktop operational screens compact and scannable.
- Keep touch targets at least 44px high on Loader, Driver, and mobile Store Manager screens.
- Use the shared base radius of `0.5rem`. Prefer `rounded-md`, `rounded-lg`, and `rounded-xl` over arbitrary radii; these map closely to the 6px, 8px, 12px, and 14px radii recurring in the role screens.
- Prefer thin borders and restrained shadows. Reserve strong elevation for dialogs, sheets, dropdowns, and other overlays.

## Component rules

- Prefer existing shadcn primitives before writing a new primitive.
- Use `Button` for actions rather than styled anchors or raw buttons unless native semantics require otherwise.
- Use `Card` for contained information groups, `Table` for dense operational records, `Sheet` for contextual details, and `Dialog` for short decisions or confirmations.
- Use `Alert` for persistent operational problems and `Sonner` for temporary confirmation messages.
- Use `Badge` for short statuses. Create shared Waypoint variants for delivery, temperature, risk, and synchronization states rather than repeating class strings.
- Construct date pickers from the existing `Calendar`, `Popover`, and `Button` components.
- Build reusable domain components such as `MetricCard`, `StatusPill`, `OrderTable`, `RouteSheet`, and `TemperatureBadge` outside `components/ui`. Keep `components/ui` limited to general-purpose primitives.
- Do not edit generated shadcn primitives solely to style one screen. Prefer variants, wrappers, semantic tokens, or composed domain components.

## Status and feedback conventions

- Success or synchronized: `success` on `success-muted`.
- Warning, delay, or capacity risk: `warning` on `warning-muted`.
- Critical failure or destructive action: `destructive` on `destructive-muted`.
- Informational notices and links: `info` on `info-muted`.
- Primary navigation and actions: `primary`; reserve `brand-strong` for deep navigation and brand surfaces.
- Never communicate status by color alone. Pair color with text and, when helpful, an icon.
- Offline, syncing, conflict, deferred, and failed states must be explicit and accessible.

## Responsive role behavior

- Dispatcher: desktop-first, dense tables, planning controls, maps, sheets, and explanatory allocation states.
- Loader: tablet- and mobile-friendly, large touch targets, stop-sequence clarity, scanning and shortfall reporting.
- Driver: phone-first, safe-when-stopped interactions, offline visibility, proof of delivery, synchronization, and recovery.
- Store Manager: responsive desktop and mobile ordering, confirmation, ETA, deferral notice, receipt, and issue reporting.
- Do not hide essential functionality on small screens. Adapt the interaction and information hierarchy instead.

## Accessibility

- Use semantic HTML and accessible shadcn/Radix primitives.
- Preserve visible keyboard focus through the `ring` token.
- Add accessible names to icon-only controls.
- Maintain readable contrast and do not rely on hover-only information.
- Use labels, descriptions, and validation messages for form controls; do not use placeholders as the only label.

## Implementation and verification

- Inspect existing components and patterns before creating a new one.
- Preserve unrelated work and existing integrations.
- Do not add a dependency when an installed dependency or existing component can solve the requirement cleanly.
- After frontend changes, run `npm run lint` and `npm run build`.
- Treat lint, TypeScript, and production-build failures caused by the change as incomplete work.
