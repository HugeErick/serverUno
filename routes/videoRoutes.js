const express = require("express");
const cors = require("cors");
const router = express.Router();
const cockroachPool = require("../dbCockroachConfig");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { default: axios } = require("axios");

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		let uploadPath = path.join(__dirname, "..", "uploads", "videos");
		uploadPath = path.normalize(uploadPath);
		fs.mkdirSync(uploadPath, { recursive: true });
		cb(null, uploadPath);
	},
	filename: (req, file, cb) => {
		cb(null, `${Date.now()}-${file.originalname}`);
	},
});

const upload = multer({ storage });

const allowedOrigins = [
	"http://localhost:5173",
	"https://www.nurfurcoxtesten.com",
	"http://localhost:4000",
	"https://server-uno.vercel.app",
	"https://vue-s1.vercel.app",
];

router.use(
	cors({
		origin: function (origin, callback) {
			if (!origin || allowedOrigins.includes(origin)) {
				callback(null, true);
			} else {
				callback(new Error("Not allowed by CORS"));
			}
		},
		credentials: true,
	})
);

router.get("/api/vid/control", (req, res) => {
	res.send("video router ok");
});

router.post(
	"/api/vid/uploadvideo",
	upload.single("video"),
	async (req, res) => {
		if (!req.file) {
			return res.status(400).json({ error: "No file uploaded" });
		}

		const videoPath = req.file.path;
		const productionPath = path.relative(path.join(__dirname, ".."), videoPath);
		const filename = req.file.filename;

		try {
			const client = await cockroachPool.connect();
			const result = await client.query(
				"INSERT INTO videos (path, productionPath, filename) VALUES ($1, $2, $3) RETURNING id",
				[videoPath, productionPath, filename]
			);
			client.release();

			await axios.get("http://localhost:4000/api/vid/integrity-check");

			res.status(201).json({
				message: "Video uploaded successfully",
				videoId: result.rows[0].id,
			});
		} catch (error) {
			console.error("Error saving video path to database:", error);
			res.status(500).json({ error: "Internal Server Error" });
		}
	}
);

router.get("/api/vid/list", async (req, res) => {
	try {
		const client = await cockroachPool.connect();
		const result = await client.query("SELECT filename FROM videos");
		client.release();

		const filenames = result.rows.map((row) => row.filename);
		res.json(filenames);
	} catch (error) {
		console.error("Error fetching video filenames:", error);
		res.status(500).json({ error: "Internal Server Error" });
	}
});

router.get("/api/vid/integrity-check", async (req, res) => {
	const videoDirectory = path.join(__dirname, "..", "uploads", "videos");
	let actualFiles = [];

	try {
		actualFiles = fs.readdirSync(videoDirectory);
	} catch (error) {
		return res.status(500).json({ error: "Could not read video directory" });
	}

	try {
		const client = await cockroachPool.connect();
		const result = await client.query("SELECT filename FROM videos");
		const dbFiles = result.rows.map((row) => row.filename);

		// Find files that are missing in the database but exist on disk
		const missingInDb = actualFiles.filter((file) => !dbFiles.includes(file));

		// Find files that are in the database but no longer exist on disk
		const missingOnDisk = dbFiles.filter((file) => !actualFiles.includes(file));

		// Add missing files to the database
		for (const filename of missingInDb) {
			const videoPath = path.join(videoDirectory, filename);
			const productionPath = path.relative(
				path.join(__dirname, ".."),
				videoPath
			);

			await client.query(
				"INSERT INTO videos (path, productionPath, filename) VALUES ($1, $2, $3)",
				[videoPath, productionPath, filename]
			);
		}

		// Remove files from the database that no longer exist on disk
		for (const filename of missingOnDisk) {
			await client.query("DELETE FROM videos WHERE filename = $1", [filename]);
		}

		client.release();

		res.status(200).json({
			message: "Integrity check completed",
			missingInDb,
			missingOnDisk,
		});
	} catch (error) {
		console.error("Error during video integrity check:", error);
		res.status(500).json({ error: "Internal Server Error" });
	}
});

router.get("/api/vid/:videofilename", async (req, res) => {
	const videoFilename = req.params.videofilename;

	try {
		const client = await cockroachPool.connect();
		const result = await client.query(
			"SELECT * FROM videos WHERE filename = $1",
			[videoFilename]
		);
		client.release();

		if (result.rows.length === 0) {
			return res.status(404).json({ error: "Video not found" });
		}

		const videoPath = result.rows[0].path;
		res.sendFile(path.resolve(videoPath));
	} catch (error) {
		console.error("Error fetching video:", error);
		res.status(500).json({ error: "Internal Server Error" });
	}
});

router.delete("/api/vid/del/:videofilename", async (req, res) => {
	const videoFilename = req.params.videofilename;

	const videoDirectory = path.join(__dirname, "..", "uploads", "videos");
	const videoPath = path.join(videoDirectory, videoFilename);

	try {
		if (fs.existsSync(videoPath)) {
			fs.unlinkSync(videoPath);

			const deleteQuery =
				"DELETE FROM public.videos WHERE filename = $1 RETURNING *";
			const result = await pool.query(deleteQuery, [videoFilename]);

			if (result.rowCount > 0) {
				await axios.post("http://localhost:5173/api/integrity-check");

				res.status(200).json({ message: "Video deleted successfully." });
			} else {
				res.status(404).json({ message: "Video not found in the database." });
			}
		} else {
			res.status(404).json({ message: "Video not found on disk." });
		}
	} catch (error) {
		console.error("Error deleting video:", error);
		res
			.status(500)
			.json({ message: "Failed to delete video.", error: error.message });
	}
});

module.exports = router;
