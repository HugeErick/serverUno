const express = require('express');
const cors = require('cors');

const app =  express();
const port = process.env.PORT || 4000;

//middlewares
app.use(express.json());
app.use(cors());

app.get('/', (req, res) => {
	res.json({'message': 'ok'});
})

app.post('/api/data', (req, res) => {
	const data = req.body;
	console.log('Received data', data);
	res.json({ message: 'Data received successfully', receivedData: data });
});


app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on http://localhost:${port}`);
});


