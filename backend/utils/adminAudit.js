const AdminAudit = require("../models/AdminAudit");

const logAdminAction = async ({ actorId, action, targetType, targetId, details = {} }) => {
  try {
    await AdminAudit.create({
      actorId,
      action,
      targetType,
      targetId,
      details
    });
  } catch (err) {
    console.error("Admin audit log failed:", err.message);
  }
};

module.exports = { logAdminAction };
