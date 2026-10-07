import { describe, expect, it } from 'vitest';
import { annualRevenue, blankSimulationInput, corporateTax, defaultSimulationInput, employeePayrollCost, householdShares, progressiveIncomeTax, recommendScenario, simulate } from './simulation';

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

  it('calculates annual turnover from the daily rate and billed days when selected', () => {
    expect(annualRevenue({ revenue: 80_000, revenueInputMode: 'daily_rate', dailyRate: 650, billableDays: 210 })).toBe(136_500);
    expect(annualRevenue({ revenue: 80_000, revenueInputMode: 'turnover', dailyRate: 650, billableDays: 210 })).toBe(80_000);
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

  it('recommends only among the scenarios selected by the user', () => {
    const result = simulate(defaultSimulationInput);
    const selected = result.scenarios.filter(s => ['sasu_is', 'eurl_is'].includes(s.id));
    const recommendation = recommendScenario(selected, 'personal_net', defaultSimulationInput);
    expect(selected.map(s => s.id)).toContain(recommendation?.id);
    expect(recommendation?.personalNet).toBe(Math.max(...selected.map(s => s.personalNet)));
  });

  it('uses retained company and holding cash for the reinvestment objective', () => {
    const result = simulate(defaultSimulationInput);
    const recommendation = recommendScenario(result.scenarios, 'reinvestment', defaultSimulationInput);
    const retained = (scenario: (typeof result.scenarios)[number]) => scenario.companyCash + scenario.holdingCash;
    expect(retained(recommendation!)).toBe(Math.max(...result.scenarios.map(retained)));
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

  it('lets the user run SASU without salary while preserving a separate EURL remuneration', () => {
    const result = simulate({
      ...defaultSimulationInput,
      sasuSalaryEnabled: false,
      sasuDesiredNetSalary: 48_000,
      desiredNetSalary: 48_000,
    });
    const sasu = result.scenarios.find((s) => s.id === 'sasu_is')!;
    const eurl = result.scenarios.find((s) => s.id === 'eurl_is')!;
    expect(sasu.breakdown.netSalary).toBe(0);
    expect(sasu.socialContributions).toBe(0);
    expect(eurl.breakdown.netSalary).toBe(48_000);
  });

  it('models a non-deductible president salary in SASU IR and keeps 18.6% levies on the full profit', () => {
    const noSalary = simulate({
      ...defaultSimulationInput,
      revenue: 100_000,
      expenses: Object.fromEntries(Object.keys(defaultSimulationInput.expenses).map(key => [key, 0])) as typeof defaultSimulationInput.expenses,
      household: { maritalStatus: 'single', spouseTaxableIncome: 0, children: 0 },
      sasuSalaryEnabled: false,
      sasuDesiredNetSalary: 0,
    }).scenarios.find((scenario) => scenario.id === 'sasu_ir')!;
    const withSalary = simulate({
      ...defaultSimulationInput,
      revenue: 100_000,
      expenses: Object.fromEntries(Object.keys(defaultSimulationInput.expenses).map(key => [key, 0])) as typeof defaultSimulationInput.expenses,
      household: { maritalStatus: 'single', spouseTaxableIncome: 0, children: 0 },
      sasuSalaryEnabled: true,
      sasuDesiredNetSalary: 20_000,
    }).scenarios.find((scenario) => scenario.id === 'sasu_ir')!;

    expect(withSalary.breakdown.taxablePersonalProfit).toBe(100_000);
    expect(withSalary.breakdown.profitSocialLevies).toBe(18_600);
    expect(withSalary.breakdown.netSalary).toBe(20_000);
    expect(withSalary.breakdown.salaryCost).toBe(36_400);
    expect(withSalary.socialContributions).toBe(35_000);
    expect(withSalary.incomeTax).toBe(noSalary.incomeTax);
    expect(withSalary.personalNet).toBe(noSalary.personalNet - 16_400);
  });

  it('applies 18.6% social levies directly to SASU IR profit without a qualification question', () => {
    const result = simulate({
      ...defaultSimulationInput,
      sasuSalaryEnabled: false,
      sasuDesiredNetSalary: 0,
    });
    const sasuIr = result.scenarios.find((s) => s.id === 'sasu_ir')!;
    expect(sasuIr.breakdown.profitSocialLevies).toBeCloseTo(result.operatingProfit * 0.186, 2);
    expect(sasuIr.socialContributions).toBeCloseTo(result.operatingProfit * 0.186, 2);
    expect(sasuIr.warnings.join(' ')).toContain('18,6 %');
  });
});
