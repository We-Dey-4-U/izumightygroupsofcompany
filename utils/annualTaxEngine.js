function computeCITAndTET({ assessableProfit, turnover }) {
  const citRate =
    turnover <= 25_000_000 ? 0 :
    turnover <= 100_000_000 ? 0.20 : 0.30;

  return {
    cit: assessableProfit * citRate,
    tet: assessableProfit * 0.025
  };
}

module.exports = { computeCITAndTET };