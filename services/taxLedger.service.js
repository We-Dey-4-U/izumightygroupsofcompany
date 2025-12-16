const CompanyTaxLedger = require("../models/CompanyTaxLedger");

async function recordTax({
  companyId,
  taxType,
  period,
  basisAmount,
  rate,
  taxAmount,
  source,
  sourceRefs = [],
  computedBy
}) {
  return CompanyTaxLedger.create({
    companyId,
    taxType,
    period,
    basisAmount,
    rate,
    taxAmount,
    source,
    sourceRefs,
    auditTrail: {
      computedBy
    }
  });
}

async function markAsRemitted({ companyId, period, receiptNo }) {
  return CompanyTaxLedger.updateMany(
    { companyId, period, taxType: "PAYE", remitted: false },
    {
      remitted: true,
      remittanceDate: new Date(),
      firsReceiptNo: receiptNo
    }
  );
}

module.exports = {
  recordTax,
  markAsRemitted
};