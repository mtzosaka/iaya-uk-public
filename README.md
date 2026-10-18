# IAYA UK

Bilingual Iraqi Academic Youth Association UK website. Complete replacement design with the original logo, association message, committee portraits and documented June 2026 programme preserved.

The previous site is permanently recoverable on GitHub branch `backup/pre-rebuild-2026-10-12` at commit `5d2a06fe574ed71bf86ef50970456a798080fb2a`.

## Source and build

- `src/pages/layout.html` plus `src/partials/*.html`: the page shell, header, footer and one partial per page (home, about, activities, events, resources, contact, privacy, community, not-found).
- `src/styles/NN-name.css`: the stylesheet, one file per section, joined in filename order (tokens, base, header, hero, committee, responsive, and so on).
- `src/scripts/public.js`: theme, language and navigation. `src/scripts/community.js`: Google sign-in, applications, membership states and committee review UI.
- `src/content/content.json`: supplied logo, photographs, names (including the committee list) and association content.
- `scripts/build.mjs` runs the build. `scripts/lib/` holds the page assembler, HTML helpers and Worker wrapper; `scripts/data/` holds the programme and resource lists.
- `server/community.mjs`: Worker API with Google token verification, secure server sessions and D1-backed approval.
- `migrations/schema.sql`: D1 schema; immutable initial deployment migration also in `drizzle/`.
- `index.html`: generated self-contained public preview; opening the file locally cannot authenticate members.
- `worker/index.js`: generated Worker serving the page and API.

Node 24+ is sufficient. No package installation is required.

```sh
npm run build
npm test
```

Run a build after changing `src/`, `scripts/` or `server/`. Never edit generated Worker output directly.

## Hosting and Google configuration

Sites project identity is preserved in `.openai/hosting.json`. No Lovable project is used.

Before enabling live membership:

1. Deploy the Worker with D1 bound as `DB`; apply the schema once. Sites packaging includes the Drizzle migration for hosted application. Other Worker hosts can execute `migrations/schema.sql` directly.
2. Create a **Web application** OAuth client in Google Cloud. Add the site's exact HTTPS origin under **Authorized JavaScript origins**. This GIS callback flow does not need a client secret or redirect URI.
3. Set `GOOGLE_CLIENT_ID` in the hosting environment. Set `ADMIN_EMAILS` to the association's verified Google/Gmail or Google Workspace committee administrator addresses. These are deployment configuration, never editable roles from the browser. An administrator cannot review their own application.
4. Confirm Google consent, signin, signout, membership submission and approval on the deployed origin using separate member/admin accounts. Public pages are available without signing in. Pending/rejected applications cannot access member resources.
5. Optional `COMMUNITY_RESOURCES` JSON environment value adds private resource objects `{title,description,url}`. Empty configuration shows an honest empty state; no fictional members or content are seeded.

Missing Google/D1 configuration disables authentication clearly. A visual preview is not evidence of a working live OAuth login.

Setup references: [Google Web client setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid), [server verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

## Verification and boundaries

Security tests use genuine RSA signatures and a real in-memory SQLite database: invalid tokens, one-time browser nonces, CSRF/origin, hashed sessions, application persistence, authorization, approval race detection/audit, logout and rate limits. UI contract tests additionally covered configured/unconfigured, Arabic, pending/rejected/approved, Google callback and safe URL states. Rendered desktop/mobile review and live Google authentication remain required where the controlled browser/hosting are available.

No email is automatically sent on application or decision. Applicants see their status when signing in. Profile correction/deletion requests go through the published committee contact channels. No member directory is published.

## Design sources

Guidance from the three repositories requested by the owner is recorded with source SHAs and licenses in `docs/design-sources/APPLICATION-NOTES.md`. Their source guides informed this rebuild; their automated installers/CLI polish engines were not run. Native code implements editorial composition, useful motion, theme contrast, responsive navigation and accessible forms.
