import { FISCAL_2026, type FiscalConfig } from '../config/fiscal-2026';

export type ExpenseKey =
  | 'employees' | 'vehicle' | 'clientMeals' | 'purchases' | 'software'
  | 'accounting' | 'insurance' | 'rent' | 'telecom' | 'travel' | 'other';

export type SimulationInput = {
  revenue: number;
  revenueInputMode: 'turnover' | 'daily_rate';
  dailyRate: number;
  billableDays: number;
  expenses: Record<ExpenseKey, number>;
  household: { maritalStatus: 'single' | 'couple'; spouseTaxableIncome: number; children: number };
  desiredNetSalary: number;
  sasuSalaryEnabled: boolean | null;
  sasuDesiredNetSalary: number;
  shareCapital: number;
  desiredDividends: number;
  holdingReinvestmentRate: number;
  employeeCount: number;
  employeeGrossMonthlySalary: number;
  microActivity: 'sales' | 'bic_services' | 'bnc';
  microCreationMonth: number;
  portageManagementFeeRate: number;
  portageProfessionalExpenses: number;
};

export type ScenarioId =
  | 'sasu_is' | 'sasu_ir' | 'sasu_holding' | 'eurl_ir' | 'eurl_is'
  | 'micro_y1_acre' | 'micro_y1_no_acre' | 'micro_y2_acre' | 'micro_y2_no_acre'
  | 'portage';
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

export type RecommendationConfidence = 'forte' | 'modérée' | 'faible';

export type ScenarioRecommendation = {
  scenario: ScenarioResult;
  runnerUp: ScenarioResult | null;
  confidence: RecommendationConfidence;
  score: number;
  scoreGap: number;
  reasons: string[];
  tradeoffs: string[];
};

const protectionScore = (scenario: ScenarioResult, input: SimulationInput) => {
  if (scenario.id === 'portage') return 4;
  if (scenario.id === 'sasu_is' || scenario.id === 'sasu_ir' || scenario.id === 'sasu_holding') return input.sasuSalaryEnabled && input.sasuDesiredNetSalary > 0 ? 3 : 1;
  if (scenario.id === 'eurl_ir' || scenario.id === 'eurl_is') return 2;
  if (scenario.id.startsWith('micro_')) return 1.5;
  return 1;
};

const simplicityScore = (scenario: ScenarioResult) => {
  if (scenario.id.startsWith('micro_')) return 4;
  if (scenario.id === 'eurl_ir' || scenario.id === 'portage') return 3;
  if (scenario.id === 'sasu_holding') return 1;
  return 2;
};

const formatAdviceMoney = (value: number) => `${Math.round(value).toLocaleString('fr-FR')} €`;

