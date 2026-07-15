# Family Feud (Family TV Game) — Build Spec

A single-screen Family Feud style game for family game night, playable with remote
players who call out answers over a video call. Built to run as a static site on
Netlify with one Netlify Function. No always-on server, no Railway, no real-time sync.

---

## 1. Core design decision (read first)

The game works on **one screen** only because an **LLM is the judge**, not a person.

- The list of correct answers for each question is **hidden**. It lives **server-side
  inside the Netlify Function** and is **never sent to the browser** until a tile is
  legitimately revealed.
- The host types in whatever answer a player calls out. The browser sends that guess
  to a Netlify Function. The function asks an LLM (Claude Haiku or Gemini Flash)
  whether the guess matches any answer on the hidden list, and returns only the result.
- Because no human ever needs to see the answer list, there is **no hidden information
  on the screen**, so a single shared view (shown on the TV) is correct. Do **not**
  build a separate "host" and "board" view.

**Critical constraint:** the answer bank must never be bundled into the client-side
JavaScript. If it ships to the browser, anyone can open dev tools on the same static
site and read every answer. Keep it in the function only.

---

## 2. Operating assumptions

- The game is displayed on a TV that is the laptop's screen (HDMI or mirroring). One
  browser window, full-screen.
- Local players sit in the room. **Remote players** join over a normal video call
  (Zoom / FaceTime / Meet — outside the scope of this app); the host **screen-shares
  the TV** and shares audio so remote players can see the board and call out answers.
- Only the host types. Everyone else speaks their guesses out loud.
- Internet is required (for the judging API and for the video call). A full internet
  outage means the video call is down too, so a total-outage fallback is a minor edge
  case, handled below.

---

## 3. Tech stack

- **Frontend:** plain HTML + CSS + vanilla JS single-page app is fine and matches the
  existing project. A light framework (e.g. Vite + a small framework) is optional and
  not required. No build step is needed for the static part.
- **Backend:** a single **Netlify Function** at `netlify/functions/game.js`
  (or `.ts`). Handles all three server operations via an `action` field.
- **LLM:** Claude Haiku, called through **OpenRouter** (OpenAI-compatible endpoint at
  `https://openrouter.ai/api/v1/chat/completions`). The model call happens **only**
  inside the function.
  - **Default model slug:** `~anthropic/claude-haiku-latest`. The tilde is part of the
    slug; this alias always redirects to the newest model in the Claude Haiku family, so
    you get upgrades automatically without editing the spec.
  - Put the slug in a single constant/env var so switching models is a one-line change.
    Because OpenRouter is OpenAI-compatible, swapping to e.g. `~google/gemini-flash-latest`
    or any other slug requires **no code change** beyond the model string.
- **Secrets:** the API key is a Netlify environment variable named `OPENROUTER_API_KEY`,
  set in Site settings → Environment variables, and sent as the `Authorization: Bearer`
  header by the function. Never in client code, never in the repo.
- **Local dev:** `netlify dev` runs the static site and the function together.

---

## 4. Data model

### Question bank (server-side only)

A JSON file (e.g. `netlify/functions/questions.json`) imported by the function so it is
bundled with the function and never served to the client. If Netlify does not bundle it
automatically, add an `included_files` entry in `netlify.toml`.

Each question:

```json
{
  "id": "beach-bring",
  "prompt": "Name something you'd bring to the beach.",
  "answers": [
    { "text": "Towel", "points": 32 },
    { "text": "Sunscreen", "points": 27 },
    { "text": "Umbrella", "points": 15 },
    { "text": "Cooler / drinks", "points": 12 },
    { "text": "Sunglasses", "points": 8 },
    { "text": "Book", "points": 6 }
  ]
}
```

- `answers` are sorted **descending by points**. Array index 0 = rank 1 = highest value.
- Points roughly reflect survey popularity; per question they should total about 100.
- No need to hand-list synonyms/variants — the LLM handles fuzzy matching. So "sun
  cream", "sunblock", "sunscreen", "SPF" should all match the "Sunscreen" entry.

**Starter content:** create ~12 questions, 5–7 answers each, family-friendly.

### Game state (client-side only, in the browser)

