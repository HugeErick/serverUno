const mariadb = require('mariadb');
require('dotenv').config();

const pool = mariadb.createPool({
	host : 'localhost',
	user : 'massiveAnalizer',
	password : process.env.DBPSW,
	database : 'sample',
	connectionLimit : 5
});

// module.exports = pool;