export function recommendScenario(scenarios: ScenarioResult[], input: SimulationInput): ScenarioRecommendation | null {
  if (scenarios.length === 0) return null;
  const maxPersonal = Math.max(1, ...scenarios.map(s => s.personalNet));
  const maxRetained = Math.max(1, ...scenarios.map(s => s.companyCash + s.holdingCash));
  const maxEconomicValue = Math.max(1, ...scenarios.map(s => s.personalNet + s.companyCash + s.holdingCash));
  const wantsHoldingReinvestment = input.holdingReinvestmentRate >= 50
    && scenarios.some(scenario => scenario.id === 'sasu_holding');
  const wantsSalaryProtection = Boolean(input.sasuSalaryEnabled && input.sasuDesiredNetSalary > 0)
    || input.desiredNetSalary > 0;
  const weights = wantsHoldingReinvestment
    ? { personal: 0.22, retained: 0.28, economic: 0.2, protection: 0.1, fit: 0.15, simplicity: 0.05 }
    : wantsSalaryProtection
      ? { personal: 0.35, retained: 0.15, economic: 0.22, protection: 0.2, fit: 0.03, simplicity: 0.05 }
      : { personal: 0.4, retained: 0.15, economic: 0.25, protection: 0.1, fit: 0.05, simplicity: 0.05 };
  const structureFit = (scenario: ScenarioResult) => {
    if (wantsHoldingReinvestment) return scenario.id === 'sasu_holding' ? 1 : 0.25;
    if (wantsSalaryProtection && protectionScore(scenario, input) >= 3) return 1;
    return 0.5;
  };
  const score = (scenario: ScenarioResult) => {
    const retained = scenario.companyCash + scenario.holdingCash;
    const economicValue = scenario.personalNet + retained;
    const invalidScenarioPenalty = scenario.warnings.some(warning => /supérieur au seuil|titre d’alerte/i.test(warning)) ? 0.45 : 1;
    return 100 * invalidScenarioPenalty * (
      scenario.personalNet / maxPersonal * weights.personal
      + retained / maxRetained * weights.retained
      + economicValue / maxEconomicValue * weights.economic
      + protectionScore(scenario, input) / 4 * weights.protection
      + structureFit(scenario) * weights.fit
      + simplicityScore(scenario) / 4 * weights.simplicity
    );
  };
  const ranked = [...scenarios].sort((left, right) => score(right) - score(left));
  const scenario = ranked[0];
  const runnerUp = ranked[1] ?? null;
  const scenarioScore = score(scenario);
  const scoreGap = runnerUp ? scenarioScore - score(runnerUp) : scenarioScore;
  const confidence: RecommendationConfidence = scoreGap >= 12 ? 'forte' : scoreGap >= 5 ? 'modérée' : 'faible';
  const retained = scenario.companyCash + scenario.holdingCash;
  const maxProtection = Math.max(...scenarios.map(candidate => protectionScore(candidate, input)));
  const reasons: string[] = [];

  if (maxPersonal <= 1) {
    reasons.push('Aucune sortie personnelle n’a été demandée : le conseil privilégie donc le capital conservé et sa destination.');
  } else if (scenario.personalNet >= maxPersonal * 0.98) {
    reasons.push(`Il offre le meilleur net personnel estimé, soit ${formatAdviceMoney(scenario.personalNet)} par an.`);
  } else {
    reasons.push(`Il préserve ${formatAdviceMoney(scenario.personalNet)} de net personnel tout en améliorant les autres critères.`);
  }
  if (retained > 0 && retained >= maxRetained * 0.95) {
    reasons.push(`Il conserve ${formatAdviceMoney(retained)} de trésorerie dans la société ou la holding.`);
  }
  if (wantsHoldingReinvestment && scenario.id === 'sasu_holding') {
    reasons.push(`Votre souhait de réinvestir ${Math.round(input.holdingReinvestmentRate)} % correspond directement à une trésorerie logée dans la holding.`);
  }
  if (protectionScore(scenario, input) === maxProtection && maxProtection >= 3) {
    reasons.push('Il fait partie des options offrant la meilleure protection sociale estimée avec la rémunération saisie.');
  }
  if (reasons.length < 2) {
    reasons.push(`Sa valeur économique estimée atteint ${formatAdviceMoney(scenario.personalNet + retained)}, net personnel et trésorerie cumulés.`);
  }

  const tradeoffs = scenario.warnings.slice(0, 2);
  if (runnerUp && confidence === 'faible') {
    tradeoffs.unshift(`L’écart avec ${runnerUp.label} est faible : les hypothèses doivent être confirmées avant décision.`);
  }
  return { scenario, runnerUp, confidence, score: scenarioScore, scoreGap, reasons, tradeoffs };
}

const finite = (value: number) => Number.isFinite(value) ? value : 0;
const money = (value: number) => Math.max(0, value);

export function employeePayrollCost(input: Pick<SimulationInput, 'employeeCount' | 'employeeGrossMonthlySalary'>, config = FISCAL_2026) {
  const count = Math.max(0, Math.floor(finite(input.employeeCount)));
  const annualGross = count * money(finite(input.employeeGrossMonthlySalary)) * 12;
  const employerContributions = annualGross * config.social.employerContributionRate;
  return { count, annualGross, employerContributions, total: annualGross + employerContributions };
}

