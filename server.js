const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app =  express();
const port = process.env.PORT || 4000;

//middlewares
app.use(bodyParser.json());
app.use(
	bodyParser.urlencoded({
		extended : true,
	})
);
app.use(cors());

app.get('/', (req, res) => {
	res.json({'message': 'ok'});
})

app.use((err, req, res, next) => {
	const statusCode = err.statusCode || 500;
	console.error(err.message, err.stack);
	res.status(statusCode).json({'message' : err.message});

	return;
})

app.post('/api/data', (req, res) => {
	const data = req.body;
	console.log('Received data2', data);
	res.json({ message: 'Data2 received successfully', receivedData: data });
});


app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on http://localhost:${port}`);
});


