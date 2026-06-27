import { getUserFromRequest } from "@/lib/auth";
import { listComplaints } from "@/lib/complaints";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  const actor = await getUserFromRequest(req);
  if (!actor || actor.role !== "customer") {
    return res.status(403).json({ success: false, message: "Customer access required." });
  }

  try {
    const result = await listComplaints({
      actor,
      customerOnly: true,
      page: req.query.page,
      pageSize: req.query.pageSize,
      filters: {
        search: req.query.search,
        status: req.query.status,
      },
    });
    return res.status(200).json({ success: true, complaints: result.rows, ...result });
  } catch (err) {
    console.error("Customer complaints error:", err);
    return res.status(400).json({ success: false, message: err.message || "Failed to load complaints." });
  }
}
