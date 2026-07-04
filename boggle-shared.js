// Shared game data and logic between boggle.html and boggle-static.html.
// Loaded after words.js (for WORD_LIST) and before each page's own inline
// script.

// Standard 4x4 Boggle -- 16 dice (New Boggle set, post-1990)
const DICE_4 = [
    ['A', 'A', 'E', 'E', 'G', 'N'],
    ['E', 'L', 'R', 'T', 'T', 'Y'],
    ['A', 'O', 'O', 'T', 'T', 'W'],
    ['A', 'B', 'B', 'J', 'O', 'O'],
    ['E', 'H', 'R', 'T', 'V', 'W'],
    ['C', 'I', 'M', 'O', 'T', 'U'],
    ['D', 'I', 'S', 'T', 'T', 'Y'],
    ['E', 'I', 'O', 'S', 'S', 'T'],
    ['D', 'E', 'L', 'R', 'V', 'Y'],
    ['A', 'C', 'H', 'O', 'P', 'S'],
    ['H', 'I', 'M', 'N', 'Qu', 'U'],
    ['E', 'E', 'F', 'H', 'I', 'Y'],
    ['E', 'E', 'G', 'H', 'N', 'W'],
    ['A', 'F', 'F', 'K', 'P', 'S'],
    ['H', 'L', 'N', 'N', 'R', 'Z'],
    ['D', 'E', 'I', 'L', 'R', 'X'],
];

// Big Boggle 5x5 -- 25 dice
const DICE_5 = [
    ['A', 'A', 'A', 'F', 'R', 'S'],
    ['A', 'A', 'E', 'E', 'G', 'N'],
    ['A', 'A', 'E', 'E', 'G', 'N'],
    ['A', 'A', 'F', 'I', 'R', 'S'],
    ['A', 'D', 'E', 'N', 'N', 'N'],
    ['A', 'E', 'E', 'E', 'E', 'M'],
    ['A', 'E', 'G', 'M', 'U', 'U'],
    ['A', 'E', 'G', 'M', 'N', 'N'],
    ['A', 'F', 'I', 'R', 'S', 'Y'],
    ['B', 'J', 'K', 'Qu', 'X', 'Z'],
    ['C', 'C', 'N', 'S', 'T', 'W'],
    ['C', 'E', 'I', 'I', 'L', 'T'],
    ['C', 'E', 'I', 'L', 'P', 'T'],
    ['D', 'D', 'H', 'N', 'O', 'T'],
    ['D', 'H', 'H', 'L', 'O', 'R'],
    ['D', 'H', 'L', 'N', 'O', 'R'],
    ['D', 'H', 'L', 'N', 'O', 'R'],
    ['E', 'E', 'I', 'I', 'I', 'T'],
    ['E', 'N', 'S', 'S', 'S', 'U'],
    ['E', 'E', 'T', 'T', 'I', 'I'],
    ['F', 'I', 'P', 'R', 'S', 'Y'],
    ['G', 'O', 'R', 'R', 'V', 'W'],
    ['H', 'I', 'P', 'R', 'R', 'Y'],
    ['N', 'O', 'O', 'T', 'U', 'W'],
    ['O', 'O', 'O', 'T', 'T', 'U'],
];

const WIDE = new Set(['W', 'M', 'Qu']);
const DESCENDER = new Set(['Qu']);
const MIN_WORD_LENGTH = 3;

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// Builds a fresh board's cells and adjacency list for the given size (4 or
// 5). Pure -- callers hold the result in their own state.
function buildBoardCells(size) {
    const cols = size;
    const rows = size;
    const DICE = size === 5 ? DICE_5 : DICE_4;
    const shuffledDice = shuffle(DICE);
    const board = shuffledDice.map((faces, i) => {
        const face = faces[Math.floor(Math.random() * faces.length)];
        return {
            index: i,
            row: Math.floor(i / cols),
            col: i % cols,
            display: face,
            match: face.toLowerCase(),
        };
    });
    const neighborsOf = board.map(cell => {
        const result = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = cell.row + dr;
                const c = cell.col + dc;
                if (r >= 0 && r < rows && c >= 0 && c < cols) {
                    result.push(r * cols + c);
                }
            }
        }
        return result;
    });
    return { board, neighborsOf, cols, rows };
}

