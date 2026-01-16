// middleware/sanitize.js
const escapeHtml = (str) => {
  if (typeof str !== "string") return str;

  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const sanitizeBody = (fields = []) => {
  return (req, res, next) => {
    if (!req.body) return next();

    fields.forEach((field) => {
      if (req.body[field]) {
        req.body[field] = escapeHtml(req.body[field]);
      }
    });

    next();
  };
};

module.exports = sanitizeBody;