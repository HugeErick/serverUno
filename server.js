const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const cookieParser = require('cookie-parser');
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

app.use((err, req, res, next) => {
	const statusCode = err.statusCode || 500;
	console.error(err.message, err.stack);
	res.status(statusCode).json({'message' : err.message});

	return;
})

const userRouters = require('./routes/userRoutes');
app.use('/', userRouters);

app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on http://localhost:${port}`);
});


