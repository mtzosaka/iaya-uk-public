# Product

<!-- impeccable:product-schema 1 -->

# IAYA UK

Iraqi Academic Youth Association UK: an independent, voluntary, non-profit organisation founded in 2019.

## Platform

web

## Users

- Iraqi undergraduate and postgraduate students, young researchers and academics at UK universities, across disciplines: learning what IAYA offers, attending events and applying for membership.
- Academic partners, universities, associations, employers and community members: assessing the association and its activity.
- Approved community members: signing in to reach member resources.
- Committee administrators: reviewing pending membership applications.

## Product Purpose

The site presents the association and its work across four pillars, and runs community membership:

1. **Academic exchange**: conferences, lectures and seminars that advance knowledge and connect generations of scholars.
2. **Youth development**: training, mentoring and guidance that help students and early-career researchers to excel.
3. **Networks and opportunity**: partnerships with universities, professional associations and employers in the United Kingdom, Iraq and beyond.
4. **A bridge with Iraq**: the transfer of knowledge and expertise in support of Iraq's development, reconstruction and renewal.

Public visitors can learn about the association, its activities, the committee, the documented June 2026 event, verified news, resources and contact channels. Community members sign in with Google, submit an application, wait for committee approval and reach member resources only after approval.

## Positioning

IAYA UK is independent, voluntary and non-profit, and is not run by any political or state body. Official guests such as the Iraqi Embassy take part in its events, but they don't govern it.

## Operating Context

- Bilingual English/Arabic (RTL), with a persistent language toggle and a light/dark theme toggle.
- Membership: Google sign-in → application → committee approval → member resources. Applicants see their status when they sign in; no emails are sent automatically. Profile correction or deletion requests go through the published committee contact channels.
- Administrators are set in deployment configuration (`ADMIN_EMAILS`), never from the browser. Administrators cannot review their own applications.
- Hosted as a Worker with D1; Google OAuth Web client. See README for setup.

## Capabilities and Constraints

- Build with `npm run build` and test with `npm test` (Node 24+, no dependencies). `index.html` and `worker/index.js` are generated: never edit them directly.
- No public member directory.
- Private resources come only from the `COMMUNITY_RESOURCES` configuration. An empty configuration shows an honest empty state.
- The previous implementation is kept on GitHub branch `backup/pre-rebuild-2026-10-12`. The current design replaces it; it is not a CSS overlay.

## Brand Commitments

- Keep the provided logo unchanged.
- Motto: “With knowledge and work, we build the future” / «بالعلم والعمل نبني المستقبل».
- Keep committee names and portraits exactly as provided.
- Voice: formal and elegant in both English and Arabic (owner's direction, 16 October 2026).

## Evidence on Hand

In the repo (`src/content/content.json`): the logo, the keynote photograph, committee portraits (two members have no photo), the June 2026 academic evening agenda (keynote: Sir Bashir Al-Hashimi), and verified news.

The owner holds these but has not yet supplied them: further event photographs, partner logos cleared for display, and member testimonials with permission to publish. Use them only once they are added to the repo. Until then, don't add placeholders or stand-ins for them.

Never invent testimonials, event dates, members, metrics, partners or directory entries.

## Product Principles

1. Truth over polish: every name, date, photo and claim must be real and supplied.
2. Equally bilingual: Arabic is a first-class reading experience, not a translation layer.
3. Independence is visible: present official participation as guests, never as affiliation.
4. Membership is trustworthy: approval states are clear and honest, and access is server-enforced.
