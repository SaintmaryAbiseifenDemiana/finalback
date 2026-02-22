const express = require("express");
const cors = require("cors");
require("dotenv").config();
require("./db");

const app = express();
app.use(cors());
app.use(express.json());

// ✅ ربط الروتس
app.use("/api/attendance", require("./routes/attendance"));
app.use("/api/families", require("./routes/families"));
app.use("/api/users", require("./routes/users"));
app.use("/api/serviced/search", require("./routes/serviced-search"));
app.use("/api/serviced/transfer", require("./routes/serviced-transfer"));
app.use("/api/serviced", require("./routes/serviced"));
app.use("/api/servants", require("./routes/servants"));
app.use("/api/import-servants", require("./routes/import-servants"));
app.use("/api/import-serviced", require("./routes/import-serviced"));
app.use("/api/monthly-attendance", require("./routes/monthly-attendance"));
app.use("/api/monthly-attendance-get", require("./routes/monthly-attendance-get"));
app.use("/api/monthly-reports", require("./routes/monthly-reports"));
app.use("/api/monthly-reports-quarter", require("./routes/monthly-reports-quarter"));
app.use("/api/reports/attendance", require("./routes/reports-attendance"));
app.use("/api/reports/performance", require("./routes/reports-servant-performance"));
app.use("/api/servants-count", require("./routes/servants-with-serviced-count"));
app.use("/api/admin/monthly-serviced", require("./routes/monthly-serviced"));
app.use("/api/login", require("./routes/login"));
app.use("/api/monthly-attendance-summary", require("./routes/monthly-attendance-summary"));




// ✅ تشغيل السيرفر
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
