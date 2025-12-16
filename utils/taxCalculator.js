const TaxSettings = require("../models/TaxSettings");

/**
 * Compute taxes (PAYE and taxable income)
 * Supports:
 * - STANDARD_PAYE (Nigeria PAYE bands)
 * - CUSTOM_PERCENT (state-based or negotiated PAYE)
 *
 * Returns { taxableIncome, paye }
 */
async function computeTaxes(
  grossSalary,
  nhfDeduction = 0,
  nhisEmployeeDeduction = 0,
  companyId
) {
  const settings = await TaxSettings.findOne({ companyId });
  if (!settings) {
    throw new Error(`Tax settings not found for company ${companyId}`);
  }

  /* ===========================
     CUSTOM PERCENT MODE
     =========================== */
  if (settings.mode === "CUSTOM_PERCENT") {
    const paye = grossSalary * (settings.customPercent / 100);
    return {
      taxableIncome: grossSalary,
      paye: Math.max(0, paye),
    };
  }

  /* ===========================
     STANDARD PAYE MODE
     =========================== */

  const nhfRate = settings.nhfRate ?? 0.025; // 2.5%
  const craMin = settings.craMin ?? 200000; // annual
  const fixedReliefAnnual = settings.fixedReliefAnnual ?? 200000; // annual

  if (!nhfDeduction) {
    nhfDeduction = grossSalary * nhfRate;
  }

  let taxableIncome =
    grossSalary -
    nhfDeduction -
    (craMin / 12) -
    (fixedReliefAnnual / 12);

  taxableIncome = Math.max(0, taxableIncome);

  // Nigeria PAYE monthly bands
  const bands = [
    { limit: 300000, rate: 0.07 },
    { limit: 300000, rate: 0.11 },
    { limit: 500000, rate: 0.15 },
    { limit: 500000, rate: 0.19 },
    { limit: 1600000, rate: 0.21 },
    { limit: Infinity, rate: 0.24 },
  ];

  let remaining = taxableIncome;
  let paye = 0;

  for (const band of bands) {
    if (remaining <= 0) break;
    const portion = Math.min(remaining, band.limit);
    paye += portion * band.rate;
    remaining -= portion;
  }

  return {
    taxableIncome,
    paye: Math.max(0, paye),
  };
}

/**
 * Wrapper for backward compatibility
 */
async function computePAYE(
  grossSalary,
  nhfDeduction = 0,
  nhisEmployeeDeduction = 0,
  companyId
) {
  const result = await computeTaxes(
    grossSalary,
    nhfDeduction,
    nhisEmployeeDeduction,
    companyId
  );
  return result.paye;
}

module.exports = { computeTaxes, computePAYE };