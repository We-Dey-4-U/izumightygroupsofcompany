// utils/firstTaxCalculator.js
const TaxSettings = require("../models/TaxSettings");

// -----------------------------------------------------
// NHF (2.5% default)
// -----------------------------------------------------
function computeNHF(gross, rate = 2.5) {
  return Number(((gross * rate) / 100).toFixed(2));
}

// -----------------------------------------------------
// NHIS Employee (5%) & NHIS Employer (10%)
// -----------------------------------------------------
function computeNHISEmployee(gross, rate = 5) {
  return Number(((gross * rate) / 100).toFixed(2));
}

function computeNHISEmployer(gross, rate = 10) {
  return Number(((gross * rate) / 100).toFixed(2));
}

// -----------------------------------------------------
// CRA = Higher of (20% of Gross) OR (1% of Gross + ₦200,000)
// -----------------------------------------------------
function computeCRA(gross, craReliefPercent = 20, fixedReliefAnnual = 200000) {
  const relief1 = (craReliefPercent / 100) * gross;
  const relief2 = (0.01 * gross) + (fixedReliefAnnual / 12);
  return Number(Math.max(relief1, relief2).toFixed(2));
}

// -----------------------------------------------------
// PAYE Progressive Tax (Nigeria)
// -----------------------------------------------------
function computePAYE(taxable) {
  let remaining = taxable;
  let paye = 0;

  const bands = [
    { limit: 30000, rate: 0.07 },
    { limit: 30000, rate: 0.11 },
    { limit: 50000, rate: 0.15 },
    { limit: 50000, rate: 0.19 },
    { limit: 50000, rate: 0.21 },
    { limit: Infinity, rate: 0.24 },
  ];

  for (const band of bands) {
    if (remaining <= 0) break;
    const portion = Math.min(remaining, band.limit);
    paye += portion * band.rate;
    remaining -= portion;
  }

  return Number(paye.toFixed(2));
}

// -----------------------------------------------------
// MAIN MASTER FUNCTION
// -----------------------------------------------------
async function computeAllTaxes(gross, pension = 0, others = 0, companyId) {
  const settings = await TaxSettings.findOne({ company: companyId }) || {
    nhfRate: 2.5,
    nhisEmployee: 5,
    nhisEmployer: 10,
    craRelief: 20,
    fixedReliefAnnual: 200000
  };

  // NHF & NHIS
  const nhf = computeNHF(gross, settings.nhfRate);
  const nhisEmployee = computeNHISEmployee(gross, settings.nhisEmployee);
  const nhisEmployer = computeNHISEmployer(gross, settings.nhisEmployer);

  // CRA
  const cra = computeCRA(gross, settings.craRelief, settings.fixedReliefAnnual);

  // Taxable Income
  let taxableIncome = gross - nhf - nhisEmployee - cra;
  taxableIncome = Math.max(0, taxableIncome);

  // PAYE
  const paye = computePAYE(taxableIncome);

  // Net Pay
  const netPay =
    gross -
    (nhf + nhisEmployee + paye + Number(pension) + Number(others));

  return {
    grossSalary: gross,
    nhf,
    nhisEmployee,
    nhisEmployer,
    cra,
    taxableIncome: Number(taxableIncome.toFixed(2)),
    paye,
    pension: Number(pension),
    otherDeductions: Number(others),
    netPay: Number(netPay.toFixed(2)),
  };
}

module.exports = {
  computeNHF,
  computeNHISEmployee,
  computeNHISEmployer,
  computeCRA,
  computePAYE,
  computeAllTaxes,
};