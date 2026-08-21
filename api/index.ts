import express, { type Express } from "express";
import cors from "cors";
import router from "../artifacts/api-server/src/routes/index.js";

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Handle routes under both /api and root
app.use("/api", router);
app.use("/", router);

export default app;