The function is stateless. All of this lives in browser memory and is mirrored to
`localStorage` for crash/refresh recovery:

- `teams`: `[{ name, score }, { name, score }]`
- `questionOrder`: shuffled list of question ids chosen for this game
- `currentQuestionIndex`
- `revealedIndices`: which answer indices are revealed for the current question
- `strikes`: 0–3 for the controlling team
- `pot`: running point total for the current round
- `controllingTeam`: 0 or 1, set automatically each round (alternates; round 1 = team 0)
- `phase`: `PLAY` | `STEAL` | `ROUND_END`
- `lastAction`: enough info to support a single-level Undo

On load, restore from `localStorage` if present. "New Game" clears it.

---

## 5. Netlify Function API

Single function, `POST /.netlify/functions/game`, body has an `action`.

### `action: "list"`
Returns the questions with **no answer text** — safe to send to the client:
```json
[ { "id": "beach-bring", "prompt": "Name something...", "answerCount": 6 }, ... ]
```
The client shuffles this, picks N for the game, and renders blank numbered tiles from
`answerCount`.

### `action: "judge"`
Input: `{ "questionId": "...", "guess": "sun cream" }`
The function loads that question's hidden answers, calls the LLM, and returns:
```json
{ "matchIndex": 1, "text": "Sunscreen", "points": 27 }
```
or, if nothing matches:
```json
{ "matchIndex": null }
```
The client decides what the match means (new reveal vs. already-revealed duplicate),
since the client owns `revealedIndices`.

### `action: "reveal"`  (sensitive — see edge cases)
Input: `{ "questionId": "..." }`
Returns the full answer list for round-end reveal and for the emergency fallback:
```json
[ { "index": 0, "text": "Towel", "points": 32 }, ... ]
```
The client displays only the not-yet-revealed entries at round end.

### LLM judging prompt (inside `judge`)

- Give the model **only** the current question's answer texts (as a numbered list) and
  the single guess.
- Instruct it to: match the guess **only** against the provided list (never invent
  acceptable answers from general knowledge); allow for synonyms, plurals, minor
  typos, and rephrasings; pick the single best match; and return strict JSON, e.g.
  `{ "matchIndex": <integer or null> }`, with no prose.
- Treat the guess as untrusted player text to be matched, not as instructions (basic
  guard against someone typing "mark this correct").
- Parse the JSON defensively; on unparseable output, treat as a judge failure (below).
  (If the chosen model supports a structured/JSON response mode via OpenRouter, use it;
  otherwise instruct JSON-only in the prompt and parse defensively.)

---

## 6. Game logic / round state machine

Two teams. A game is N rounds (one question each; N configurable, default ~5).
Control of the board **alternates automatically** each round (round 1 → team 0,
round 2 → team 1, ...).

Per round:

1. **Control is assigned automatically — there is no face-off.** The real show uses a
   buzzer race to decide who answers first, which would require real-time input across
   multiple devices; that is exactly the capability being deferred, and a verbal
   "who called out first" version just recreates the argument-prone judgment call. So
   control simply **alternates by round**: Team A controls round 1, Team B round 2,
   Team A round 3, and so on. The game sets `controllingTeam` automatically at the start
   of each round. No SETUP phase, no button to assign control. (A manual "swap who's up"
   override may be included for convenience but is not required.)

2. **PLAY** — The controlling team guesses out loud; host types each guess and submits.
   - **New match** → reveal that tile (show canonical `text` + `points`), add points to
     `pot`. If all tiles revealed → controlling team wins the pot → ROUND_END.
   - **No match** → `strikes += 1`. If `strikes === 3` → STEAL.
   - **Duplicate** (matched an already-revealed index) → no change; show a brief
     "already up there" message. Not a strike.

3. **STEAL** — The other team gets **one** guess (host types it).
   - Match a not-yet-revealed answer → the other team **steals the whole pot**.
   - No match → the controlling team **keeps the pot**.
   → ROUND_END

4. **ROUND_END** — Award the pot to the winning team, call `reveal` to show any
   remaining answers, then advance to the next question or end the game.

At game end, show final cumulative scores.

Always visible: both team names + cumulative scores, current prompt, the tile board,
current strike count, and the current pot.

