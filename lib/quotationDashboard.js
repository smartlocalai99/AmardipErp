export function getQuotationDashboardCard(user, hasBoqPermission = false) {
  if (!user) {
    return { visible: false, title: "", subtitle: "", buttonText: "", secondaryText: "", pills: [], variant: "banner" };
  }

  if (user.role === "front_office") {
    return {
      visible: true,
      title: "Generated Quotations",
      subtitle: "View generated quotations and share them with customers.",
      buttonText: "View Quotations",
      secondaryText: "Generated quotations only",
      pills: ["View Only", "WhatsApp Share"],
      variant: "banner",
    };
  }

  if (user.role === "superadmin" || (["admin", "manager"].includes(user.role) && hasBoqPermission)) {
    return {
      visible: true,
      title: "Create Lift Quotation",
      subtitle: "Prepare BOQ pricing and share quotation to customer on WhatsApp.",
      buttonText: "Create Quotation",
      secondaryText: "BOQ pricing enabled",
      pills: ["BOQ Enabled", "WhatsApp Share", "Rate Master"],
      variant: "banner",
    };
  }

  return { visible: false, title: "", subtitle: "", buttonText: "", secondaryText: "", pills: [], variant: "banner" };
}