export function annualRevenue(input: Pick<SimulationInput, 'revenue' | 'revenueInputMode' | 'dailyRate' | 'billableDays'>) {
  if (input.revenueInputMode === 'daily_rate') {
    return money(finite(input.dailyRate)) * Math.max(0, Math.floor(finite(input.billableDays)));
  }
  return money(finite(input.revenue));
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

function microScenario(
  id: ScenarioId,
  label: string,
  input: SimulationInput,
  socialRate: number,
  acreMonths: number,
  config: FiscalConfig,
): ScenarioResult {
  const activity = config.micro.activities[input.microActivity];
  const revenue = annualRevenue(input);
  const actualExpenses = expenses(input, config);
  const contributions = revenue * socialRate;
  const cfp = revenue * activity.cfpRate;
  const taxableIncome = revenue * (1 - activity.taxAllowance);
  const incomeTax = incrementalHouseholdTax(taxableIncome, input, config);
  const overLimit = revenue > activity.revenueLimit;
  return {
    id,
    label,
    personalNet: money(revenue - actualExpenses - contributions - cfp - incomeTax),
    socialContributions: contributions + cfp,
    incomeTax,
    corporateTax: 0,
    capitalLevies: 0,
    companyCash: 0,
    holdingCash: 0,
    protection: tnsProtection,
    warnings: [
      `Cotisations calculées sur 100 % du CA encaissé; les charges réelles ne sont pas déductibles du revenu micro-fiscal.`,
      `Abattement fiscal forfaitaire de ${Math.round(activity.taxAllowance * 100)} % (${activity.label}).`,
      ...(acreMonths > 0 ? [`ACRE appliquée sur ${acreMonths} mois, en supposant un CA uniforme sur l’année.`] : []),
      ...(overLimit ? [`CA supérieur au seuil micro 2026 de ${activity.revenueLimit.toLocaleString('fr-FR')} €: scénario affiché à titre d’alerte, régime à vérifier.`] : []),
      'TVA et CFE non incluses dans le net; la TVA collectée n’est pas un revenu.',
    ],
    breakdown: { revenue, actualExpenses, taxableIncome, socialContributions: contributions, professionalTraining: cfp, acreMonths },
  };
}

export function simulate(input: SimulationInput, config: FiscalConfig = FISCAL_2026): SimulationResult {
  const revenue = annualRevenue(input);
  const operatingProfit = money(revenue - expenses(input, config));
  const desiredSasuSalary = input.sasuSalaryEnabled ? money(input.sasuDesiredNetSalary) : 0;
  const salaryCost = Math.min(operatingProfit, desiredSasuSalary * config.social.sasuEmployerCostPerNetSalary);
  const paidSasuSalary = salaryCost / config.social.sasuEmployerCostPerNetSalary;
  const sasuSocial = money(salaryCost - paidSasuSalary);
  const salaryIr = incrementalHouseholdTax(paidSasuSalary, input, config);

  const sasuTaxable = money(operatingProfit - salaryCost);
  const sasuIs = corporateTax(sasuTaxable, revenue, config);
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

  // SASU IR: product assumption requested for comparison. The president's remuneration follows the
  // assimilated-employee payroll estimate but is not deducted from the taxable pass-through profit.
  const sasuIrTax = incrementalHouseholdTax(operatingProfit, input, config);
  const sasuIrProfitSocial = operatingProfit * config.capital.socialLevies;
  const sasuIrAvailableAfterSalary = money(operatingProfit - salaryCost);
  const sasuIrPersonalNet = money(paidSasuSalary + sasuIrAvailableAfterSalary - sasuIrTax - sasuIrProfitSocial);
  const sasuIrScenario: ScenarioResult = {
    id: 'sasu_ir', label: 'SASU à l’IR', personalNet: sasuIrPersonalNet,
    socialContributions: sasuIrProfitSocial + sasuSocial, incomeTax: sasuIrTax, corporateTax: 0, capitalLevies: 0,
    companyCash: 0, holdingCash: 0,
    protection: paidSasuSalary > 0
      ? salariedProtection
      : { health: 'Aucune cotisation de président sans salaire', retirement: 'Aucun droit supposé sans rémunération cotisée' },
    warnings: [
      'Hypothèse produit: prélèvements sociaux de 18,6 % appliqués directement à la totalité du bénéfice imposable.',
      'Hypothèse conservatrice: la rémunération du président et son coût social estimé ne réduisent pas le bénéfice fiscal de la SASU à l’IR.',
      'Le ratio de coût salarial de 1,82 est une estimation; le simulateur officiel Urssaf ne gère pas la SASU à l’IR.',
      'Le bénéfice est imposé même s’il reste en trésorerie.',
      'Option IR temporaire et soumise à conditions.',
    ],
    breakdown: {
      operatingProfit,
      salaryCost,
      netSalary: paidSasuSalary,
      payrollContributions: sasuSocial,
      taxablePersonalProfit: operatingProfit,
      profitSocialLevies: sasuIrProfitSocial,
    },
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

  const eurlNetSalary = Math.min(money(input.desiredNetSalary), operatingProfit / (1 + tnsRate));
  const eurlSocial = eurlNetSalary * tnsRate;
  const eurlSalaryCost = eurlNetSalary + eurlSocial;
  const eurlTaxable = money(operatingProfit - eurlSalaryCost);
  const eurlIs = corporateTax(eurlTaxable, revenue, config);
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

  const activity = config.micro.activities[input.microActivity];
  const creationMonth = Math.min(12, Math.max(1, Math.floor(finite(input.microCreationMonth) || 1)));
  const acreReduction = creationMonth <= 6
    ? config.micro.acreReductionBeforeJuly
    : config.micro.acreReductionFromJuly;
  const acreRate = activity.socialRate * (1 - acreReduction);
  const creationQuarter = Math.floor((creationMonth - 1) / 3) + 1;
  const year2AcreMonths = Math.max(0, (creationQuarter - 1) * 3);
  const year2WeightedRate = activity.socialRate * (12 - year2AcreMonths) / 12
    + acreRate * year2AcreMonths / 12;
  const microYear1Acre = microScenario('micro_y1_acre', 'Micro A1 avec ACRE', input, acreRate, 13 - creationMonth, config);
  const microYear1NoAcre = microScenario('micro_y1_no_acre', 'Micro A1 sans ACRE', input, activity.socialRate, 0, config);
  const microYear2Acre = microScenario('micro_y2_acre', 'Micro A2 avec reliquat ACRE', input, year2WeightedRate, year2AcreMonths, config);
  const microYear2NoAcre = microScenario('micro_y2_no_acre', 'Micro A2 sans ACRE', input, activity.socialRate, 0, config);

  const portageExpenses = Math.min(money(input.portageProfessionalExpenses), revenue);
  const managementRate = Math.min(0.3, Math.max(0, finite(input.portageManagementFeeRate) / 100));
  const managementFees = revenue * managementRate;
  const portageAvailable = money(revenue - portageExpenses - managementFees);
  const portageGrossSalary = portageAvailable / (1 + config.portage.employerContributionRate);
  const portageEmployerSocial = portageAvailable - portageGrossSalary;
  const portageEmployeeSocial = portageGrossSalary * config.portage.employeeContributionRate;
  const portageNetSalary = money(portageGrossSalary - portageEmployeeSocial);
  const portageIncomeTax = incrementalHouseholdTax(portageNetSalary, input, config);
  const portageScenario: ScenarioResult = {
    id: 'portage', label: 'Portage salarial',
    personalNet: money(portageNetSalary - portageIncomeTax),
    socialContributions: portageEmployerSocial + portageEmployeeSocial,
    incomeTax: portageIncomeTax, corporateTax: 0, capitalLevies: 0,
    companyCash: 0, holdingCash: 0,
    protection: { health: 'Régime général salarié', retirement: 'Retraite de base et complémentaire selon salaire cotisé' },
    warnings: [
      'Estimation: les frais de gestion, cotisations et provisions varient selon la société de portage et le contrat.',
      'Les frais professionnels doivent être justifiés et acceptés par la société de portage; ils ne constituent pas du salaire net.',
      'Indemnité d’apport d’affaires, congés payés, réserve et minimum conventionnel non détaillés séparément.',
    ],
    breakdown: { revenue, professionalExpenses: portageExpenses, managementFees, grossSalary: portageGrossSalary, employerContributions: portageEmployerSocial, employeeContributions: portageEmployeeSocial, netSalary: portageNetSalary },
  };

  return {
    operatingProfit,
    scenarios: [
      sasuIsScenario, sasuIrScenario, holdingScenario, eurlIrScenario, eurlIsScenario,
      microYear1Acre, microYear1NoAcre, microYear2Acre, microYear2NoAcre, portageScenario,
    ],
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
  revenueInputMode: 'turnover',
  dailyRate: 0,
  billableDays: 0,
  expenses: {
    employees: 0, vehicle: 8_000, clientMeals: 2_500, purchases: 12_000,
    software: 3_600, accounting: 2_400, insurance: 1_200, rent: 8_400,
    telecom: 1_200, travel: 4_500, other: 15_613,
  },
  household: { maritalStatus: 'couple', spouseTaxableIncome: 17_743, children: 2 },
  desiredNetSalary: 48_000,
  sasuSalaryEnabled: true,
  sasuDesiredNetSalary: 48_000,
  shareCapital: 1_000,
  desiredDividends: 0,
  holdingReinvestmentRate: 100,
  employeeCount: 0,
  employeeGrossMonthlySalary: 0,
  microActivity: 'bnc',
  microCreationMonth: 1,
  portageManagementFeeRate: 7,
  portageProfessionalExpenses: 0,
};

/** Empty form state used by the public UI. The historical example stays test-only. */
export const blankSimulationInput: SimulationInput = {
  revenue: 0,
  revenueInputMode: 'turnover',
  dailyRate: 0,
  billableDays: 0,
  expenses: {
    employees: 0, vehicle: 0, clientMeals: 0, purchases: 0,
    software: 0, accounting: 0, insurance: 0, rent: 0,
    telecom: 0, travel: 0, other: 0,
  },
  household: { maritalStatus: 'single', spouseTaxableIncome: 0, children: 0 },
  desiredNetSalary: 0,
  sasuSalaryEnabled: null,
  sasuDesiredNetSalary: 0,
  shareCapital: 0,
  desiredDividends: 0,
  holdingReinvestmentRate: 0,
  employeeCount: 0,
  employeeGrossMonthlySalary: 0,
  microActivity: 'bnc',
  microCreationMonth: 0,
  portageManagementFeeRate: 0,
  portageProfessionalExpenses: 0,
};
