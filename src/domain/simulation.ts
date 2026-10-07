import { FISCAL_2026, type FiscalConfig } from '../config/fiscal-2026';

export type ExpenseKey =
  | 'employees' | 'vehicle' | 'clientMeals' | 'purchases' | 'software'
  | 'accounting' | 'insurance' | 'rent' | 'telecom' | 'travel' | 'other';

export type SimulationInput = {
  revenue: number;
  expenses: Record<ExpenseKey, number>;
  household: { maritalStatus: 'single' | 'couple'; spouseTaxableIncome: number; children: number };
  desiredNetSalary: number;
  shareCapital: number;
  desiredDividends: number;
  holdingReinvestmentRate: number;
  sasuIrProfessionalActivity: boolean;
  employeeCount: number;
  employeeGrossMonthlySalary: number;
};

export type ScenarioId = 'sasu_is' | 'sasu_ir' | 'sasu_holding' | 'eurl_ir' | 'eurl_is';
export type ScenarioResult = {
  id: ScenarioId;
  label: string;
  personalNet: number;
  socialContributions: number;
  incomeTax: number;
  corporateTax: number;
  capitalLevies: number;
  companyCash: number;
  holdingCash: number;
  protection: { health: string; retirement: string };
  warnings: string[];
  breakdown: Record<string, number>;
};
export type SimulationResult = {
  operatingProfit: number;
  scenarios: ScenarioResult[];
  assumptions: string[];
};

const finite = (value: number) => Number.isFinite(value) ? value : 0;
const money = (value: number) => Math.max(0, value);

export function employeePayrollCost(input: Pick<SimulationInput, 'employeeCount' | 'employeeGrossMonthlySalary'>, config = FISCAL_2026) {
  const count = Math.max(0, Math.floor(finite(input.employeeCount)));
  const annualGross = count * money(finite(input.employeeGrossMonthlySalary)) * 12;
  const employerContributions = annualGross * config.social.employerContributionRate;
  return { count, annualGross, employerContributions, total: annualGross + employerContributions };
}

const expenses = (input: SimulationInput, config: FiscalConfig) => {
  const otherExpenses = Object.entries(input.expenses)
    .filter(([key]) => key !== 'employees')
    .reduce((sum, [, value]) => sum + Math.max(0, finite(value)), 0);
  return otherExpenses + employeePayrollCost(input, config).total;
};

export function corporateTax(profit: number, revenue: number, config = FISCAL_2026): number {
  const taxable = money(profit);
  const c = config.corporateTax;
  if (revenue > c.reducedRateRevenueLimit) return taxable * c.standardRate;
  const reduced = Math.min(taxable, c.reducedLimit);
  return reduced * c.reducedRate + (taxable - reduced) * c.standardRate;
}

export function householdShares(input: SimulationInput['household'], config = FISCAL_2026): number {
  const base = input.maritalStatus === 'couple'
    ? config.householdTax.coupleShares : config.householdTax.singleShares;
  const children = Math.max(0, Math.floor(input.children));
  return base + Math.min(children, 2) * config.householdTax.firstTwoChildrenShare
    + Math.max(0, children - 2) * config.householdTax.laterChildrenShare;
}

export function progressiveIncomeTax(taxableHouseholdIncome: number, shares: number, config = FISCAL_2026): number {
  const quotient = money(taxableHouseholdIncome) / Math.max(1, shares);
  let previous = 0;
  let perShare = 0;
  for (const bracket of config.householdTax.brackets) {
    const slice = Math.max(0, Math.min(quotient, bracket.upTo) - previous);
    perShare += slice * bracket.rate;
    if (quotient <= bracket.upTo) break;
    previous = bracket.upTo;
  }
  return perShare * Math.max(1, shares);
}

function incrementalHouseholdTax(proIncome: number, input: SimulationInput, config: FiscalConfig): number {
  const spouse = money(input.household.spouseTaxableIncome);
  const shares = householdShares(input.household, config);
  return Math.max(0,
    progressiveIncomeTax(spouse + money(proIncome), shares, config)
      - progressiveIncomeTax(spouse, shares, config));
}

function dividendFlow(amount: number, config: FiscalConfig) {
  const gross = money(amount);
  const capitalLevies = gross * config.capital.socialLevies;
  const incomeTax = gross * config.capital.flatIncomeTax;
  return { gross, capitalLevies, incomeTax, net: money(gross - capitalLevies - incomeTax) };
}

const salariedProtection = {
  health: 'Assimilé salarié si rémunération effective',
  retirement: 'Droits ouverts selon le salaire soumis à cotisations',
};
const tnsProtection = {
  health: 'Travailleur non salarié (protection obligatoire, garanties variables)',
  retirement: 'Droits TNS selon le revenu cotisé',
};

