const express = require("express");
const router = express.Router();

router.get("/student", (req, res) => {
  res.json({
    name: "JANITHA JAYASANKA BOMIRIYA",
    studentId: "s224715468"
  });
});

module.exports = router;
