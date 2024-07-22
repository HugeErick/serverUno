const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const pool = require('../dbConfig');
const { userSchema, pswSchema } = require('../userValidator');
const bcrypt = require('bcrypt'); 
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
require('dotenv').config();

router.use(bodyParser.json());
router.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET 

router.get('/', (req, res) => {
  res.send('Users controller ok');
});

router.post('/api/sampledata', (req, res) => {
  const data = req.body;
  console.log('Received data2', data);
  res.json({ message: 'Data2 received successfully', receivedData: data });
});

router.post('/api/caccount', async (req, res) => {
  const { username, password } = req.body;

  try {
    userSchema.parse({ username });
    pswSchema.parse({ password });
  } catch (validationError) {
    return res.status(400).json({
      error: 'Validation error',
      details: validationError.errors.map(err => ({ path: err.path, message: err.message }))
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10); // Hash the password
    const connection = await pool.getConnection();
    const rows = await connection.query('SELECT COUNT(*) AS count FROM user WHERE username = ?', [username]);

    if (rows[0].count > 0) {
      connection.release();
      return res.status(409).json({ error: 'Username already exists' });
    }

    const result = await connection.query(
      'INSERT INTO user (username, password) VALUES (?, ?)',
      [username, hashedPassword]
    );
    connection.release();

    const insertId = result.insertId.toString();

    res.status(201).json({ userId: insertId });
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    userSchema.parse({ username });
    pswSchema.parse({ password });
  } catch (validationError) {
    return res.status(400).json({ error: validationError.errors });
  }

  try {
    const connection = await pool.getConnection();
    const rows = await connection.query('SELECT * FROM user WHERE username = ?', [username]);
    connection.release();

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

		//successfull case
		// Create JWT token with the user's role
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '2d' });
    res.cookie('session', token, { httpOnly: true, secure: false });
    res.status(200).json({ message: 'Login successful', userId: user.id, role: user.role });
		} catch (error) {
			console.error('Error logging in:', error);
			res.status(500).json({ error: 'Internal Server Error' });
		}
});

router.get('/api/renewsession', (req, res) => {
  const token = req.cookies.session;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const newToken = jwt.sign({ userId: decoded.userId, role: decoded.role }, JWT_SECRET, { expiresIn: '2d' });
    res.cookie('session', newToken, { httpOnly: true, secure: false });

    res.json({ message: 'Cookie renewed' });
  });
});

router.post('/api/logout',(req, res) => {
	res.clearCookie('session');
	res.status(200).json({
		message : 'Logout successful'
	});
});


module.exports = router;
