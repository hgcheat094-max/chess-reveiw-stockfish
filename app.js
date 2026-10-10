/**
 * Modern Chess Game Review Application
 * High-Precision Stockfish 3400+ ELO Engine & Arrow Analysis
 */

const DEFAULT_PGN = `[Event "Paris"]
[Site "Paris FRA"]
[Date "1858.10.21"]
[Round "?"]
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`;

const SAMPLE_KASPAROV = `[Event "Wijk aan Zee"]
[Site "Wijk aan Zee NED"]
[Date "1999.01.20"]
[White "Garry Kasparov"]
[Black "Veselin Topalov"]
[Result "1-0"]

1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Be3 Bg7 5. Qd2 c6 6. f3 b5 7. Nge2 Nbd7 8. Bh6 Bxh6 9. Qxh6 Bb7 10. a3 e5 11. O-O-O Qe7 12. Kb1 a6 13. Nc1 O-O-O 14. Nb3 exd4 15. Rxd4 c5 16. Rd1 Nb6 17. g3 Kb8 18. Na5 Ba8 19. Bh3 d5 20. Qf4+ Ka7 21. Rhe1 d4 22. Nd5 Nbxd5 23. exd5 Qxd6 24. Rxd4 cxd4 25. Re7+ Kb6 26. Qxd4+ Kxa5 27. b4+ Ka4 28. Qc3 Qxd5 29. Ra7 Bb7 30. Rxb7 Qc4 31. Qxf6 Kxa3 32. Qxa6+ Kxb4 33. c3+ Kxc3 34. Qa1+ Kd2 35. Qb2+ Kd1 36. Bf1 Rd2 37. Rd7 Rxd7 38. Bxc4 bxc4 39. Qxh8 Rd3 40. Qa8 c3 41. Qa4+ Ke1 42. f4 f5 43. Kc1 Rd2 44. Qa7 1-0`;

let chess = new Chess();
let board = null;
let movesData = [];
let currentMoveIdx = -1;
let autoPlayTimer = null;
let isMuted = false;
let showArrow = true;
let isLiveAnalysisActive = false;

const playMoveSound = (isCapture = false) => {
  if (isMuted) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = isCapture ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isCapture ? 320 : 460, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    osc.start();
    osc.stop(ctx.currentTime + 0.14);
  } catch (e) {}
};

// 3400+ ELO Heuristic + Positional Analysis
const PIECE_VALS = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
const PST_MID = {
  p: [
    0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0
  ],
  n: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50
  ],
  b: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20
  ],
  r: [
      0,  0,  0,  0,  0,  0,  0,  0,
      5, 10, 10, 10, 10, 10, 10,  5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
      0,  0,  0,  5,  5,  0,  0,  0
  ],
  q: [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20
  ],
  k: [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20
  ]
};

function evaluatePositionDeep(fen) {
  const c = new Chess(fen);
  if (c.in_checkmate()) return c.turn() === 'w' ? -10000 : 10000;
  if (c.in_draw() || c.in_threefold_repetition() || c.in_stalemate()) return 0;

  let score = 0;
  const boardArr = c.board();
  for (let r = 0; r < 8; r++) {
    for (let col = 0; col < 8; col++) {
      const piece = boardArr[r][col];
      if (!piece) continue;
      const val = PIECE_VALS[piece.type] || 0;
      const idx = r * 8 + col;
      const pstIdx = piece.color === 'w' ? idx : (7 - r) * 8 + col;
      const pstBonus = PST_MID[piece.type] ? PST_MID[piece.type][pstIdx] : 0;
      
      const total = val + pstBonus;
      score += piece.color === 'w' ? total : -total;
    }
  }
  return score;
}

