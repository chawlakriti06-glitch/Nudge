import { handleVercel } from "../server/vercel-handler.mjs";
export default async function handler(req, res) {
  return handleVercel(req, res, "/api/models");
}
