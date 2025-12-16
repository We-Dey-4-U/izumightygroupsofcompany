module.exports.computeCITAndTET = ({ assessableProfit, turnover }) => {
  let citRate = 0;

  if (turnover <= 25_000_000) citRate = 0;
  else if (turnover <= 100_000_000) citRate = 0.20;
  else citRate = 0.30;

  const cit = assessableProfit * citRate;
  const tet = assessableProfit * 0.025;

  return {
    assessableProfit,
    citRate,
    cit,
    tet
  };
};