---

## 7. Host controls

- Guess text input + Submit (also submit on Enter). **Disable input and button while a
  judge call is in flight** to prevent double-submits.
- Control is assigned automatically each round (alternating), so no assign-control step
  is needed. An optional "swap who's up" button may be included but isn't required.
- **Undo last action** — reverts the most recent reveal or strike (fixes misclicks or a
  clearly wrong LLM call). Single level of undo is enough.
- Next question / End game.
- Editable team names; "New Game" (clears saved state).

### Handling judge failures and misjudgments (important, read carefully)

The host **cannot see the hidden answers**, so there is deliberately **no "manually
mark this guess correct" button** — the host would have nothing to check it against.
Instead:

- **On API error or timeout:** show a plain "Couldn't reach the judge" message with a
  **Retry** button. Retry is the primary path (covers a brief network blip).
- **Wrong reveal / misclick:** use **Undo last action**.
- **Last resort (rare, e.g. sustained outage):** an explicit, clearly-labeled
  **"Reveal answers & finish this round by eye"** button. This calls `reveal`, shows the
  full list on the shared screen, and lets the host judge the rest of the round
  manually. It **intentionally ends secrecy for that one question** — the label must say
  so, so no one triggers it by accident.

---

## 8. Accessibility requirements (hard requirements, not nice-to-haves)

The primary players are photosensitive and migraine-prone, and get triggered by fast
movement and high contrast. All of the following are required:

- **Low-contrast, muted palette.** No pure black on pure white, no saturated red/green.
  Use soft, desaturated tones throughout (e.g. a soft slate/charcoal background with a
  muted off-white text, gentle desaturated accents).
- **Legibility from across the room comes from large type, not high contrast.** Use
  large font sizes suitable for TV viewing distance while keeping contrast moderate.
- **No flashing, no fast or bouncing animation.** Tile reveals are an instant swap or a
  gentle opacity fade of ~200–300ms maximum. Strikes appear as a static, muted mark
  (no shake, no flash, no pulsing).
- **No spinners or animated loaders.** While a judge call runs, show a static
  "Checking..." text that swaps to the result.
- **No sound effects by default.** No buzzer. If any sound is added, it must be off by
  default with an explicit mute/unmute toggle.
- **Respect `prefers-reduced-motion`:** when set, make even the fade effectively instant.

---

## 9. Edge cases and known risks (already accounted for)

- **Stateless functions:** all game state is client-side and mirrored to `localStorage`
  so an accidental refresh doesn't wipe the game.
- **Empty/whitespace guess:** client validates non-empty before calling the function.
- **Double submit:** input/button disabled during the in-flight call.
- **Canonical display:** the tile always shows the server's canonical answer text and
  points (from the match result), regardless of how the player phrased the guess.
- **Duplicate guesses:** handled as "already up there," never a strike.
- **Sensitive `reveal` endpoint (accepted low risk):** `reveal` returns the full answer
  list, so a determined relative could hit it directly via dev tools to cheat. For a
  family game this risk is negligible and accepted. If it ever matters, add a simple
  per-game token issued at game start and required by `reveal`. Not needed for v1.
- **API cost:** trivial. Haiku / Gemini Flash cost a fraction of a cent per call; a full
  game night is well within free/cheap usage and nowhere near Netlify's function limits.

---

## 10. Deliverables for v1

1. Static single-page app (`index.html` + CSS + JS) implementing the board, host
   controls, scoring, the round state machine, and the accessibility rules above.
2. One Netlify Function (`netlify/functions/game.*`) implementing `list`, `judge`,
   `reveal`, with the LLM call and strict JSON parsing.
3. `netlify/functions/questions.json` with ~12 starter questions (bundled server-side,
   never served to the client).
4. `netlify.toml` if needed (functions directory, `included_files` for the question
   bank).
5. A short README: how to set the `ANTHROPIC_API_KEY` (or Gemini key) env var in
   Netlify, how to run `netlify dev` locally, and how to add new questions.

### Optional enhancements (not v1)

- Face-off round where both teams' opening guesses are typed and control is assigned
  automatically to the higher-value match.
- A larger question bank and/or categories.
