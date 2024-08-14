const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mysql = require('mysql');
const nodemailer = require('nodemailer');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
app.set('view engine', 'ejs');

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 1 day in milliseconds
    }
}));

// MySQL database connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect(err => {
    if (err) {
        console.error('Error connecting to the database:', err);
    } else {
        console.log('Connected to MySQL database');
    }
});

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Serve signup page
app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

// Handle sign-up
app.post('/signup', (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if the email or username already exists
    const checkQuery = 'SELECT * FROM users WHERE email = ? OR username = ?';
    db.query(checkQuery, [email, username], (err, results) => {
        if (err) {
            console.error('Error checking user in the database:', err);
            return res.status(500).json({ message: 'Database error' });
        }

        if (results.length > 0) {
            return res.status(400).json({ message: 'Email or username already in use' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000); // Generate OTP

        // Store OTP in session
        req.session.otp = otp;
        req.session.email = email;
        req.session.username = username;
        req.session.password = password;

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Your OTP Code',
            text: `Your OTP code is ${otp}`
        };

        transporter.sendMail(mailOptions, (err, info) => {
            if (err) {
                console.error('Error sending OTP email:', err);
                return res.status(500).json({ message: 'Error sending OTP' });
            }

            console.log('OTP sent:', info.response);
            res.json({ message: 'OTP sent successfully' });
        });
    });
});

// Handle OTP verification
app.post('/verify-otp', (req, res) => {
    const { otp } = req.body;

    if (!otp) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    // Verify OTP
    if (parseInt(otp) === req.session.otp) {
        // Insert user into the database
        const query = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
        db.query(query, [req.session.username, req.session.email, req.session.password], (err, result) => {
            if (err) {
                console.error('Error inserting user into database:', err);
                return res.status(500).json({ message: 'Error saving user to database' });
            }

            console.log('User saved:', result);
            res.json({ message: 'User registered successfully' });
        });
    } else {
        res.status(400).json({ message: 'Invalid OTP' });
    }
});

// Middleware to check authentication
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.redirect('/login-signup');
}

// Serve login/signup page
app.get('/login-signup', (req, res) => {
    res.render('login-signup', { title: 'Login-Signup Page', user: req.session.user });
});

// Handle login
app.post('/login', (req, res) => {
    const { usernameOrEmail, password } = req.body;

    if (!usernameOrEmail || !password) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    // Query the database for user credentials
    const query = 'SELECT * FROM users WHERE email = ? OR username = ?';
    db.query(query, [usernameOrEmail, usernameOrEmail], (err, results) => {
        if (err) {
            console.error('Error querying database:', err);
            return res.status(500).json({ message: 'Database error' });
        }

        if (results.length === 0) {
            return res.status(400).json({ message: 'Invalid username or email' });
        }

        const user = results[0];

        if (user.password !== password) {
            return res.status(400).json({ message: 'Incorrect password' });
        }

        // Set session with user data
        req.session.user = user;

        console.log('User session:', req.session.user); // Debugging output

        // Send JSON response
        res.json({ message: 'Login successful' });
    });
});

// Serve game page
app.get('/game', isAuthenticated, (req, res) => {
    res.render('index', { title: 'Game Page', user: req.session.user });
});

// Handle logout
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).json({ message: 'Error logging out' });
        }
        res.redirect('/login-signup'); // Redirect to login-signup after logout
    });
});

// Game logic
let players = {};
let board = Array(9).fill(null);
let currentPlayer = 'X';
let gameActive = true; // Track if the game is active

// Function to check the winner and return the result
function checkWinner(board) {
    const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];

    for (const pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return { winner: board[a], pattern };
        }
    }

    return board.includes(null) ? null : { winner: 'Draw' };
}

// Function to reset the game state
function resetGame() {
    board = Array(9).fill(null);
    currentPlayer = 'X';
    gameActive = true; // Game is active when reset
}

io.on('connection', (socket) => {
    // Assign player symbol and start game if there are 2 players
    if (Object.keys(players).length < 2) {
        const playerSymbol = Object.keys(players).length === 0 ? 'X' : 'O';
        players[socket.id] = playerSymbol;
        socket.emit('player-assignment', playerSymbol);

        if (Object.keys(players).length === 2) {
            io.emit('start-game', { board, currentPlayer });
        }
    } else {
        socket.emit('reset-game');
    }

    // Handle player making a move
    socket.on('make-move', (index) => {
        if (board[index] === null && players[socket.id] === currentPlayer && gameActive) {
            board[index] = currentPlayer;
            const result = checkWinner(board);

            if (result) {
                gameActive = false; // Game is no longer active
                io.emit('game-over', { winner: result.winner, pattern: result.pattern, board });
            } else {
                currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
                io.emit('move-made', { board, currentPlayer });
            }
        }
    });

    // Handle new game request
    socket.on('new-game', () => {
        resetGame();
        io.emit('start-game', { board, currentPlayer });
    });

    // Handle player disconnection
    socket.on('disconnect', () => {
        delete players[socket.id];
        if (Object.keys(players).length < 2) {
            resetGame();
            io.emit('reset-game');
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
