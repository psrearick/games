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

const SUB_COLUMN_WIDTH = 66;
const SUB_COLUMN_GAP = 14;

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

    [...byLength.keys()].sort((a, b) => a - b).forEach(len => {
        const col = document.createElement('div');
        col.className = 'word-column';

        const header = document.createElement('div');
        header.className = 'word-column-header';
        header.textContent = len + ' letters';
        col.appendChild(header);

        const ul = document.createElement('ul');
        ul.className = 'word-list';
        byLength.get(len).forEach(w => {
            const li = document.createElement('li');
            li.textContent = format(w);
            if (foundSet && foundSet.has(w)) li.classList.add('found');
            ul.appendChild(li);
        });
        col.appendChild(ul);
        container.appendChild(col);

        // Measured after attaching, in its natural single-column height,
        // so a short list never pays for space it doesn't need -- only a
        // list taller than the budget switches to sub-columns. Column
        // count is however many are needed to bring it back within the
        // budget, and the element's width is set explicitly to match (see
        // SUB_COLUMN_WIDTH note above .word-list.multi-col).
        if (ul.offsetHeight > budget) {
            const cols = Math.ceil(ul.offsetHeight / budget);
            ul.classList.add('multi-col');
            ul.style.height = budget + 'px';
            ul.style.columnCount = cols;
            ul.style.width = (cols * SUB_COLUMN_WIDTH + (cols - 1) * SUB_COLUMN_GAP) + 'px';
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