export function simulate(input: SimulationInput, config: FiscalConfig = FISCAL_2026): SimulationResult {
  const operatingProfit = money(finite(input.revenue) - expenses(input, config));
  const desiredSalary = money(input.desiredNetSalary);
  const salaryCost = Math.min(operatingProfit, desiredSalary * config.social.sasuEmployerCostPerNetSalary);
  const paidSasuSalary = salaryCost / config.social.sasuEmployerCostPerNetSalary;
  const sasuSocial = money(salaryCost - paidSasuSalary);
  const salaryIr = incrementalHouseholdTax(paidSasuSalary, input, config);

  const sasuTaxable = money(operatingProfit - salaryCost);
  const sasuIs = corporateTax(sasuTaxable, input.revenue, config);
  const sasuAfterIs = money(sasuTaxable - sasuIs);
  const requestedSasuDividend = Math.min(sasuAfterIs, money(input.desiredDividends));
  const sasuDividend = dividendFlow(requestedSasuDividend, config);
  const retainedSasu = money(sasuAfterIs - requestedSasuDividend);

  const sasuIsScenario: ScenarioResult = {
    id: 'sasu_is', label: 'SASU à l’IS',
    personalNet: money(paidSasuSalary - salaryIr) + sasuDividend.net,
    socialContributions: sasuSocial, incomeTax: salaryIr + sasuDividend.incomeTax,
    corporateTax: sasuIs, capitalLevies: sasuDividend.capitalLevies,
    companyCash: retainedSasu, holdingCash: 0, protection: salariedProtection,
    warnings: ['Coût social du salaire estimé par ratio moyen.', 'Dividendes calculés au PFU; l’option au barème n’est pas simulée.'],
    breakdown: { operatingProfit, salaryCost, netSalary: paidSasuSalary, grossDividends: sasuDividend.gross },
  };

  // SASU IR: provisional treatment. Profit is taxed personally; available cash remains in the company
  // until actually withdrawn, but is shown as personal economic net for comparability.
  const sasuIrTax = incrementalHouseholdTax(operatingProfit, input, config);
  const sasuIrSocialRate = input.sasuIrProfessionalActivity
    ? config.social.activityCsgCrdsRate
    : config.capital.socialLevies;
  const sasuIrSocial = operatingProfit * sasuIrSocialRate;
  const sasuIrScenario: ScenarioResult = {
    id: 'sasu_ir', label: 'SASU à l’IR', personalNet: money(operatingProfit - sasuIrTax - sasuIrSocial),
    socialContributions: sasuIrSocial, incomeTax: sasuIrTax, corporateTax: 0, capitalLevies: 0,
    companyCash: 0, holdingCash: 0,
    protection: { health: 'À confirmer selon rémunération et doctrine 2026', retirement: 'Aucun droit supposé sans rémunération cotisée' },
    warnings: [
      input.sasuIrProfessionalActivity
        ? 'Activité professionnelle déclarée: CSG/CRDS sur revenus d’activité estimée à 9,7 %; traitement SASU à l’IR à valider avec l’Urssaf.'
        : 'Activité non professionnelle déclarée: prélèvements sociaux sur revenus du patrimoine de 18,6 % en 2026.',
      'Le bénéfice est imposé même s’il reste en trésorerie.',
      'Option IR temporaire et soumise à conditions.',
    ],
    breakdown: { operatingProfit, taxablePersonalProfit: operatingProfit },
  };

  // Public UI uses a 0–100 percentage. Values in 0–1 are also accepted for API callers.
  const rawReinvestRate = Math.max(0, finite(input.holdingReinvestmentRate));
  const reinvestRate = Math.min(1, rawReinvestRate > 1 ? rawReinvestRate / 100 : rawReinvestRate);
  const holdingDistribution = sasuAfterIs;
  const holdingTax = holdingDistribution * config.holding.parentSubsidiaryTaxableShare * config.holding.holdingTaxRate;
  const availableHolding = money(holdingDistribution - holdingTax);
  const holdingCash = availableHolding * reinvestRate;
  const personalHoldingDividend = dividendFlow(availableHolding - holdingCash, config);
  const holdingScenario: ScenarioResult = {
    id: 'sasu_holding', label: 'SASU à l’IS + holding',
    personalNet: money(paidSasuSalary - salaryIr) + personalHoldingDividend.net,
    socialContributions: sasuSocial, incomeTax: salaryIr + personalHoldingDividend.incomeTax,
    corporateTax: sasuIs + holdingTax, capitalLevies: personalHoldingDividend.capitalLevies,
    companyCash: 0, holdingCash, protection: salariedProtection,
    warnings: ['Régime mère-fille supposé applicable; quote-part de 5 % taxée à 25 %.', 'Frais de structure et conditions juridiques de la holding non inclus.', 'Sortie personnelle de la holding calculée au PFU.'],
    breakdown: { operatingProfit, netSalary: paidSasuSalary, subsidiaryCorporateTax: sasuIs, holdingTax, holdingDistribution },
  };

  const tnsRate = config.social.tnsContributionsPerNetIncome;
  const eurlIrProfessionalIncome = operatingProfit / (1 + tnsRate);
  const eurlIrSocial = money(operatingProfit - eurlIrProfessionalIncome);
  const eurlIrTaxable = eurlIrProfessionalIncome + eurlIrProfessionalIncome * config.social.tnsNonDeductibleCsgShare;
  const eurlIrTax = incrementalHouseholdTax(eurlIrTaxable, input, config);
  const eurlIrScenario: ScenarioResult = {
    id: 'eurl_ir', label: 'EURL à l’IR', personalNet: money(eurlIrProfessionalIncome - eurlIrTax),
    socialContributions: eurlIrSocial, incomeTax: eurlIrTax, corporateTax: 0, capitalLevies: 0,
    companyCash: 0, holdingCash: 0, protection: tnsProtection,
    warnings: ['Cotisations TNS estimées à 45 % du revenu net; régularisation réelle progressive et plafonnée par risque.', 'CSG non déductible estimée réintégrée au revenu imposable.'],
    breakdown: { operatingProfit, professionalIncome: eurlIrProfessionalIncome, taxableProfessionalIncome: eurlIrTaxable },
  };

  const eurlNetSalary = Math.min(desiredSalary, operatingProfit / (1 + tnsRate));
  const eurlSocial = eurlNetSalary * tnsRate;
  const eurlSalaryCost = eurlNetSalary + eurlSocial;
  const eurlTaxable = money(operatingProfit - eurlSalaryCost);
  const eurlIs = corporateTax(eurlTaxable, input.revenue, config);
  const eurlAfterIs = money(eurlTaxable - eurlIs);
  const requestedEurlDividend = input.desiredDividends > 0 ? Math.min(eurlAfterIs, input.desiredDividends) : 0;
  const exemptDividend = Math.min(requestedEurlDividend, money(input.shareCapital) * config.eurl.dividendContributionExemptionCapitalRate);
  const contributedDividend = money(requestedEurlDividend - exemptDividend);
  const dividendTns = contributedDividend * tnsRate;
  const eurlDividendCapital = exemptDividend * config.capital.socialLevies;
  const eurlDividendIr = requestedEurlDividend * config.capital.flatIncomeTax;
  const eurlSalaryIr = incrementalHouseholdTax(eurlNetSalary, input, config);
  const eurlIsScenario: ScenarioResult = {
    id: 'eurl_is', label: 'EURL à l’IS',
    personalNet: money(eurlNetSalary - eurlSalaryIr + requestedEurlDividend - dividendTns - eurlDividendCapital - eurlDividendIr),
    socialContributions: eurlSocial + dividendTns, incomeTax: eurlSalaryIr + eurlDividendIr,
    corporateTax: eurlIs, capitalLevies: eurlDividendCapital,
    companyCash: money(eurlAfterIs - requestedEurlDividend), holdingCash: 0, protection: tnsProtection,
    warnings: ['Cotisations TNS estimées à 45 %.', 'Dividendes excédant 10 % du capital supposés soumis aux cotisations TNS.', 'Prime d’émission et compte courant non renseignés: seuil de 10 % fondé sur le seul capital social.'],
    breakdown: { operatingProfit, netSalary: eurlNetSalary, salaryCost: eurlSalaryCost, grossDividends: requestedEurlDividend, contributedDividend },
  };

  return {
    operatingProfit,
    scenarios: [sasuIsScenario, sasuIrScenario, holdingScenario, eurlIrScenario, eurlIsScenario],
    assumptions: [
      `Paramètres ${config.year}; barème IR provisoire tant que la loi de finances n’est pas publiée.`,
      'Montants annuels, arrondis uniquement à l’affichage.',
      'Comparaison indicative: ni conseil fiscal, ni conseil comptable.',
      'Le taux réduit d’IS suppose que toutes les conditions d’éligibilité sont remplies.',
    ],
  };
}

