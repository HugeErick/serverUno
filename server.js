const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const path = require("path");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET;

const allowedOrigins = [
	"http://localhost:5173",
	"https://www.nurfurcoxtesten.com",
	"http://localhost:4000",
	"https://server-uno.vercel.app",
	"https://vue-s1.vercel.app",
];

//middlewares
app.use(bodyParser.json());

app.use(
	bodyParser.urlencoded({
		extended: true,
	})
);

app.use(
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

app.use(cookieParser());

const videoPath = path.join(__dirname, "uploads/videos");
app.use(
	"/uploads/videos",
	express.static(videoPath, {
		setHeaders: (res, path, stat) => {
			res.set("Access-Control-Allow-Origin", "*");
		},
	})
);

const verifyJWT = (req, res, next) => {
	const token = req.cookies.session;
	if (!token) {
		return res.status(401).json({ error: "Unauthorized" });
	}

	jwt.verify(token, JWT_SECRET, (err, decoded) => {
		if (err) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		req.user = decoded;
		next();
	});
};

app.use((err, req, res, next) => {
	const statusCode = err.statusCode || 500;
	console.error(err.message, err.stack);
	res.status(statusCode).json({ message: err.message });

	return;
});

app.get("/api/notToday", verifyJWT, (req, res) => {
	const role = req.user.role;
	if (role !== "admin") {
		res.status(403).json({ error: Forbidden });
	} else {
		res.status(200).json({ message: `Hello ${req.user.username}`, role: role });
	}
});

const userRouters = require("./routes/userRoutes");
const videoRouters = require("./routes/videoRoutes");
const jamRoutes = require("./routes/jamRoutes");
app.use("/", userRouters);
app.use("/", videoRouters);
app.use("/", jamRoutes);

app.listen(port, "0.0.0.0", () => {
	console.log(`Server is running on http://localhost:${port}`);
});
