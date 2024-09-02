const pool = require("./dbCockroachConfig");

const runSomeQueries = async () => {
	const client = await pool.connect();
	try {
		// Queries here
		console.log("hi query");
	} catch (err) {
		console.error("Error", err);
	} finally {
		client.release();
	}
};

module.exports = runSomeQueries;
