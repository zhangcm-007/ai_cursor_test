/**
 * 必须在任何使用 process.env 的模块之前执行，确保 .env 已加载。
 * index.ts 第一个 import 必须是本文件。
 */
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