// Builds the `.die` element (with its letter span) for one board cell.
// Callers append any extra per-die UI (e.g. the interactive version's
// order badge) themselves.
function createDieElement(cell) {
    const dieEl = document.createElement('div');
    dieEl.className = 'die';
    dieEl.dataset.index = cell.index;

    const span = document.createElement('span');
    span.className = 'letter'
        + (WIDE.has(cell.display) ? ' wide' : '')
        + (DESCENDER.has(cell.display) ? ' descender' : '');
    span.textContent = cell.display;
    dieEl.appendChild(span);

    return dieEl;
}

// ================= Dictionary =================

function buildDictionary() {
    const wordSet = new Set(WORD_LIST);
    const root = {};
    for (const w of WORD_LIST) {
        let node = root;
        for (let i = 0; i < w.length; i++) {
            const ch = w[i];
            node = node[ch] || (node[ch] = {});
        }
        node.$ = true;
    }
    return { wordSet, trie: root };
}

// ================= Board solver =================

function solveBoard(board, neighborsOf, trie) {
    const found = new Set();
    const visited = new Array(board.length).fill(false);

    function dfs(index, node, wordSoFar) {
        const cell = board[index];
        let curNode = node;
        for (const ch of cell.match) {
            curNode = curNode[ch];
            if (!curNode) return;
        }
        const newWord = wordSoFar + cell.match;
        if (curNode.$ && newWord.length >= MIN_WORD_LENGTH) found.add(newWord);
        visited[index] = true;
        for (const n of neighborsOf[index]) {
            if (!visited[n]) dfs(n, curNode, newWord);
        }
        visited[index] = false;
    }

    for (let i = 0; i < board.length; i++) dfs(i, trie, '');
    return found;
}

function sortWords(words) {
    return [...words].sort((a, b) => a.length - b.length || a.localeCompare(b));
}

// ================= Word list rendering =================

// How tall a single length's word list is allowed to grow before it
// switches to side-by-side sub-columns instead -- matches the shared
// #game.with-list .grid width (see boggle-shared.css) so the board and
// list stay visually balanced. Call only once the word list panel is
// unhidden (needs real layout to measure against).
function wordListHeightBudget() {
    return Math.min(0.38 * window.innerWidth, 0.48 * window.innerHeight);
}

const SUB_COLUMN_WIDTH = 84;
const SUB_COLUMN_GAP = 16;

// The widest a single length's sub-column layout is ever allowed to grow,
// derived from how much width .word-list-panel actually has to work with.
// Without this, a word-rich length (lots of 3- or 4-letter words) would keep
// adding columns sideways with no limit, running the panel's background box
// past its own max-width and off the edge of the screen -- horizontal
// scrolling, which this site never wants. Capping the column count means a
// word-rich length instead grows *taller* (more rows within the same
// columns), which the page is already allowed to scroll to see.
//
// Most of the time the panel gets a viewport-relative share (94vw below
// 900px, 66vw above it -- see boggle-shared.css). But on a landscape phone,
// boggle.html (not boggle-static.html, which never shares a row with the
// grid) sits the post-game reveal's grid and word list side by side instead
// of stacked, so the list only gets whatever's left over after the grid,
// not its usual full-width share -- see #game.with-list #board-area in
// boggle.html's own <style>. Checking #board-area's actual computed
// flex-wrap (rather than hard-coding "boggle.html + landscape + <900px")
// detects that case directly, so this stays correct if either page's
// layout rules change later.
function maxSubColumns() {
    const boardArea = document.getElementById('board-area');
    const sharesRowWithGrid = boardArea && getComputedStyle(boardArea).flexWrap === 'nowrap';
    const availableWidth = sharesRowWithGrid
        ? Math.min(0.58 * window.innerWidth, 560)
        : Math.min((window.innerWidth < 900 ? 0.94 : 0.66) * window.innerWidth, 1400);
    return Math.max(1, Math.floor((availableWidth - 40 + SUB_COLUMN_GAP) / (SUB_COLUMN_WIDTH + SUB_COLUMN_GAP)));
}

