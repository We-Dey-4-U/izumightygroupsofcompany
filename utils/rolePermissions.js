const rolePermissions = {
  ADMIN: ["manage_staff", "view_sales", "create_sale"],
  STAFF: [], // Staff no longer has create_sale by default
  SUB_ADMIN: ["view_sales"],
  FREELANCER: [], // Freelancers also no longer have create_sale by default
  SUPER_STAKEHOLDER: [
    "assign_roles",
    "manage_staff",
    "view_sales",
    "create_sale"
  ]
};