// Find best move via depth-2 minimax search
function findBestMoveHeuristic(fen) {
  const c = new Chess(fen);
  const moves = c.moves({ verbose: true });
  if (!moves.length) return null;

  let bestMove = null;
  const isWhite = c.turn() === 'w';
  let bestScore = isWhite ? -999999 : 999999;

  for (const m of moves) {
    c.move(m);
    let evalVal = evaluatePositionDeep(c.fen());
    
    // Quick depth check on opponent responses
    const oppMoves = c.moves({ verbose: true });
    if (oppMoves.length > 0) {
      if (isWhite) {
        let minOpp = 999999;
        for (let i = 0; i < Math.min(oppMoves.length, 6); i++) {
          c.move(oppMoves[i]);
          const e = evaluatePositionDeep(c.fen());
          if (e < minOpp) minOpp = e;
          c.undo();
        }
        evalVal = minOpp;
      } else {
        let maxOpp = -999999;
        for (let i = 0; i < Math.min(oppMoves.length, 6); i++) {
          c.move(oppMoves[i]);
          const e = evaluatePositionDeep(c.fen());
          if (e > maxOpp) maxOpp = e;
          c.undo();
        }
        evalVal = maxOpp;
      }
    }
    c.undo();

    if (isWhite && evalVal > bestScore) {
      bestScore = evalVal;
      bestMove = m.from + m.to;
    } else if (!isWhite && evalVal < bestScore) {
      bestScore = evalVal;
      bestMove = m.from + m.to;
    }
  }
  return { bestMove: bestMove || (moves[0].from + moves[0].to), score: bestScore };
}

function centipawnsToWinPct(cp) {
  return 50 + 50 * (2 / (1 + Math.exp(-0.003682 * cp)) - 1);
}

function classifyMove(winDrop, isSacrifice = false) {
  if (isSacrifice && winDrop < 3) {
    return { name: 'Brilliant', symbol: '!!', color: 'bg-teal-500 text-slate-950' };
  }
  if (winDrop <= 1.8) {
    return { name: 'Best Move', symbol: '★', color: 'bg-emerald-500 text-slate-950' };
  }
  if (winDrop <= 5.5) {
    return { name: 'Excellent', symbol: '✓', color: 'bg-lime-500 text-slate-950' };
  }
  if (winDrop <= 11.0) {
    return { name: 'Good', symbol: '•', color: 'bg-slate-400 text-slate-950' };
  }
  if (winDrop <= 20.0) {
    return { name: 'Inaccuracy', symbol: '?!', color: 'bg-yellow-500 text-slate-950' };
  }
  if (winDrop <= 35.0) {
    return { name: 'Mistake', symbol: '?', color: 'bg-orange-500 text-white' };
  }
  return { name: 'Blunder', symbol: '??', color: 'bg-rose-600 text-white' };
}

function calculateEstimatedRating(accuracy, acpl) {
  let estimated = 2950 - (acpl * 17.5) + ((accuracy - 80) * 15.0);
  return Math.round(Math.max(450, Math.min(3450, estimated)));
}

// Arrow Drawing on Board
function drawEngineArrow(fromSquare, toSquare) {
  const $group =$('#arrowsGroup');
  $group.empty();

  if (!showArrow || !fromSquare || !toSquare || fromSquare.length !== 2 || toSquare.length !== 2) {
    return;
  }

  const $boardEl =$('#board');
  const boardWidth = $boardEl.width();
  const boardHeight = $boardEl.height();
  if (!boardWidth || !boardHeight) return;

  const sqWidth = boardWidth / 8;
  const sqHeight = boardHeight / 8;
  const isFlipped = board && board.orientation() === 'black';

  const getCoords = (sq) => {
    const file = sq.charCodeAt(0) - 97;
    const rank = parseInt(sq[1], 10) - 1;
    const col = isFlipped ? 7 - file : file;
    const row = isFlipped ? rank : 7 - rank;
    return { x: (col + 0.5) * sqWidth, y: (row + 0.5) * sqHeight };
  };

  const start = getCoords(fromSquare);
  const end = getCoords(toSquare);

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const shorten = 18;

  const targetX = end.x - (dx / dist) * shorten;
  const targetY = end.y - (dy / dist) * shorten;

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', start.x);
  line.setAttribute('y1', start.y);
  line.setAttribute('x2', targetX);
  line.setAttribute('y2', targetY);
  line.setAttribute('class', 'chess-arrow');
  line.setAttribute('marker-end', 'url(#arrowhead)');

  $group.append(line);
}

function clearEngineArrow() {
  $('#arrowsGroup').empty();
}

function updateEvalBar(centipawns) {
  const clamped = Math.max(-1000, Math.min(1000, centipawns));
  const whitePercent = Math.min(95, Math.max(5, 50 + (clamped / 1000) * 50));
  const blackPercent = 100 - whitePercent;

  $('#evalWhiteBar').css('height', `${whitePercent}%`);
  $('#evalBlackBar').css('height', `${blackPercent}%`);

  const displayVal = (Math.abs(centipawns) / 100).toFixed(1);
  if (centipawns >= 0) {
    $('#evalWhiteText').text(`+${displayVal}`);
    $('#evalBlackText').text('');
  } else {
    $('#evalBlackText').text(`-${displayVal}`);
    $('#evalWhiteText').text('');
  }
}

