const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const cockroachPool = require('../dbCockroachConfig');
const { userSchema, pswSchema } = require('../userValidator');
const bcrypt = require('bcrypt'); 
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');

const oauth2Client = new OAuth2Client();

router.use(bodyParser.json());
router.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET 

router.get('/', (req, res) => {
  res.send('Users controller ok');
});

router.post('/auth', async (req, res) => {
  try {
    const code = req.headers.authorization;

    // Exchange the authorization code for an access token
    const response = await axios.post(
      'https://oauth2.googleapis.com/token',
      {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET, 
        redirect_uri: 'postmessage',
        grant_type: 'authorization_code'
      }
    );
    const accessToken = response.data.access_token;
    // Fetch user details using the access token
    const userResponse = await axios.get(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );
    const userDetails = userResponse.data;
		if (userDetails) console.log('google ok');

    // Check if user exists in the database
    const client = await cockroachPool.connect();
    const result = await client.query('SELECT * FROM nuruser WHERE email = $1', [userDetails.email]);

    let user;
    if (result.rows.length > 0) {
      user = result.rows[0];
    } else {
      // If user does not exist, create a new user
      const insertResult = await client.query(
        'INSERT INTO nuruser (username, email, google_id) VALUES ($1, $2, $3) RETURNING *',
        [userDetails.name, userDetails.email, userDetails.sub]
      );
      user = insertResult.rows[0];
    }

    client.release();
    res.status(200).json(userDetails);
  } catch (error) {
    console.error('Error during Google login:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
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
    const client = await cockroachPool.connect(); // Get a client connection
    const result = await client.query('SELECT COUNT(*) AS count FROM nuruser WHERE username = $1', [username]);

    if (result.rows[0].count > 0) {
      client.release();
      return res.status(409).json({ error: 'Username already exists' });
    }

    const insertResult = await client.query(
      'INSERT INTO nuruser (username, password) VALUES ($1, $2) RETURNING id',
      [username, hashedPassword]
    );
    client.release();

    const insertId = insertResult.rows[0].id;

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
    const client = await cockroachPool.connect(); // Get a client connection
    const result = await client.query('SELECT * FROM nuruser WHERE username = $1', [username]);
    client.release();

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ username: username, role: user.role }, JWT_SECRET, { expiresIn: '2d' });
    res.cookie('session', token, { httpOnly: true, secure: false });
    res.status(200).json({ message: 'Login successful', username: username, role: user.role });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/api/renewsession', async (req, res) => {
  const sessionCookie = req.cookies.session;
  if (sessionCookie) {
    try {
      const decoded = jwt.verify(sessionCookie, JWT_SECRET);
      const newToken = jwt.sign({ username: decoded.username, role: decoded.role }, JWT_SECRET, { expiresIn: '2d' });
      res.cookie('session', newToken, { httpOnly: true, secure: false });
      return res.status(200).json({ message: 'Session renewed' });
    } catch (error) {
      return res.status(401).json({ error: 'Invalid session' });
    }
  } else {
    const code = req.headers.authorization;
    if (code) {
      try {
        const response = await axios.post(
          'https://oauth2.googleapis.com/token',
          {
            code,
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: 'postmessage',
            grant_type: 'authorization_code'
          }
        );
        const accessToken = response.data.access_token;
        const userResponse = await axios.get(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          {
            headers: { Authorization: `Bearer ${accessToken}` }
          }
        );
        const userDetails = userResponse.data;

        const client = await cockroachPool.connect();
        const result = await client.query('SELECT * FROM nuruser WHERE email = $1', [userDetails.email]);
        client.release();

        if (result.rows.length > 0) {
          const user = result.rows[0];
          const newToken = jwt.sign({ userId: user.username, role: user.role }, JWT_SECRET, { expiresIn: '2d' });
          res.cookie('session', newToken, { httpOnly: true, secure: false });
          return res.status(200).json({ message: 'Session renewed' });
        }
      } catch (error) {
        return res.status(401).json({ error: 'Google authentication failed' });
      }
    } else {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
});

router.get('/api/fixtokens', (req, res) => {
  const username = req.query.username; 
  if (!username) {
    return res.status(400).send({ message: 'Username is required' });
  }
  
  const payload = {
    username: username, 
    role: 'user'
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '2d' });

  res.cookie('session', token, { httpOnly: true, secure: false });

  res.status(200).send({ message: 'Session token created' });
});

router.get('/api/logout', (req, res) => {
	res.clearCookie('session');
  res.status(200).json({ message: 'Logout successful' });
});

module.exports = router;