// Renders every word in allWordsSet into `container`, one column per
// length, with each column's header held to a shared top row via
// flex-wrap (see .word-columns in boggle-shared.css). A length whose list
// would run taller than the height budget switches to side-by-side
// sub-columns instead of growing further down.
//
// `formatWord(word)` formats each entry's display text (default: just the
// uppercased word). `foundSet`, if given, is a Set of already-found
// lowercase words to bold/accent -- used by the interactive version, left
// undefined by the static (cast-to-TV, answer-key-only) version.
function renderWordColumns(container, allWordsSet, { formatWord, foundSet } = {}) {
    const format = formatWord || (w => w.toUpperCase());
    const allWords = sortWords([...allWordsSet]);
    const byLength = new Map();
    allWords.forEach(w => {
        if (!byLength.has(w.length)) byLength.set(w.length, []);
        byLength.get(w.length).push(w);
    });

    container.innerHTML = '';
    const budget = wordListHeightBudget();
    const maxCols = maxSubColumns();

    function buildList(words) {
        const ul = document.createElement('ul');
        ul.className = 'word-list';
        words.forEach(w => {
            const li = document.createElement('li');
            li.textContent = format(w);
            if (foundSet && foundSet.has(w)) li.classList.add('found');
            ul.appendChild(li);
        });
        return ul;
    }

    [...byLength.keys()].sort((a, b) => a - b).forEach(len => {
        const col = document.createElement('div');
        col.className = 'word-column';

        const header = document.createElement('div');
        header.className = 'word-column-header';
        header.textContent = len + ' letters';
        col.appendChild(header);

        const words = byLength.get(len);
        const ul = buildList(words);
        col.appendChild(ul);
        container.appendChild(col);

        // Measured after attaching, in its natural single-column height, so
        // a short list never pays for space it doesn't need -- only a list
        // taller than the budget switches to side-by-side sub-lists.
        // Column count is however many are needed to bring it back within
        // the budget, capped at however many actually fit the screen's
        // width (maxCols) -- past that cap, the sub-lists just grow taller
        // instead of the layout growing wider than the viewport. On a
        // screen too narrow to fit even a second column, skip sub-lists
        // entirely and leave it as one (possibly tall) column; the page can
        // already scroll vertically to see the rest.
        //
        // Words are split by count into evenly-sized, independent <ul>s
        // rather than using CSS column-count on one <ul> -- a CSS multi-col
        // box is free to add an extra column of its own if the content
        // doesn't divide evenly into the given height (rounding, line-height
        // slop), which silently pushed columns past the width set below and
        // off the edge of the screen. Splitting the words ourselves fixes
        // the column count exactly, so the total width can never exceed
        // what was budgeted for it.
        if (ul.offsetHeight > budget && maxCols > 1) {
            const idealCols = Math.ceil(ul.offsetHeight / budget);
            const cols = Math.min(idealCols, maxCols);
            const perCol = Math.ceil(words.length / cols);
            const sublists = document.createElement('div');
            sublists.className = 'word-sublists';
            for (let i = 0; i < words.length; i += perCol) {
                sublists.appendChild(buildList(words.slice(i, i + perCol)));
            }
            col.replaceChild(sublists, ul);
        }
    });

    return allWords.length;
}

// Body is non-scrolling by default (see shared.css) so the board and word
// list normally fit on one screen without any UI chrome -- but an
// unusually word-rich board can occasionally need more room than the
// screen has. Rather than ever silently clipping an answer off the
// bottom, fall back to letting the page scroll.
function allowScrollIfContentOverflows() {
    document.body.style.overflowY =
        document.documentElement.scrollHeight > window.innerHeight ? 'auto' : '';
}
