const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const cockroachPool = require('../dbCockroachConfig');
const { userSchema, pswSchema } = require('../userValidator');
const bcrypt = require('bcrypt'); 
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
require('dotenv').config();

router.use(bodyParser.json());
router.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET;

router.get('/api/jair', (req, res) => {
  res.send('x controller ok');
});

router.post('/api/jair/add', async (req, res) => {
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
    // Fetch the user by username
    const client = await cockroachPool.connect();
    const result = await client.query('SELECT * FROM nuruser WHERE username = $1', [username]);
    const rows = result.rows;

    if (rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'User not found' });
    }

    // Update the user's role to admin
    await client.query('UPDATE nuruser SET role = $1 WHERE username = $2', ['admin', username]);
    client.release();

    res.status(200).json({ message: 'User role updated to admin' });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

