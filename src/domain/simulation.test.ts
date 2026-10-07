import { describe, expect, it } from 'vitest';
import { blankSimulationInput, corporateTax, defaultSimulationInput, employeePayrollCost, householdShares, progressiveIncomeTax, simulate } from './simulation';

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
  it('starts the public form without prefilled financial figures', () => {
    expect(blankSimulationInput.revenue).toBe(0);
    expect(Object.values(blankSimulationInput.expenses).every((value) => value === 0)).toBe(true);
    expect(blankSimulationInput.desiredNetSalary).toBe(0);
    expect(simulate(blankSimulationInput).operatingProfit).toBe(0);
  });

  it('calculates annual payroll from headcount and monthly gross salary', () => {
    expect(employeePayrollCost({ employeeCount: 2, employeeGrossMonthlySalary: 3_000 })).toEqual({
      count: 2,
      annualGross: 72_000,
      employerContributions: 30_240,
      total: 102_240,
    });
  });

  it('reproduces the example operating profit and all comparison scenarios', () => {
    const result = simulate(defaultSimulationInput);
    expect(result.operatingProfit).toBe(92_852);
    expect(result.scenarios.map((scenario) => scenario.id)).toEqual([
      'sasu_is', 'sasu_ir', 'sasu_holding', 'eurl_ir', 'eurl_is',
      'micro_y1_acre', 'micro_y1_no_acre', 'micro_y2_acre', 'micro_y2_no_acre', 'portage',
    ]);
  });

  it('models the ACRE remainder in year two from the creation quarter', () => {
    const result = simulate({ ...defaultSimulationInput, revenue: 60_000, microCreationMonth: 8 });
    const year2Acre = result.scenarios.find((s) => s.id === 'micro_y2_acre')!;
    const year2NoAcre = result.scenarios.find((s) => s.id === 'micro_y2_no_acre')!;
    expect(year2Acre.breakdown.acreMonths).toBe(6);
    expect(year2Acre.socialContributions).toBeLessThan(year2NoAcre.socialContributions);
  });

  it('deducts portage fees and reimbursable professional expenses before salary', () => {
    const result = simulate({
      ...defaultSimulationInput,
      revenue: 100_000,
      portageManagementFeeRate: 7,
      portageProfessionalExpenses: 5_000,
    });
    const portage = result.scenarios.find((s) => s.id === 'portage')!;
    expect(portage.breakdown.managementFees).toBeCloseTo(7_000);
    expect(portage.breakdown.professionalExpenses).toBe(5_000);
    expect(portage.breakdown.grossSalary).toBeGreaterThan(0);
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

  it('applies 18.6% social levies to non-professional SASU IR profit', () => {
    const result = simulate({ ...defaultSimulationInput, sasuIrProfessionalActivity: false });
    const sasuIr = result.scenarios.find((s) => s.id === 'sasu_ir')!;
    expect(sasuIr.socialContributions).toBeCloseTo(result.operatingProfit * 0.186, 2);
    expect(sasuIr.warnings.join(' ')).toContain('18,6 %');
  });
});
