---
title: 'Wiki: A New Home Page, a Venizia Switcher and a Smooth Light and Dark Switch'
description: The ARDOR wiki has a new home page and footer, one look shared with the IGNIS and VULCAN wikis, a switcher between the Venizia sites and a smoother light and dark switch. Only readers are affected.
packages: []
---

# Changelog - 2026-10-26

## Wiki: a new home page, a Venizia switcher and a smooth light and dark switch

<Badge type="tip" text="Enhancement" />

**In one line.** The ARDOR wiki looks like the other Venizia sites now, and its home page shows what ARDOR gives an admin before you read a word of the guides.

## What changed

- **A new home page.** The first screen says what ARDOR is in two lines, shows the command that creates an admin, and a code window with the configuration and the mount point the preset writes. Below it are the counts of the repository, the parts of `@venizia/ardor`, and an honest list of when ARDOR is and is not the right tool.
- **A Venizia switcher.** The grid button in the header lists IGNIS, ARDOR, VULCAN and venizia.ai, marks the site you are on and opens the others in the same tab. On a phone the same list sits in the menu.
- **A smoother light and dark switch.** The whole page fades to the other theme in a fifth of a second, and nothing moves across the screen. A reader who asked for less motion gets an instant switch.
- **One footer on every page.** It carries the ARDOR links, the Venizia ecosystem, the community links and the licence. On the home page it opens with the create command again.
- **A flatter look.** Callouts, code windows, tables, the sidebar and the outline use thin lines, square markers and one accent colour. The code windows are dark in both themes, and the fonts are served from the wiki itself instead of a font service.

## Who is affected

- **Readers of the wiki.** No action needed. Links to pages do not change.
- **Users of ARDOR.** Nothing in the packages changed.

## Details

- The look is shared by the IGNIS, ARDOR and VULCAN wikis as one folder, `docs/wiki/site/.vitepress/theme/shared`, kept identical by a hash list and a test in each repository. VULCAN holds the canonical copy.
- Every number on the home page is counted from the repository, and a test fails when one drifts.
- The code windows hold only lines of the preset's own files, and a test checks that too.
