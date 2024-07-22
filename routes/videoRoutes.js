const express = require('express');
const router = express.Router();
const pool = require('../dbConfig');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
	  let uploadPath = path.join(__dirname, '..',  'uploads', 'videos');
		uploadPath = path.normalize(uploadPath);
    fs.mkdirSync(uploadPath, { recursive: true }); // Ensure the directory exists
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

router.get('/vid/control', (req, res) => {
  res.send('video router ok ', uploadPath);
});

router.post('/vid/uploadvideo', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const videoPath = req.file.path;
  const productionPath = path.relative(path.join(__dirname, '..'), videoPath);
  const filename = req.file.filename;

  try {
    const connection = await pool.getConnection();
    const result = await connection.query(
      'INSERT INTO videos (path, productionPath, filename) VALUES (?, ?, ?)',
      [videoPath, productionPath, filename]
    );
    connection.release();

    res.status(201).json({ message: 'Video uploaded successfully', videoId: result.insertId.toString() });
  } catch (error) {
    console.error('Error saving video path to database:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/vid/list', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT * FROM videos');
    connection.release();

    res.json(rows);
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/vid/getname', async (req, res) => {
  const { videoId } = req.body;

  if (!videoId) {
    return res.status(400).json({ error: 'Video ID is required' });
  }

  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT filename FROM videos WHERE id = ?', [videoId]);
    connection.release();

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const videoFilename = rows.filename;
    console.log(videoFilename);

    if (!videoFilename) {
      return res.status(404).json({ error: 'Video filename not found' });
    }

    res.json({ videoFilename });
  } catch (error) {
    console.error('Error fetching video filename:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


router.get('/vid/:videofilename', async (req, res) => {
  const videoFilename = req.params.videofilename;
  const videoId  = req.query.videoId;

  if (!videoId) {
    return res.status(400).json({ error: 'Video ID is required' });
  }

  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT * FROM videos WHERE id = ? AND filename = ?', [videoId, videoFilename]);
    connection.release();

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Video not found or filename does not match the ID' });
    }

    const videoPath = rows.path;
    res.sendFile(path.resolve(videoPath));
  } catch (error) {
    console.error('Error fetching video:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


module.exports = router;

