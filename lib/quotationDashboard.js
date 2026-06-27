export function getQuotationDashboardCard(user, hasBoqPermission = false) {
  if (!user) {
    return { visible: false, buttonText: "", secondaryText: "" };
  }

  if (user.role === "front_office") {
    return {
      visible: true,
      buttonText: "View Quotations",
      secondaryText: "Generated quotations only",
    };
  }

  if (user.role === "superadmin" || (["admin", "manager"].includes(user.role) && hasBoqPermission)) {
    return {
      visible: true,
      buttonText: "Create Quotation",
      secondaryText: "BOQ pricing enabled",
    };
  }

  return { visible: false, buttonText: "", secondaryText: "" };
}
