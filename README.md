# Low Stim Play

A small collection of single-page, no-build web games, designed to be gentle on the eyes.

Each game is a self-contained HTML file with no external dependencies or backend — open it in a browser and play. The whole thing is also installable as a PWA (Progressive Web App), so it works offline and can be added to a home screen.

## Why this exists

Most game UIs lean on bright colors, high contrast, and constant motion — flashing effects, animated transitions, bouncing elements. That's rough if you're prone to migraines, vertigo, epilepsy, or other forms of photosensitivity. These games are built the opposite way on purpose:

- **Low, consistent contrast** — all colors are defined with [OKLCH](https://oklch.com/), a perceptually uniform color space, so foreground/background relationships stay predictable and muted instead of jarring.
- **No animation, no transitions** — every stylesheet globally disables `animation` and `transition` (`animation: none !important; transition: none !important;`). Nothing flashes, slides, or pulses.
- **Calm, muted palette** — dark, low-saturation backgrounds with soft accent colors rather than pure black/white or saturated brights.

If you're adding a new game to this repo, keep those constraints in mind — see [Design guidelines](#design-guidelines) below.

## Games

| Game                | File                                       | Description                                                                                                                      |
|---------------------|--------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------|
| Boggle              | [boggle.html](boggle.html)                 | Classic Boggle — a randomly generated 4×4 or 5×5 letter grid, timer, interactive word entry, and validation against a large dictionary ([words.js](words.js)). |
| Boggle (Group Play) | [boggle-static.html](boggle-static.html)   | A display-only variant for group play — shows the board and an optional visual timer bar; reveals all possible words when time's up. No interactive word entry. |
| Yahtzee             | [yahtzee.html](yahtzee.html)               | Full Yahtzee scorecard for one or more players, including upper-section bonus and joker rules.                                   |
| Yahtzee (Dice Only) | [yahtzee-roller.html](yahtzee-roller.html) | Just the dice — roll and hold dice without tracking a scorecard.                                                                 |

More games will be added over time; new entries should be linked from [index.html](index.html) as well as this table.

## Running locally

These are static files, so any static file server works. A launch config is already set up for VS Code / Claude Code:

```bash
python3 -m http.server 8123
```

Then open `http://localhost:8123`.

## Project structure

```
index.html            Landing page linking to all games
about.html            About page (site's story + support link)
boggle.html           Boggle (interactive: word entry, scoring, post-game solver)
boggle-static.html    Boggle (display-only: board + visual timer for group play)
boggle-shared.js      Shared Boggle logic: dice sets, board generation, solver, word-list rendering
boggle-shared.css     Shared Boggle styles: grid, word list, board layout
yahtzee.html          Yahtzee scorecard
yahtzee-roller.html   Standalone dice roller
shared.css            Shared color tokens, reset, and reusable components (buttons, button bar, footer, setup panel, etc.)
theme.js              Dark/light theme toggle (persisted in localStorage)
words.js / words.txt  Word list used for Boggle validation
manifest.json         PWA manifest
sw.js                 Service worker (network-first, offline fallback cache)
```

## Design guidelines

When adding or editing a game, stay consistent with the rest of the repo:

- Link [shared.css](shared.css) from `<head>` (`<link rel="stylesheet" href="shared.css">`) instead of redefining colors, the reset, or common components. It already provides the `:root` color tokens, the animation/transition reset, `body`/`body.scrollable`, `button`, `.button-bar` (with `.left`/`.right` wrapper divs), `.controls`, `.setup`, `.status`/`.heading`, and text `input` styling. Only put page-specific CSS (the board, dice, scorecard, etc.) in the page's own `<style>` block. Boggle pages also link [boggle-shared.css](boggle-shared.css) for the grid, word list, and board-area layout, and load [boggle-shared.js](boggle-shared.js) for dice sets, board generation, the solver, and word-list rendering.
- If a game needs new colors, add them as `oklch(...)` custom properties to `shared.css`'s `:root`, and derive related shades with `oklch(from var(--x) ...)` rather than hardcoding new hex colors or redefining tokens locally.
- Keep the contrast low — avoid pure white text on pure black, or highly saturated accent colors.
- No flashing, blinking, or autoplaying motion of any kind (the global animation/transition reset in `shared.css` enforces this).
- Each game should remain a single HTML file with minimal dependencies (at most the shared `shared.css`, `theme.js`, and any shared JS/CSS specific to that game family, like `boggle-shared.js`/`boggle-shared.css`) so it keeps working offline via the service worker. If you add a new page or shared file, add it to `PRECACHE_URLS` in [sw.js](sw.js) so it's available offline immediately, not just after a first online visit.