export const defaultSimulationInput: SimulationInput = {
  revenue: 152_265,
  expenses: {
    employees: 0, vehicle: 8_000, clientMeals: 2_500, purchases: 12_000,
    software: 3_600, accounting: 2_400, insurance: 1_200, rent: 8_400,
    telecom: 1_200, travel: 4_500, other: 15_613,
  },
  household: { maritalStatus: 'couple', spouseTaxableIncome: 17_743, children: 2 },
  desiredNetSalary: 48_000,
  shareCapital: 1_000,
  desiredDividends: 0,
  holdingReinvestmentRate: 100,
  sasuIrProfessionalActivity: true,
  employeeCount: 0,
  employeeGrossMonthlySalary: 0,
};

/** Empty form state used by the public UI. The historical example stays test-only. */
export const blankSimulationInput: SimulationInput = {
  revenue: 0,
  expenses: {
    employees: 0, vehicle: 0, clientMeals: 0, purchases: 0,
    software: 0, accounting: 0, insurance: 0, rent: 0,
    telecom: 0, travel: 0, other: 0,
  },
  household: { maritalStatus: 'single', spouseTaxableIncome: 0, children: 0 },
  desiredNetSalary: 0,
  shareCapital: 0,
  desiredDividends: 0,
  holdingReinvestmentRate: 0,
  sasuIrProfessionalActivity: true,
  employeeCount: 0,
  employeeGrossMonthlySalary: 0,
};