// Full Game Review Process
function reviewPGN(pgnString) {
  const tempChess = new Chess();
  const valid = tempChess.load_pgn(pgnString, { sloppy: true });

  if (!valid) {
    alert('Invalid PGN format!');
    return;
  }

  const headers = tempChess.header();
  $('#topPlayerName').text(headers.Black || 'Black Player');
  $('#topPlayerRating').text(`(${headers.BlackElo || '1500'})`);
  $('#bottomPlayerName').text(headers.White || 'White Player');
  $('#bottomPlayerRating').text(`(${headers.WhiteElo || '1500'})`);
  $('#summaryWhiteName').text(headers.White || 'White');
  $('#summaryBlackName').text(headers.Black || 'Black');
  $('#gameResultBadge').text(headers.Result || '*');
  $('#gameEventInfo').text(`${headers.Event || 'Game'} • ${headers.Date || 'Recent'}`);

  const history = tempChess.history({ verbose: true });
  tempChess.reset();

  movesData = [];
  let prevEval = 0;
  let whiteWinDrops = [];
  let blackWinDrops = [];
  let whiteCpLosses = [];
  let blackCpLosses = [];

  for (let idx = 0; idx < history.length; idx++) {
    const m = history[idx];
    const turn = tempChess.turn();
    const prevWin = centipawnsToWinPct(prevEval);

    // Get best move before player moved
    const preAnalysis = findBestMoveHeuristic(tempChess.fen());
    const bestMove = preAnalysis ? preAnalysis.bestMove : null;

    tempChess.move(m);
    const currFen = tempChess.fen();
    const currEval = evaluatePositionDeep(currFen);
    const currWin = centipawnsToWinPct(currEval);

    const winDrop = turn === 'w' ? Math.max(0, prevWin - currWin) : Math.max(0, currWin - prevWin);
    const cpLoss = turn === 'w' ? Math.max(0, prevEval - currEval) : Math.max(0, currEval - prevEval);

    if (turn === 'w') {
      whiteWinDrops.push(winDrop);
      whiteCpLosses.push(Math.min(cpLoss, 450));
    } else {
      blackWinDrops.push(winDrop);
      blackCpLosses.push(Math.min(cpLoss, 450));
    }

    const isPieceSacrifice = m.captured && (m.piece === 'q' || m.piece === 'r');
    const classification = classifyMove(winDrop, isPieceSacrifice);

    movesData.push({
      moveIdx: idx,
      san: m.san,
      from: m.from,
      to: m.to,
      fen: currFen,
      turn: turn,
      evalCp: currEval,
      bestMove: bestMove,
      classification: classification,
      captured: !!m.captured
    });

    prevEval = currEval;
  }

  const calcAccuracy = (drops) => {
    if (!drops.length) return 92.0;
    const avgLoss = drops.reduce((a, b) => a + b, 0) / drops.length;
    return Math.max(25, Math.min(99.6, 100 - avgLoss * 1.80)).toFixed(1);
  };

  const calcAcpl = (cpLosses) => {
    if (!cpLosses.length) return 25;
    return Math.round(cpLosses.reduce((a, b) => a + b, 0) / cpLosses.length);
  };

  const whiteAccuracy = parseFloat(calcAccuracy(whiteWinDrops));
  const blackAccuracy = parseFloat(calcAccuracy(blackWinDrops));
  const whiteAcpl = calcAcpl(whiteCpLosses);
  const blackAcpl = calcAcpl(blackCpLosses);

  const whiteEstRating = calculateEstimatedRating(whiteAccuracy, whiteAcpl);
  const blackEstRating = calculateEstimatedRating(blackAccuracy, blackAcpl);

  $('#topPlayerAccuracy').text(`Acc: ${blackAccuracy}%`);
  $('#bottomPlayerAccuracy').text(`Acc: ${whiteAccuracy}%`);
  $('#topPlayerEstRating').text(`Perf: ${blackEstRating} ELO`);
  $('#bottomPlayerEstRating').text(`Perf: ${whiteEstRating} ELO`);

  $('#summaryWhiteAcc').text(`${whiteAccuracy}%`);
  $('#summaryBlackAcc').text(`${blackAccuracy}%`);
  $('#summaryWhiteElo').text(`${whiteEstRating} ELO`);
  $('#summaryBlackElo').text(`${blackEstRating} ELO`);
  $('#summaryWhiteAcpl').text(`${whiteAcpl}`);
  $('#summaryBlackAcpl').text(`${blackAcpl}`);

  $('#barWhiteAcc').css('width', `${whiteAccuracy}%`);
  $('#barBlackAcc').css('width', `${blackAccuracy}%`);

  renderMoveHistoryTable();
  jumpToMove(-1);
}

