const socket = io();

let playerSymbol;
let currentPlayer;
let gameOver = false; // Track if the game is over

const cells = Array.from(document.querySelectorAll('.cell'));
const playerDisplay = document.getElementById('player');
const statusDisplay = document.getElementById('status');
const newGameButton = document.getElementById('new-game-button');
const drawDisplay = document.getElementById('draw');

socket.on('player-assignment', (symbol) => {
    playerSymbol = symbol;
    playerDisplay.textContent = `You are Player ${playerSymbol}`;
    statusDisplay.textContent = 'Waiting for another player...';
    localStorage.setItem('playerSymbol', symbol); // Persist player symbol
});

socket.on('start-game', (data) => {
    currentPlayer = data.currentPlayer;
    gameOver = false; // Reset gameOver when a new game starts
    statusDisplay.textContent = `Player ${currentPlayer}'s turn`;
    updateBoard(data.board);
    newGameButton.classList.remove('visible'); // Hide button at the start of a new game
});

socket.on('move-made', (data) => {
    currentPlayer = data.currentPlayer;
    statusDisplay.textContent = `Player ${currentPlayer}'s turn`;
    updateBoard(data.board, data.lastMove);
});

socket.on('game-over', (data) => {
    updateBoard(data.board);  // Ensure the board reflects the latest move
    gameOver = true; // Set gameOver to true when the game is over
    if (data.winner === 'Draw') {
        statusDisplay.textContent = 'Game Draw!';
        drawDisplay.style.display = 'flex';
    } else {
        statusDisplay.textContent = `Player ${data.winner} wins!`;
        highlightWinningCells(data.pattern, data.winner);
    }
    newGameButton.classList.add('visible'); // Show the button when the game is over
});

socket.on('reset-game', () => {
    playerDisplay.textContent = 'Assigning player...';
    statusDisplay.textContent = 'Waiting for players...';
    resetBoard();
    gameOver = false; // Reset gameOver when a new game starts
    newGameButton.classList.remove('visible'); // Hide button when game is reset
    localStorage.removeItem('playerSymbol'); // Clear player symbol from localStorage
});

newGameButton.addEventListener('click', () => {
    if (gameOver) {
        socket.emit('new-game');
    }
});

cells.forEach((cell, index) => {
    cell.addEventListener('click', () => {
        if (!cell.textContent && currentPlayer === playerSymbol && !gameOver) {
            socket.emit('make-move', index);
        }
    });
});

function updateBoard(board, lastMove) {
    board.forEach((symbol, index) => {
        const cellElement = cells[index];
        cellElement.textContent = symbol;
        updateCellClasses(cellElement, symbol, index === lastMove);
    });
}

function updateCellClasses(cell, symbol, isLastMove) {
    cell.classList.remove('winner', 'loser', 'x', 'o', 'last-move');
    if (symbol === 'X') {
        cell.classList.add('x');
    } else if (symbol === 'O') {
        cell.classList.add('o');
    }
    if (isLastMove) {
        cell.classList.add('last-move');
    }
}

function resetBoard() {
    cells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('x', 'o', 'winner', 'loser', 'last-move');
    });
    drawDisplay.style.display = 'none';
}

function highlightWinningCells(pattern, winner) {
    pattern.forEach(index => {
        const cell = cells[index];
        cell.classList.add(winner === playerSymbol ? 'winner' : 'loser');
    });
}

// Check for existing player role in localStorage
window.onload = () => {
    const storedPlayerSymbol = localStorage.getItem('playerSymbol');
    if (storedPlayerSymbol) {
        playerSymbol = storedPlayerSymbol;
        playerDisplay.textContent = `You are Player ${storedPlayerSymbol}`;
    }
};
