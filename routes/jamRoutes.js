const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const cockroachPool = require('../dbCockroachConfig');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { userSchema, pswSchema } = require('../userValidator');
require('dotenv').config();

router.use(bodyParser.json());
router.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET;

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/files');
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage: storage });

router.get('/api/jair', (req, res) => {
  res.send('x controller ok');
});

router.post('/api/jair/add', async (req, res) => {
  const { username, password } = req.body;

  try {
    userSchema.parse({ username });
    pswSchema.parse({ password });
  } catch (validationError) {
		console.log(validationError);
    return res.status(400).json({
      error: 'Validation error'
    });
  }

  try {
    const client = await cockroachPool.connect();
    const result = await client.query('SELECT * FROM nuruser WHERE username = $1', [username]);
    const rows = result.rows;

    if (rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'User not found' });
    }

    await client.query('UPDATE nuruser SET role = $1 WHERE username = $2', ['admin', username]);
    client.release();

    res.status(200).json({ message: 'User role updated to admin' });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/files/upload', upload.single('file'), async (req, res) => {
  const { file } = req;
  const adminId = req.body.admin_id; // Assuming admin_id is sent in the request body

  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const client = await cockroachPool.connect();
    const insertFileQuery = `
      INSERT INTO files (path, filename, filetype, admin_id)
      VALUES ($1, $2, $3, $4)
    `;

    await client.query(insertFileQuery, [file.path, file.filename, file.mimetype, adminId]);
    client.release();

    res.status(200).json({ message: 'File uploaded successfully' });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/files/list', async (req, res) => {
  try {
    const client = await cockroachPool.connect();
    const result = await client.query('SELECT * FROM files');
    client.release();
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