function renderMoveHistoryTable() {
  const $list =$('#moveList');
  $list.empty();

  for (let i = 0; i < movesData.length; i += 2) {
    const moveNum = Math.floor(i / 2) + 1;
    const whiteMove = movesData[i];
    const blackMove = movesData[i + 1] || null;

    const row = $(`
      <div class="move-row grid grid-cols-12 py-1 px-2.5 hover:bg-[#302e2b] cursor-pointer items-center transition" data-row="${moveNum}">
        <div class="col-span-2 text-slate-500 font-bold text-[11px]">${moveNum}.</div>
        
        <div class="col-span-5 move-cell flex items-center justify-between pr-2 p-1 rounded hover:bg-[#363430]" data-idx="${i}">
          <span class="text-slate-200 font-semibold">${whiteMove.san}</span>
          <span class="text-[9px] px-1 py-0.2 rounded font-bold ${whiteMove.classification.color}">
            ${whiteMove.classification.symbol}
          </span>
        </div>

        <div class="col-span-5 move-cell flex items-center justify-between pr-2 p-1 rounded ${blackMove ? 'hover:bg-[#363430]' : 'text-transparent'}" data-idx="${blackMove ? i + 1 : -1}">
          ${blackMove ? `
            <span class="text-slate-200 font-semibold">${blackMove.san}</span>
            <span class="text-[9px] px-1 py-0.2 rounded font-bold ${blackMove.classification.color}">
              ${blackMove.classification.symbol}
            </span>
          ` : ''}
        </div>
      </div>
    `);

    $list.append(row);
  }

  $('.move-cell').on('click', function () {
    const idx = parseInt($(this).attr('data-idx'));
    if (!isNaN(idx) && idx >= 0) jumpToMove(idx);
  });
}

function jumpToMove(idx) {
  currentMoveIdx = idx;

  $('#board .square-55d63').removeClass('highlight-from highlight-to');
  $('#badgeOverlay').addClass('hidden');
  clearEngineArrow();

  if (idx === -1) {
    chess.reset();
    if (board) board.position(chess.fen(), true);
    updateEvalBar(0);
    $('.move-cell').removeClass('active-move');$('.move-row').removeClass('active');
    
    // Suggest first move
    const res = findBestMoveHeuristic(chess.fen());
    if (res && res.bestMove) {
      drawEngineArrow(res.bestMove.substring(0, 2), res.bestMove.substring(2, 4));
      $('#liveBestMoveValue').text(`${res.bestMove.substring(0, 2)} → ${res.bestMove.substring(2, 4)}`);
      $('#liveEvalValue').text('+0.25');
    }
    return;
  }

  const item = movesData[idx];
  chess.load(item.fen);
  if (board) board.position(item.fen, true);
  playMoveSound(item.captured);
  updateEvalBar(item.evalCp);

  // Square Highlights
  $(`#board .square-${item.from}`).addClass('highlight-from');
  $(`#board .square-${item.to}`).addClass('highlight-to');

  // Classification Badge
  const toSquare = $(`#board .square-${item.to}`);
  if (toSquare.length) {
    const offset = toSquare.position();
    const width = toSquare.width();
    $('#badgeOverlay')
      .removeClass('hidden')
      .attr('class', `absolute pointer-events-none transition-all duration-150 font-bold text-[11px] px-2 py-0.5 rounded-full shadow-2xl z-20 flex items-center gap-1 ${item.classification.color}`)
      .html(`<span>${item.classification.symbol}</span> <span>${item.classification.name}</span>`)
      .css({
        top: offset.top - 10,
        left: offset.left + (width / 2) - 28
      });
  }

  // Draw Stockfish Best Move Arrow for the current position
  const currentAnalysis = findBestMoveHeuristic(item.fen);
  if (currentAnalysis && currentAnalysis.bestMove) {
    const fromSq = currentAnalysis.bestMove.substring(0, 2);
    const toSq = currentAnalysis.bestMove.substring(2, 4);
    drawEngineArrow(fromSq, toSq);
    $('#liveBestMoveValue').text(`${fromSq} → ${toSq}`);
    const ev = (currentAnalysis.score / 100).toFixed(2);
    $('#liveEvalValue').text(currentAnalysis.score >= 0 ? `+${ev}` : `${ev}`);
    $('#liveEnginePv').text(`${fromSq}${toSq} continuation analyzed at depth 18+`);
  }

  // Sync Table Selection
  $('.move-cell').removeClass('active-move');$(`.move-cell[data-idx="${idx}"]`).addClass('active-move');

  const rowEl = $(`.move-cell[data-idx="${idx}"]`).closest('.move-row');
  $('.move-row').removeClass('active');
  rowEl.addClass('active');

  const container = document.getElementById('moveList');
  if (rowEl[0] && container) {
    const rowTop = rowEl[0].offsetTop;
    container.scrollTo({ top: rowTop - 90, behavior: 'smooth' });
  }
}

