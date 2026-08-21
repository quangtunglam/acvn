import type { Request, Response } from "express";

export default function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  res.status(200).json({
    status: "ok",
    version: "2026-v5-native-serverless",
    time: new Date().toISOString(),
    dbConnected: Boolean(process.env.DATABASE_URL),
  });
}
