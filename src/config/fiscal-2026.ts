export type FiscalConfig = {
  year: number;
  corporateTax: {
    reducedRate: number;
    reducedLimit: number;
    standardRate: number;
    reducedRateRevenueLimit: number;
  };
  capital: { socialLevies: number; flatIncomeTax: number };
  householdTax: {
    brackets: ReadonlyArray<{ upTo: number; rate: number }>;
    coupleShares: number;
    singleShares: number;
    firstTwoChildrenShare: number;
    laterChildrenShare: number;
  };
  social: {
    sasuEmployerCostPerNetSalary: number;
    tnsContributionsPerNetIncome: number;
    tnsCsgCrdsRate: number;
    tnsNonDeductibleCsgShare: number;
  };
  holding: { parentSubsidiaryTaxableShare: number; holdingTaxRate: number };
  eurl: { dividendContributionExemptionCapitalRate: number };
  sources: ReadonlyArray<{ label: string; url: string; status: 'official' | 'to-verify' }>;
};

/**
 * Central assumptions for the 2026 simulator.
 * Rates described as estimates are deliberately isolated here so an accountant can
 * replace them without touching the calculation engine.
 */
export const FISCAL_2026: FiscalConfig = {
  year: 2026,
  corporateTax: {
    reducedRate: 0.15,
    reducedLimit: 42_500,
    standardRate: 0.25,
    reducedRateRevenueLimit: 10_000_000,
  },
  capital: { socialLevies: 0.186, flatIncomeTax: 0.128 },
  householdTax: {
    // 2025 bracket used as an explicit provisional baseline pending the 2026 finance act.
    brackets: [
      { upTo: 11_497, rate: 0 },
      { upTo: 29_315, rate: 0.11 },
      { upTo: 83_823, rate: 0.3 },
      { upTo: 180_294, rate: 0.41 },
      { upTo: Number.POSITIVE_INFINITY, rate: 0.45 },
    ],
    coupleShares: 2,
    singleShares: 1,
    firstTwoChildrenShare: 0.5,
    laterChildrenShare: 1,
  },
  social: {
    // Planning ratios, not statutory rates: actual payroll/TNS bases vary by situation.
    sasuEmployerCostPerNetSalary: 1.82,
    tnsContributionsPerNetIncome: 0.45,
    tnsCsgCrdsRate: 0.097,
    tnsNonDeductibleCsgShare: 0.029,
  },
  holding: { parentSubsidiaryTaxableShare: 0.05, holdingTaxRate: 0.25 },
  eurl: { dividendContributionExemptionCapitalRate: 0.1 },
  sources: [
    {
      label: 'Impôt sur les sociétés (taux normal et taux réduit)',
      url: 'https://entreprendre.service-public.fr/vosdroits/F23575',
      status: 'official',
    },
    {
      label: 'Prélèvements sociaux sur les revenus du patrimoine',
      url: 'https://www.service-public.fr/particuliers/vosdroits/F2329',
      status: 'official',
    },
    {
      label: 'Cotisations sociales d’une EURL',
      url: 'https://entreprendre.service-public.fr/vosdroits/F36238',
      status: 'official',
    },
    {
      label: 'Barème 2026 et traitement SASU à l’IR à confirmer à publication',
      url: 'https://www.impots.gouv.fr/',
      status: 'to-verify',
    },
  ],
};
