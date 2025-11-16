const mongoose = require("mongoose");

const EmployeeInfoSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // each staff submits onc
    },

    // -----------------------------
    // PERSONAL INFORMATION
    // -----------------------------
    personal: {
      fullName: String,
      gender: String,
      maritalStatus: String,
      stateOfOrigin: String,
      dateOfBirth: Date,
      nationality: String,
    },

    // -----------------------------
    // CONTACT DETAILS
    // -----------------------------
    contact: {
      address: String,
      phoneNumber: String,
      email: String,
    },

    // -----------------------------
    // NEXT OF KIN
    // -----------------------------
    nextOfKin: {
      fullName: String,
      relationship: String,
      phoneNumber: String,
      address: String,
    },

    // -----------------------------
    // EMPLOYMENT DETAILS
    // -----------------------------
    employment: {
      position: String,
      department: String,
      dateOfEmployment: Date,
      employmentType: {
        type: String,
        enum: ["full-time", "contract", "hybrid"],
        required: true,
      },
    },

    // -----------------------------
    // EDUCATIONAL BACKGROUND
    // -----------------------------
    education: {
      highestQualification: String,
      otherCertificates: String,
    },

    // -----------------------------
    // IDENTIFICATION DETAILS
    // Employee ID + Image
    // -----------------------------
    identification: {
      idType: String,
      idNumber: String,
      expiryDate: Date,
      meansOfIdImage: {
        type: String, // store Appwrite URL
        required: false,
      },
    },

    // -----------------------------
    // BANK DETAILS
    // -----------------------------
    bank: {
      bankName: String,
      accountName: String,
      accountNumber: String,
    },

    // -----------------------------
    // GUARANTOR INFO
    // -----------------------------
   // GUARANTOR INFO
guarantor: {
  fullName: String,
  relationship: String,
  identification: {
    idType: String,
    idNumber: String,
    expiryDate: Date,
    meansOfIdImage: {
      type: String, // store Appwrite URL
      required: false,
    },
  },
  passport: {
    type: String, // store Appwrite URL
    required: false,
  },
  address: String,
  phoneNumber: String,
},
    // -----------------------------
    // EMPLOYEE PASSPORT
    // -----------------------------
    employeePassport: {
      type: String, // store Appwrite URL
      required: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("EmployeeInfo", EmployeeInfoSchema);