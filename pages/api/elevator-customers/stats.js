import { getUserFromRequest } from "@/lib/auth";
import { createCustomerStatsHandler } from "@/lib/customerStatsHandler";
import { query } from "@/lib/db";

export default createCustomerStatsHandler({ getUserFromRequest, query });
