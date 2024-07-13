const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const pool = require('../dbConfig');
const { userSchema, pswSchema } = require('../userValidator');
const bcrypt = require('bcrypt'); 
const cookieParser = require('cookie-parser');

router.use(bodyParser.json());
router.use(cookieParser());

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
    return res.status(400).json({ error: validationError.errors });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10); // Hash the password
    const connection = await pool.getConnection();
    const rows = await connection.query('SELECT COUNT(*) AS count FROM users WHERE username = ?', [username]);

    if (rows[0].count > 0) {
      connection.release();
      return res.status(409).json({ error: 'Username already exists' });
    }

    const result = await connection.query(
      'INSERT INTO users (username, password) VALUES (?, ?)',
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
    const rows = await connection.query('SELECT * FROM users WHERE username = ?', [username]);
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
		res.cookie('session', { userId: user.id }, {httpOnly: true , secure: process.env.NODE_ENV === 'production'})
    res.status(200).json({ message: 'Login successful', userId: user.id });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
