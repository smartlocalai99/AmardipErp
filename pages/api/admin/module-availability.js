import { getUserFromRequest } from "@/lib/auth";
import { getModuleAvailability } from "@/lib/moduleAvailability";

const BLOCKED_ROLES = new Set(["customer", "worker", "storekeeper"]);
const CACHE_TTL_MS = 60 * 1000;

let cachedModules = null;
let cachedAt = 0;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    const user = await getUserFromRequest(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    if (BLOCKED_ROLES.has(user.role)) {
      return res.status(403).json({
        success: false,
        message: "Not allowed",
      });
    }

    if (cachedModules && Date.now() - cachedAt < CACHE_TTL_MS) {
      return res.status(200).json({
        success: true,
        modules: cachedModules,
      });
    }

    cachedModules = await getModuleAvailability();
    cachedAt = Date.now();

    return res.status(200).json({
      success: true,
      modules: cachedModules,
    });
  } catch (error) {
    console.error("Failed to load module availability:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load module availability",
    });
  }
}
