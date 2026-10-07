import { describe, expect, it } from 'vitest';
import { corporateTax, defaultSimulationInput, householdShares, progressiveIncomeTax, simulate } from './simulation';

describe('fiscal calculation primitives', () => {
  it('applies reduced then standard corporate tax', () => {
    expect(corporateTax(42_500, 152_265)).toBe(6_375);
    expect(corporateTax(92_852, 152_265)).toBeCloseTo(18_963, 0);
  });

  it('computes household shares', () => {
    expect(householdShares({ maritalStatus: 'couple', spouseTaxableIncome: 0, children: 2 })).toBe(3);
    expect(householdShares({ maritalStatus: 'single', spouseTaxableIncome: 0, children: 3 })).toBe(3);
  });

  it('applies progressive tax per household share', () => {
    expect(progressiveIncomeTax(30_000, 1)).toBeCloseTo(2_165.48, 2);
    expect(progressiveIncomeTax(30_000, 3)).toBe(0);
  });
});

describe('simulation', () => {
  it('reproduces the example operating profit and all five scenarios', () => {
    const result = simulate(defaultSimulationInput);
    expect(result.operatingProfit).toBe(92_852);
    expect(result.scenarios.map((scenario) => scenario.id)).toEqual([
      'sasu_is', 'sasu_ir', 'sasu_holding', 'eurl_ir', 'eurl_is',
    ]);
  });

  it('never returns negative headline amounts when expenses exceed revenue', () => {
    const result = simulate({
      ...defaultSimulationInput,
      revenue: 1_000,
      expenses: { ...defaultSimulationInput.expenses, other: 500_000 },
    });
    expect(result.operatingProfit).toBe(0);
    for (const scenario of result.scenarios) {
      expect(scenario.personalNet).toBeGreaterThanOrEqual(0);
      expect(scenario.companyCash).toBeGreaterThanOrEqual(0);
      expect(scenario.corporateTax).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps reinvested holding proceeds out of personal net', () => {
    const allReinvested = simulate(defaultSimulationInput).scenarios.find((s) => s.id === 'sasu_holding')!;
    const allDistributed = simulate({ ...defaultSimulationInput, holdingReinvestmentRate: 0 })
      .scenarios.find((s) => s.id === 'sasu_holding')!;
    expect(allReinvested.holdingCash).toBeGreaterThan(0);
    expect(allDistributed.holdingCash).toBe(0);
    expect(allDistributed.personalNet).toBeGreaterThan(allReinvested.personalNet);
  });

  it('subjects EURL IS dividends above 10% of capital to estimated TNS contributions', () => {
    const result = simulate({ ...defaultSimulationInput, desiredDividends: 10_000, shareCapital: 1_000 });
    const eurl = result.scenarios.find((s) => s.id === 'eurl_is')!;
    expect(eurl.breakdown.contributedDividend).toBeGreaterThan(0);
    expect(eurl.socialContributions).toBeGreaterThan(eurl.breakdown.netSalary * 0.45);
  });
});
