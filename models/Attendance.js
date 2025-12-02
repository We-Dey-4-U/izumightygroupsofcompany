const mongoose = require("mongoose");

// Define the schema for staff attendance
const attendanceSchema = new mongoose.Schema(
  {
    sn: {
      type: Number,
      required: false, // Assigned automatically if needed
    },
   // company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true }, // 🔹 Company isolation
    branch: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
     department: {          // New field for staff department
      type: String,
      required: false,
      trim: true,
    },
    mobileNumber: {
      type: String,
      required: true,
      validate: {
        validator: function (value) {
          // Nigerian mobile format e.g. 07012345678 or +2347012345678
          return /^(0|\+234)[7-9][0-1]\d{8}$/.test(value);
        },
        message: (props) =>
          `${props.value} is not a valid Nigerian mobile number!`,
      },
    },
    privateNote: {
      type: String,
      required: false,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
    },
    timeIn: {
      type: String,
      required: true,
    },
    timeOut: {
      type: String,
      required: false,
    },
    image: {
      type: String,
      required: true, // Store image path or URL
    },
  },
  { timestamps: true }
);

const Attendance = mongoose.model("Attendance", attendanceSchema);

module.exports = Attendance;