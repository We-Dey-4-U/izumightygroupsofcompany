const mongoose = require("mongoose");

const EmployeeInfoSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    // -----------------------------
    // PERSONAL INFORMATION
    // -----------------------------
    personal: {
      type: {
        fullName: { type: String, required: true },
        gender: { type: String, required: true },
        maritalStatus: { type: String, required: true },
        stateOfOrigin: { type: String, required: true },
        dateOfBirth: { type: Date, required: true },
        nationality: { type: String, required: true },
      },
      required: true,
    },

    // -----------------------------
    // CONTACT DETAILS
    // -----------------------------
    contact: {
      type: {
        address: { type: String, required: true },
        phoneNumber: { type: String, required: true },
        email: { type: String, required: true },
      },
      required: true,
    },

    // -----------------------------
    // NEXT OF KIN
    // -----------------------------
    nextOfKin: {
      type: {
        fullName: { type: String, required: true },
        relationship: { type: String, required: true },
        phoneNumber: { type: String, required: true },
        address: { type: String, required: true },
      },
      required: true,
    },

    // -----------------------------
    // EMPLOYMENT DETAILS
    // -----------------------------
    employment: {
      type: {
        position: { type: String, required: true },
        department: { type: String, required: true },
        dateOfEmployment: { type: Date, required: true },
        employmentType: {
          type: String,
          enum: ["full-time", "contract", "hybrid"],
          required: true,
        },
      },
      required: true,
    },

    // -----------------------------
    // EDUCATIONAL BACKGROUND
    // -----------------------------
    education: {
      type: {
        highestQualification: { type: String, required: true },
        otherCertificates: { type: String, required: true },
      },
      required: true,
    },

    // -----------------------------
    // IDENTIFICATION DETAILS
    // -----------------------------
    identification: {
      type: {
        idType: { type: String, required: true },
        idNumber: { type: String, required: true },
        expiryDate: { type: Date, required: true },
        meansOfIdImage: { type: String, required: true }, // Appwrite URL
      },
      required: true,
    },

    // -----------------------------
    // BANK DETAILS
    // -----------------------------
    bank: {
      type: {
        bankName: { type: String, required: true },
        accountName: { type: String, required: true },
        accountNumber: { type: String, required: true },
      },
      required: true,
    },

    // -----------------------------
    // GUARANTOR INFO
    // -----------------------------
    guarantor: {
      type: {
        fullName: { type: String, required: true },
        relationship: { type: String, required: true },

        identification: {
          idType: { type: String, required: true },
          idNumber: { type: String, required: true },
          expiryDate: { type: Date, required: true },
          meansOfIdImage: { type: String, required: true },
        },

        passport: { type: String, required: true }, // Appwrite URL
        address: { type: String, required: true },
        phoneNumber: { type: String, required: true },
      },
      required: true,
    },

    // -----------------------------
    // EMPLOYEE PASSPORT
    // -----------------------------
    employeePassport: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("EmployeeInfo", EmployeeInfoSchema);