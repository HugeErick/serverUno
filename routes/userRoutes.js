const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
const cockroachPool = require("../dbCockroachConfig");
const { userSchema, pswSchema } = require("../userValidator");
const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
require("dotenv").config();

router.use(bodyParser.json());
router.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET;

router.get("/", (req, res) => {
	res.send("Users controller ok");
});

router.post("/api/caccount", async (req, res) => {
	const { username, password } = req.body;

	try {
		userSchema.parse({ username });
		pswSchema.parse({ password });
	} catch (validationError) {
		return res.status(400).json({
			error: "Validation error",
			details: validationError.errors.map((err) => ({
				path: err.path,
				message: err.message,
			})),
		});
	}

	try {
		const hashedPassword = await bcrypt.hash(password, 10);
		const client = await cockroachPool.connect();
		const result = await client.query(
			"SELECT COUNT(*) AS count FROM nuruser WHERE username = $1",
			[username]
		);

		if (result.rows[0].count > 0) {
			client.release();
			return res.status(409).json({ error: "Username already exists" });
		}

		const insertResult = await client.query(
			"INSERT INTO nuruser (username, password) VALUES ($1, $2) RETURNING id",
			[username, hashedPassword]
		);
		client.release();

		const insertId = insertResult.rows[0].id;

		res.status(201).json({ userId: insertId });
	} catch (error) {
		console.error("Error creating account:", error);
		res.status(500).json({ error: "Internal Server Error" });
	}
});

router.post("/api/login", async (req, res) => {
	const { username, password } = req.body;

	try {
		userSchema.parse({ username });
		pswSchema.parse({ password });
	} catch (validationError) {
		return res.status(400).json({ error: validationError.errors });
	}

	try {
		const client = await cockroachPool.connect();
		const result = await client.query(
			"SELECT * FROM nuruser WHERE username = $1",
			[username]
		);
		client.release();

		if (result.rows.length === 0) {
			return res.status(401).json({ message: "Invalid username or password" });
		}

		const user = result.rows[0];
		const isPasswordValid = await bcrypt.compare(password, user.password);

		if (!isPasswordValid) {
			return res.status(401).json({ message: "Invalid username or password" });
		}

		const token = jwt.sign(
			{ username: username, role: user.role },
			JWT_SECRET,
			{ expiresIn: "2d" }
		);

		res.cookie("session", token, { httpOnly: true, secure: false });
		res.status(200).json({
			message: "Login successful",
			username: username,
			role: user.role,
		});
	} catch (error) {
		console.error("Error logging in:", error);
		res.status(500).json({ error: "Internal Server Error" });
	}
});

router.get("/api/renewsession", async (req, res) => {
	const sessionCookie = req.cookies.session;
	if (sessionCookie) {
		try {
			const decoded = jwt.verify(sessionCookie, JWT_SECRET);
			const newToken = jwt.sign(
				{ username: decoded.username, role: decoded.role },
				JWT_SECRET,
				{ expiresIn: "2d" }
			);
			res.cookie("session", newToken, { httpOnly: true, secure: false });
			return res.status(200).json({ message: "Session renewed" });
		} catch (error) {
			return res.status(401).json({ error: "Invalid session" });
		}
	}
});

router.post("/api/jair/add", async (req, res) => {
	const { username } = req.body;
	try {
		userSchema.parse({ username });
	} catch (validationError) {
		console.log(validationError);
		return res.status(400).json({
			error: "Validation error",
		});
	}

	try {
		const client = await cockroachPool.connect();
		const result = await client.query(
			"SELECT * FROM nuruser WHERE username = $1",
			[username]
		);
		const rows = result.rows;

		if (rows.length === 0) {
			client.release();
			return res.status(404).json({ error: "User not found" });
		}

		await client.query("UPDATE nuruser SET role = $1 WHERE username = $2", [
			"admin",
			username,
		]);
		client.release();

		res.status(200).json({ message: "User role updated" });
	} catch (error) {
		console.error("Error updating user role:", error);
		res.status(500).json({ error: "Internal server error" });
	}
});


router.get("/api/obtainrole", (req, res) => {
	const sessionCookie = req.cookies.session;
	if (!sessionCookie) {
		return res.status(401).json({ message: "No session found" });
	}

	try {
		const decoded = jwt.verify(sessionCookie, JWT_SECRET);
		const { username, role } = decoded;
		return res.status(200).json({ username, role });
	} catch (error) {
		return res.status(401).json({ error: "Invalid session" });
	}
});

router.get("/api/logout", (req, res) => {
	res.clearCookie("session");
	res.status(200).json({ message: "Logout successful" });
});

module.exports = router;
