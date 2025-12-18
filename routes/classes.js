const express = require("express");
const router = express.Router();
const { getClassesSubmissionStatus } = require("../controllers/classesController");

// ✅ API متابعة غياب الفصول
router.get("/submission-status", getClassesSubmissionStatus);

module.exports = router;
