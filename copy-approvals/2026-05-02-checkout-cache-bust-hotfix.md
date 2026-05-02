# Copy Approval

Date: 2026-05-02
Owner: Gonzalo
Status: APROBADO

## Scope

- Files/routes: `pedido/index.html`, `tests/functional/checkout.spec.js`.
- Visible copy approved: no visible customer copy changes.
- Notes: `/pedido/` now loads `assets/checkout.js` with a versioned URL so browsers do not keep stale checkout logic that still expected the removed price-acceptance checkbox.