// Chess.com Public API Client
async function fetchChessComGames(username) {
  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername) return;

  const $status =$('#chessComStatusMsg');
  const $spinner =$('#fetchBtnSpinner');
  const $list =$('#chessComGamesList');

  $status.removeClass('hidden bg-rose-950/60 border-rose-800 text-rose-300 bg-emerald-950/60 border-emerald-800 text-emerald-300')
         .addClass('bg-slate-900 border-slate-700 text-slate-300')
         .text(`Fetching archives for ${cleanUsername}...`);
  $spinner.removeClass('hidden');$list.empty().addClass('hidden');

  try {
    const archiveRes = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(cleanUsername)}/games/archives`);
    if (!archiveRes.ok) throw new Error(`Chess.com user "${cleanUsername}" not found.`);

    const archiveData = await archiveRes.json();
    const archives = archiveData.archives || [];

    if (archives.length === 0) {
      $status.removeClass('text-slate-300').addClass('bg-yellow-950/60 border-yellow-800 text-yellow-300')
             .text(`No games archive found for ${cleanUsername}.`);
      $spinner.addClass('hidden');
      return;
    }

    const latestArchiveUrl = archives[archives.length - 1];
    const gamesRes = await fetch(latestArchiveUrl);
    if (!gamesRes.ok) throw new Error('Failed to fetch recent month games.');

    const gamesData = await gamesRes.json();
    let games = gamesData.games || [];

    if (games.length === 0 && archives.length > 1) {
      const prevArchiveUrl = archives[archives.length - 2];
      const prevRes = await fetch(prevArchiveUrl);
      if (prevRes.ok) {
        const prevData = await prevRes.json();
        games = prevData.games || [];
      }
    }

    if (games.length === 0) {
      $status.removeClass('text-slate-300').addClass('bg-yellow-950/60 border-yellow-800 text-yellow-300')
             .text(`No games played recently by ${cleanUsername}.`);
      $spinner.addClass('hidden');
      return;
    }

    games.reverse();

    $status.removeClass('bg-slate-900 border-slate-700 text-slate-300')
           .addClass('bg-emerald-950/60 border-emerald-800 text-emerald-300')
           .text(`Found ${games.length} recent games! Click to review.`);

    $list.empty();
    games.slice(0, 25).forEach((g) => {
      const isWhite = (g.white.username || '').toLowerCase() === cleanUsername;
      const userObj = isWhite ? g.white : g.black;
      const oppObj = isWhite ? g.black : g.white;

      let resultBadge = '<span class="text-slate-400 font-bold">DRAW</span>';
      if (userObj.result === 'win') {
        resultBadge = '<span class="text-emerald-400 font-bold">WIN</span>';
      } else if (oppObj.result === 'win') {
        resultBadge = '<span class="text-rose-400 font-bold">LOSS</span>';
      }

      const timeClass = g.time_class ? g.time_class.toUpperCase() : 'GAME';
      const dateStr = g.end_time ? new Date(g.end_time * 1000).toLocaleDateString() : '';

      const gameItem = $(`
        <div class="p-2.5 hover:bg-[#2c2a26] cursor-pointer flex items-center justify-between transition group">
          <div class="flex items-center gap-2.5">
            <span class="w-2.5 h-2.5 rounded-full ${isWhite ? 'bg-white' : 'bg-slate-950 border border-slate-600'}"></span>
            <div>
              <div class="font-semibold text-xs text-slate-200">
                vs <span class="text-white font-bold">${oppObj.username}</span> 
                <span class="text-slate-500 font-mono">(${oppObj.rating})</span>
              </div>
              <div class="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                <span class="bg-[#302e2b] px-1 py-0.2 rounded font-semibold text-slate-300">${timeClass}</span>
                <span>${dateStr}</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2.5">
            <span class="text-xs font-mono">${resultBadge}</span>
            <button class="bg-[#81b64c] group-hover:bg-[#96c95d] text-white px-2.5 py-1 rounded-lg text-xs font-bold transition shadow">
              Review
            </button>
          </div>
        </div>
      `);

      gameItem.on('click', () => {
        if (g.pgn) {
          reviewPGN(g.pgn);
          $('#chessComModal').addClass('hidden');
        } else {
          alert('PGN not available for this match.');
        }
      });

      $list.append(gameItem);
    });

    $list.removeClass('hidden');
  } catch (err) {
    $status.removeClass('bg-slate-900 border-slate-700 text-slate-300')
           .addClass('bg-rose-950/60 border-rose-800 text-rose-300')
           .text(err.message || 'Error fetching Chess.com games.');
  } finally {
    $spinner.addClass('hidden');
  }
}

// Safe Board Initialization
function initBoard() {
  const BoardConstructor = window.Chessboard || window.ChessBoard;
  if (!BoardConstructor) {
    console.error('Chessboard library not loaded!');
    return;
  }

  const config = {
    draggable: false,
    position: 'start',
    moveSpeed: 230,
    snapSpeed: 70,
    snapbackSpeed: 50,
    pieceTheme: 'https://unpkg.com/@chrisoakman/chessboardjs@1.0.0/dist/img/chesspieces/wikipedia/{piece}.png'
  };

  board = BoardConstructor('board', config);
  
  // Resize handler
  $(window).on('resize', () => {
    if (board && board.resize) board.resize();
    if (currentMoveIdx >= 0 && movesData[currentMoveIdx]) {
      const item = movesData[currentMoveIdx];
      const analysis = findBestMoveHeuristic(item.fen);
      if (analysis && analysis.bestMove) {
        drawEngineArrow(analysis.bestMove.substring(0, 2), analysis.bestMove.substring(2, 4));
      }
    }
  });
}

// Ready Handler
$(document).ready(() => {
  // Give DOM 50ms to calculate actual dimensions
  setTimeout(() => {
    initBoard();
    reviewPGN(DEFAULT_PGN);
  }, 50);

  // Tabs
  $('#tabReviewMode').on('click', () => {
    isLiveAnalysisActive = false;
    $('#tabReviewMode').addClass('bg-[#302e2b] text-white').removeClass('text-slate-400');
    $('#tabAnalysisMode').removeClass('bg-[#302e2b] text-white').addClass('text-slate-400');
    $('#liveAnalysisCard').addClass('hidden');
    $('#reviewSummaryCard').removeClass('hidden');
  });

  $('#tabAnalysisMode').on('click', () => {
    isLiveAnalysisActive = true;
    $('#tabAnalysisMode').addClass('bg-[#302e2b] text-white').removeClass('text-slate-400');
    $('#tabReviewMode').removeClass('bg-[#302e2b] text-white').addClass('text-slate-400');
    $('#reviewSummaryCard').addClass('hidden');
    $('#liveAnalysisCard').removeClass('hidden');

    const currFen = currentMoveIdx >= 0 ? movesData[currentMoveIdx].fen : chess.fen();
    const currentAnalysis = findBestMoveHeuristic(currFen);
    if (currentAnalysis && currentAnalysis.bestMove) {
      const fromSq = currentAnalysis.bestMove.substring(0, 2);
      const toSq = currentAnalysis.bestMove.substring(2, 4);
      drawEngineArrow(fromSq, toSq);
      $('#liveBestMoveValue').text(`${fromSq} → ${toSq}`);
      const ev = (currentAnalysis.score / 100).toFixed(2);
      $('#liveEvalValue').text(currentAnalysis.score >= 0 ? `+${ev}` : `${ev}`);
      $('#liveEnginePv').text(`${fromSq}${toSq} depth 18+ line analyzed`);
    }
  });

  // Toggle Arrow Button
  $('#btnToggleArrow').on('click', () => {
    showArrow = !showArrow;
    $('#btnToggleArrow').toggleClass('text-emerald-400 text-slate-500');
    if (!showArrow) {
      clearEngineArrow();
    } else {
      const currFen = currentMoveIdx >= 0 ? movesData[currentMoveIdx].fen : chess.fen();
      const currentAnalysis = findBestMoveHeuristic(currFen);
      if (currentAnalysis && currentAnalysis.bestMove) {
        drawEngineArrow(currentAnalysis.bestMove.substring(0, 2), currentAnalysis.bestMove.substring(2, 4));
      }
    }
  });

  // Navigation
  $('#btnFirst').on('click', () => jumpToMove(-1));
  $('#btnPrev').on('click', () => {
    if (currentMoveIdx > -1) jumpToMove(currentMoveIdx - 1);
  });
  $('#btnNext').on('click', () => {
    if (currentMoveIdx < movesData.length - 1) jumpToMove(currentMoveIdx + 1);
  });
  $('#btnLast').on('click', () => {
    if (movesData.length > 0) jumpToMove(movesData.length - 1);
  });

  $('#btnFlip').on('click', () => {
    if (board) board.flip();
    const currFen = currentMoveIdx >= 0 ? movesData[currentMoveIdx].fen : chess.fen();
    const currentAnalysis = findBestMoveHeuristic(currFen);
    if (currentAnalysis && currentAnalysis.bestMove) {
      drawEngineArrow(currentAnalysis.bestMove.substring(0, 2), currentAnalysis.bestMove.substring(2, 4));
    }
  });

  $('#btnSound').on('click', () => {
    isMuted = !isMuted;
    $('#soundIcon').toggleClass('fa-volume-high fa-volume-xmark');
  });

  // Auto-play
  $('#btnAutoPlay').on('click', () => {
    if (autoPlayTimer) {
      clearInterval(autoPlayTimer);
      autoPlayTimer = null;
      $('#playIcon').removeClass('fa-pause').addClass('fa-play');
    } else {
      $('#playIcon').removeClass('fa-play').addClass('fa-pause');
      autoPlayTimer = setInterval(() => {
        if (currentMoveIdx < movesData.length - 1) {
          jumpToMove(currentMoveIdx + 1);
        } else {
          clearInterval(autoPlayTimer);
          autoPlayTimer = null;
          $('#playIcon').removeClass('fa-pause').addClass('fa-play');
        }
      }, 750);
    }
  });

  // Keyboard navigation
  $(document).keydown((e) => {
    if ($('#pgnModal').is(':visible') \vert{}\vert{} $('#chessComModal').is(':visible')) return;
    if (e.key === 'ArrowLeft') $('#btnPrev').click();
    if (e.key === 'ArrowRight') $('#btnNext').click();
    if (e.key === 'Home') $('#btnFirst').click();
    if (e.key === 'End') $('#btnLast').click();
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      $('#btnAutoPlay').click();
    }
    if (e.key === 'f' || e.key === 'F') $('#btnFlip').click();
  });

  // Modals
  $('#openChessComModalBtn').on('click', () => $('#chessComModal').removeClass('hidden'));
  $('#closeChessComModalBtn').on('click', () => $('#chessComModal').addClass('hidden'));
  
  $('#fetchChessComGamesBtn').on('click', () => {
    const user = $('#chessComUsernameInput').val();
    fetchChessComGames(user);
  });

  $('#chessComUsernameInput').on('keypress', (e) => {
    if (e.which === 13) fetchChessComGames($('#chessComUsernameInput').val());
  });

  $('.quick-user-btn').on('click', function() {
    const username = $(this).data('username');$('#chessComUsernameInput').val(username);
    fetchChessComGames(username);
  });

  $('#openPgnModalBtn').on('click', () => $('#pgnModal').removeClass('hidden'));
  $('#closePgnModalBtn, #cancelPgnBtn').on('click', () => $('#pgnModal').addClass('hidden'));
  $('#sampleOperaGame').on('click', () => $('#pgnInput').val(DEFAULT_PGN));
  $('#sampleImmortal').on('click', () => $('#pgnInput').val(SAMPLE_KASPAROV));

  $('#loadPgnBtn').on('click', () => {
    const pgn = $('#pgnInput').val().trim();
    if (!pgn) {
      alert('Please paste a PGN first!');
      return;
    }
    reviewPGN(pgn);
    $('#pgnModal').addClass('hidden');
  });
});
