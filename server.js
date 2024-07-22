const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const app =  express();
const port = process.env.PORT || 4000;

//middlewares
app.use(bodyParser.json());
app.use(
	bodyParser.urlencoded({
		extended : true,
	})
);
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET

app.use('/uploads/videos', express.static(path.join(__dirname, 'uploads/videos')));

// JWT verification middleware
const verifyJWT = (req, res, next) => {
const token = req.cookies.session;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.user = decoded;
    next();
  });
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

app.use((err, req, res, next) => {
	const statusCode = err.statusCode || 500;
	console.error(err.message, err.stack);
	res.status(statusCode).json({'message' : err.message});

	return;
});

app.get('/api/protected', verifyJWT, (req, res) => {
  res.json({ message: `Hello user ${req.userId}`, role: req.user.role });
});

const userRouters = require('./routes/userRoutes');
const videoRouters = require('./routes/videoRoutes');
app.use('/', userRouters);
app.use('/', videoRouters);

app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on http://localhost:${port}`);
});


