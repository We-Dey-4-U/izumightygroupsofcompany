module.exports.calculateProfit = ({
  revenue = 0,
  allowableExpenses = 0,
  nonAllowableExpenses = 0
}) => {
  const grossProfit = revenue - allowableExpenses - nonAllowableExpenses;

  return {
    assessableProfit: Math.max(grossProfit, 0),
    revenue,
    allowableExpenses,
    nonAllowableExpenses
  };
};