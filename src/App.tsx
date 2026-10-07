import { useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, BarChart3, Building2, Calculator, Check, ChevronDown, CircleEuro, Info, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react'
import { annualRevenue, blankSimulationInput, employeePayrollCost, recommendScenario, simulate, type ScenarioId, type ScenarioResult, type SimulationInput } from './domain/simulation'

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
type ScenarioGroupId = 'sasu_is' | 'sasu_ir' | 'sasu_holding' | 'eurl_ir' | 'eurl_is' | 'micro' | 'portage'
const baseSteps = ['Comparaison', 'Activité', 'Charges', 'Foyer', 'Objectifs']
const scenarioGroups: { id: ScenarioGroupId; label: string; description: string; scenarios: ScenarioId[] }[] = [
  { id: 'sasu_is', label: 'SASU à l’IS', description: 'Salaire et dividendes', scenarios: ['sasu_is'] },
  { id: 'sasu_ir', label: 'SASU à l’IR', description: 'Bénéfice imposé au foyer', scenarios: ['sasu_ir'] },
  { id: 'sasu_holding', label: 'SASU IS + holding', description: 'Pour réinvestir via une holding', scenarios: ['sasu_holding'] },
  { id: 'eurl_ir', label: 'EURL à l’IR', description: 'Régime TNS sur le bénéfice', scenarios: ['eurl_ir'] },
  { id: 'eurl_is', label: 'EURL à l’IS', description: 'Rémunération TNS et dividendes', scenarios: ['eurl_is'] },
  { id: 'micro', label: 'Micro-entreprise', description: 'Avec ou sans ACRE, années 1 et 2', scenarios: ['micro_y1_acre', 'micro_y1_no_acre', 'micro_y2_acre', 'micro_y2_no_acre'] },
  { id: 'portage', label: 'Portage salarial', description: 'Statut salarié sans créer de société', scenarios: ['portage'] },
]
const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const expenseFields: { key: keyof SimulationInput['expenses']; label: string; hint: string }[] = [
  { key: 'vehicle', label: 'Frais kilométriques', hint: 'IK et déplacements en véhicule personnel' },
  { key: 'clientMeals', label: 'Repas clients', hint: 'Repas professionnels déductibles' },
  { key: 'purchases', label: 'Achats', hint: 'Matériel, fournitures et sous-traitance' },
  { key: 'software', label: 'Logiciels & abonnements', hint: 'SaaS et outils métier' },
  { key: 'accounting', label: 'Comptable', hint: 'Tenue comptable et juridique annuel' },
  { key: 'insurance', label: 'Assurances', hint: 'RC pro, prévoyance et autres contrats' },
  { key: 'rent', label: 'Loyer / coworking', hint: 'Bureau et espace de travail' },
  { key: 'telecom', label: 'Télécom', hint: 'Téléphone et internet' },
  { key: 'travel', label: 'Déplacements', hint: 'Train, avion et hébergement' },
  { key: 'other', label: 'Autres charges', hint: 'Toutes les dépenses non listées' },
]
const visualAssets = {
  hero: {
    src: 'https://images.pexels.com/photos/12662856/pexels-photo-12662856.jpeg?auto=compress&cs=tinysrgb&w=1200',
    page: 'https://www.pexels.com/photo/woman-laptop-freelancer-indoors-12662856/',
    author: 'Anna Shvets',
  },
  decision: {
    src: 'https://images.pexels.com/photos/8145328/pexels-photo-8145328.jpeg?auto=compress&cs=tinysrgb&w=1200',
    page: 'https://www.pexels.com/photo/persons-using-laptops-on-table-with-charts-8145328/',
    author: 'olia danilevich',
  },
}

const breakdownLabels: Record<string, string> = {
  operatingProfit: 'Résultat avant rémunération et fiscalité',
  salaryCost: 'Coût total de la rémunération',
  netSalary: 'Salaire net avant impôt sur le revenu',
  grossDividends: 'Dividendes bruts',
  subsidiaryCorporateTax: 'IS de la SASU',
  holdingTax: 'IS de la holding',
  holdingDistribution: 'Montant transféré à la holding',
  professionalIncome: 'Revenu professionnel net',
  taxableProfessionalIncome: 'Revenu professionnel imposable',
  contributedDividend: 'Dividendes soumis aux cotisations TNS',
  payrollContributions: 'Cotisations sur le salaire du président',
  taxablePersonalProfit: 'Bénéfice imposable à l’IR',
  profitSocialLevies: 'Prélèvements sociaux de 18,6 % sur le bénéfice',
}

const directorNetRemuneration = (scenario: ScenarioResult) => {
  if (scenario.id === 'eurl_ir') return scenario.breakdown.professionalIncome ?? 0
  return scenario.breakdown.netSalary ?? 0
}

const breakdownLabel = (key: string) => breakdownLabels[key] ?? key

function MoneyInput({ label, hint, value, onChange, unit = '€' }: { label: string; hint?: string; value: number; onChange: (n: number) => void; unit?: string }) {
  return <label className="field"><span>{label}</span>{hint && <small>{hint}</small>}<div className={`money ${unit.length > 1 ? 'wide-unit' : ''}`}><input type="number" min="0" value={value || ''} placeholder="À renseigner" onChange={e => onChange(Math.max(0, Number(e.target.value)))} /><b>{unit}</b></div></label>
}

function PercentInput({ label, hint, value, onChange }: { label: string; hint?: string; value: number; onChange: (n: number) => void }) {
  return <label className="field"><span>{label}</span>{hint && <small>{hint}</small>}<div className="money"><input type="number" min="0" max="30" value={value || ''} placeholder="À renseigner" onChange={e => onChange(Math.max(0, Number(e.target.value)))} /><b>%</b></div></label>
}

export default function App() {
  const [input, setInput] = useState<SimulationInput>(blankSimulationInput)
  const [step, setStep] = useState(0)
  const [results, setResults] = useState(false)
  const [details, setDetails] = useState<string | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [selectedGroups, setSelectedGroups] = useState<ScenarioGroupId[]>([])
  const simulation = useMemo(() => simulate(input), [input])
  const calculatedRevenue = useMemo(() => annualRevenue(input), [input])
  const payroll = useMemo(() => employeePayrollCost(input), [input])
  const totalExpenses = Object.entries(input.expenses).filter(([key]) => key !== 'employees').reduce((sum, [, value]) => sum + value, 0) + payroll.total
  const updateExpense = (key: keyof SimulationInput['expenses'], value: number) => setInput(v => ({ ...v, expenses: { ...v.expenses, [key]: value } }))
  const hasMicro = selectedGroups.includes('micro')
  const hasPortage = selectedGroups.includes('portage')
  const hasSasuSalaryChoice = selectedGroups.some(id => ['sasu_is', 'sasu_ir', 'sasu_holding'].includes(id))
  const hasEurlSalary = selectedGroups.includes('eurl_is')
  const hasSpecificOptions = hasMicro || hasPortage
  const steps = hasSpecificOptions ? [...baseSteps, 'Options choisies'] : baseSteps
  const lastStep = steps.length - 1
  const selectedScenarioIds = scenarioGroups.filter(group => selectedGroups.includes(group.id)).flatMap(group => group.scenarios)
  const visibleScenarios = simulation.scenarios.filter(scenario => selectedScenarioIds.includes(scenario.id))
  const recommendation = recommendScenario(visibleScenarios, input)
  const canAdvance = step === 0
    ? selectedGroups.length >= 2
    : step === 1
      ? calculatedRevenue > 0
      : step === 4
        ? !hasSasuSalaryChoice || (input.sasuSalaryEnabled !== null && (!input.sasuSalaryEnabled || input.sasuDesiredNetSalary > 0))
      : step === 5
        ? (!hasMicro || input.microCreationMonth > 0) && (!hasPortage || input.portageManagementFeeRate > 0)
        : true
  const toggleGroup = (id: ScenarioGroupId) => setSelectedGroups(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])

  const reset = () => { setInput(blankSimulationInput); setSelectedGroups([]); setStep(0); setResults(false); setDetails(null); setIsCalculating(false) }
  const showSimulationResults = () => {
    if (isCalculating) return
    setIsCalculating(true)
    window.setTimeout(() => {
      setResults(true)
      setIsCalculating(false)
      window.scrollTo({ top: 0, behavior: 'auto' })
    }, 1400)
  }
  if (results) return <main>
    <a className="skip-link" href="#results-content">Aller au contenu principal</a>
    <Header onReset={reset} />
    <section className="results hero-shell" id="results-content">
      <button className="back" onClick={() => setResults(false)}><ArrowLeft size={17} /> Modifier mes réponses</button>
      <div className="results-title"><div><p className="eyebrow">Votre comparaison personnalisée</p><h1>{visibleScenarios.length} options, une décision plus claire.</h1><p>Sur la base d’un chiffre d’affaires de {eur.format(calculatedRevenue)} et de {eur.format(totalExpenses)} de charges.</p></div><div className="profit"><span>Résultat avant fiscalité personnelle</span><strong>{eur.format(simulation.operatingProfit)}</strong></div></div>
      {recommendation && <div className="recommendation-banner"><Sparkles size={22}/><div><span>Conseil StatutPilot basé sur vos données · confiance {recommendation.confidence}</span><strong>{recommendation.scenario.label}</strong><p>Le moteur a comparé vos montants calculés, la trésorerie, la protection sociale, la simplicité et les objectifs exprimés dans vos réponses.</p><ul className="recommendation-reasons">{recommendation.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>{recommendation.runnerUp && <small>Alternative la plus proche : {recommendation.runnerUp.label}.</small>}{recommendation.tradeoffs[0] && <div className="recommendation-caution"><Info size={15}/><p><b>Point de vigilance</b>{recommendation.tradeoffs[0]}</p></div>}</div></div>}
      <div className="notice"><Info size={19}/><span><strong>Simulation indicative.</strong> Les montants comportent des estimations et ne remplacent pas l’avis d’un expert-comptable ou fiscaliste.</span></div>
      <div className="mobile-comparison" aria-label="Comparatif des statuts sur mobile">
        <div className="swipe-hint"><span>Faites glisser pour comparer</span><span>{visibleScenarios.length} options</span></div>
        <div className="scenario-cards">
          {visibleScenarios.map((scenario, index) => <article className={`scenario-card ${recommendation?.scenario.id === scenario.id ? 'is-recommended' : ''}`} key={scenario.id}>
            <div className="scenario-heading"><div>{recommendation?.scenario.id === scenario.id && <span className="recommended">Conseil personnalisé</span>}<h2>{scenario.label}</h2></div><span>{index + 1}/{visibleScenarios.length}</span></div>
            <div className="scenario-net"><span>Net personnel estimé</span><strong>{eur.format(scenario.personalNet)}</strong></div>
            <dl>
              <div><dt>Salaire / rémunération nette avant IR</dt><dd>{eur.format(directorNetRemuneration(scenario))}</dd></div>
              <div><dt>Cotisations sociales</dt><dd>{eur.format(scenario.socialContributions)}</dd></div>
              <div><dt>Impôt sur le revenu</dt><dd>{eur.format(scenario.incomeTax)}</dd></div>
              <div><dt>Impôt sur les sociétés</dt><dd>{eur.format(scenario.corporateTax)}</dd></div>
              <div><dt>Prélèvements sur le capital</dt><dd>{eur.format(scenario.capitalLevies)}</dd></div>
              <div><dt>Trésorerie société</dt><dd>{eur.format(scenario.companyCash)}</dd></div>
              <div><dt>Trésorerie holding</dt><dd>{eur.format(scenario.holdingCash)}</dd></div>
            </dl>
            <div className="scenario-protection"><ShieldCheck size={17}/><div><strong>{scenario.protection.health}</strong><small>{scenario.protection.retirement}</small></div></div>
            <button className="mobile-details" onClick={() => setDetails(details === scenario.id ? null : scenario.id)} aria-expanded={details === scenario.id}>Détails et avertissements <ChevronDown size={16}/></button>
            {details === scenario.id && <div className="mobile-detail-panel">{Object.entries(scenario.breakdown).map(([k,v]) => <span key={k}>{breakdownLabel(k)}<b>{eur.format(v)}</b></span>)}{scenario.warnings.map(w => <p key={w}>⚠ {w}</p>)}</div>}
          </article>)}
        </div>
      </div>
      <div className="comparison desktop-comparison" role="region" aria-label="Comparatif des statuts" tabIndex={0}>
        <table><thead><tr><th>Indicateur</th>{visibleScenarios.map(s => <th key={s.id} className={recommendation?.scenario.id === s.id ? 'featured' : ''}>{recommendation?.scenario.id === s.id && <span className="recommended">Conseil personnalisé</span>}{s.label}</th>)}</tr></thead>
          <tbody>
            <Metric label="Net personnel estimé" values={visibleScenarios.map(s => s.personalNet)} strong />
            <Metric label="Salaire / rémunération nette avant IR" values={visibleScenarios.map(directorNetRemuneration)} />
            <Metric label="Cotisations sociales" values={visibleScenarios.map(s => s.socialContributions)} />
            <Metric label="Impôt sur le revenu" values={visibleScenarios.map(s => s.incomeTax)} />
            <Metric label="Impôt sur les sociétés" values={visibleScenarios.map(s => s.corporateTax)} />
            <Metric label="Prélèvements sur le capital" values={visibleScenarios.map(s => s.capitalLevies)} />
            <Metric label="Trésorerie en société" values={visibleScenarios.map(s => s.companyCash)} />
            <Metric label="Trésorerie en holding" values={visibleScenarios.map(s => s.holdingCash)} />
            <tr><td>Protection sociale</td>{visibleScenarios.map(s => <td key={s.id}><span className="protection"><ShieldCheck size={15}/>{s.protection.health}</span><small>{s.protection.retirement}</small></td>)}</tr>
            <tr><td></td>{visibleScenarios.map(s => <td key={s.id}><button className="details" onClick={() => setDetails(details === s.id ? null : s.id)}>Voir le détail <ChevronDown size={14}/></button>{details === s.id && <div className="detail-panel">{Object.entries(s.breakdown).map(([k,v]) => <span key={k}>{breakdownLabel(k)}<b>{eur.format(v)}</b></span>)}{s.warnings.map(w => <p key={w}>⚠ {w}</p>)}</div>}</td>)}</tr>
          </tbody></table>
      </div>
      <section className="decision-story" aria-labelledby="decision-story-title"><div className="decision-photo"><img src={visualAssets.decision.src} srcSet={`${visualAssets.decision.src.replace('w=1200', 'w=640')} 640w, ${visualAssets.decision.src.replace('w=1200', 'w=960')} 960w, ${visualAssets.decision.src} 1200w`} sizes="(max-width: 820px) 100vw, 42vw" alt="Équipe analysant des graphiques et des données financières autour d’une table" width="1260" height="840" loading="lazy" decoding="async"/><a href={visualAssets.decision.page} target="_blank" rel="noreferrer">Photo {visualAssets.decision.author} · Pexels</a></div><div className="decision-copy"><p className="eyebrow">Décider avec méthode</p><h2 id="decision-story-title">Le meilleur statut est celui qui sert votre projet.</h2><p>Le classement vous donne une première direction. Utilisez ensuite le détail des calculs pour challenger vos hypothèses avec votre expert-comptable.</p><button type="button" className="secondary" onClick={() => setResults(false)}><ArrowLeft size={17}/> Ajuster mes réponses</button></div></section>
      <div className="assumptions"><h2>Hypothèses de calcul</h2>{simulation.assumptions.map(a => <p key={a}><Check size={15}/>{a}</p>)}</div>
    </section>
    <Footer />
  </main>

  return <main aria-busy={isCalculating}><a className="skip-link" href="#wizard-content">Aller au contenu principal</a><Header onReset={reset}/>{isCalculating && <SimulationLoader/>}<section className="wizard hero-shell" id="wizard-content">
    <div className="intro intro-with-visual"><div className="intro-copy"><p className="eyebrow"><Sparkles size={15}/> Simulateur 2026</p><h1>Quel statut fait vraiment<br/> avancer votre projet&nbsp;?</h1><p>Répondez à quelques questions. StatutPilot compare les options avec vos vrais chiffres.</p><div className="hero-actions"><a className="hero-cta" href="#questionnaire">Commencer ma comparaison <ArrowRight size={17}/></a><span>Gratuit · sans inscription · données locales</span></div></div><figure className="hero-visual"><img src={visualAssets.hero.src} srcSet={`${visualAssets.hero.src.replace('w=1200', 'w=640')} 640w, ${visualAssets.hero.src.replace('w=1200', 'w=960')} 960w, ${visualAssets.hero.src} 1200w`} sizes="(max-width: 820px) 100vw, 430px" alt="Consultante indépendante travaillant sur son ordinateur dans un bureau lumineux" width="832" height="1248" loading="eager" fetchPriority="high" decoding="async"/><div className="visual-badge"><Sparkles size={17}/><div><strong>Votre projet, vos chiffres</strong><span>Un parcours guidé, puis une comparaison claire.</span></div></div><figcaption>Photo <a href={visualAssets.hero.page} target="_blank" rel="noreferrer">{visualAssets.hero.author} · Pexels</a></figcaption></figure></div>
    <div className="wizard-grid" id="questionnaire"><aside><p>Votre parcours</p>{steps.map((s,i) => <button key={s} className={i === step ? 'active' : i < step ? 'done' : ''} onClick={() => i <= step && setStep(i)}><span>{i < step ? <Check size={15}/> : i+1}</span>{s}</button>)}<div className="aside-card"><BarChart3/><strong>Une comparaison utile</strong><small>Chaque montant reste modifiable. Vous pourrez revenir en arrière à tout moment.</small></div></aside>
      <div className="form-card"><div className="mobile-progress"><span>Étape {step+1} sur {steps.length}</span><progress value={step+1} max={steps.length}/></div>
        {step === 0 && <Panel title="Que voulez-vous comparer ?" subtitle="Choisissez au moins deux options. Après vos réponses, StatutPilot analysera les résultats et vous conseillera celle qui correspond le mieux à votre situation."><div className="selection-section"><div className="selection-heading"><h3>Les statuts à confronter</h3><span>{selectedGroups.length} sélectionné{selectedGroups.length > 1 ? 's' : ''}</span></div><div className="status-choice-grid" role="group" aria-label="Statuts à comparer">{scenarioGroups.map(group => <button type="button" key={group.id} className={`choice-card ${selectedGroups.includes(group.id) ? 'selected' : ''}`} aria-pressed={selectedGroups.includes(group.id)} onClick={() => toggleGroup(group.id)}><span>{group.label}</span><small>{group.description}</small>{selectedGroups.includes(group.id) && <Check size={18}/>}</button>)}</div></div>{selectedGroups.length < 2 && <div className="inline-guidance"><Info size={17}/><span>Sélectionnez au moins deux options. Le conseil sera construit après la simulation à partir de vos données.</span></div>}</Panel>}
        {step === 1 && <Panel title="Parlons de votre activité" subtitle="Choisissez la méthode la plus simple pour estimer votre chiffre d’affaires annuel."><div className="selection-section revenue-choice"><h3>Comment souhaitez-vous renseigner votre activité&nbsp;?</h3><div className="input-mode-grid" role="radiogroup" aria-label="Mode de saisie du chiffre d’affaires"><button type="button" role="radio" aria-checked={input.revenueInputMode === 'daily_rate'} className={`choice-card compact ${input.revenueInputMode === 'daily_rate' ? 'selected' : ''}`} onClick={() => setInput(v => ({...v,revenueInputMode:'daily_rate'}))}><span>TJM × jours facturés</span><small>Le CA annuel est calculé automatiquement</small>{input.revenueInputMode === 'daily_rate' && <Check size={18}/>}</button><button type="button" role="radio" aria-checked={input.revenueInputMode === 'turnover'} className={`choice-card compact ${input.revenueInputMode === 'turnover' ? 'selected' : ''}`} onClick={() => setInput(v => ({...v,revenueInputMode:'turnover'}))}><span>Chiffre d’affaires direct</span><small>Vous connaissez déjà votre CA annuel HT</small>{input.revenueInputMode === 'turnover' && <Check size={18}/>}</button></div></div>{input.revenueInputMode === 'turnover' ? <MoneyInput label="Chiffre d’affaires annuel HT" hint="Le total facturé avant TVA" value={input.revenue} onChange={revenue => setInput(v => ({...v,revenue}))}/> : <><div className="fields-grid"><MoneyInput label="TJM HT" hint="Votre tarif journalier moyen" unit="€/jour" value={input.dailyRate} onChange={dailyRate => setInput(v => ({...v,dailyRate}))}/><label className="field"><span>Nombre de jours facturés par an</span><small>Jours réellement facturables au client</small><input type="number" min="0" max="366" step="1" value={input.billableDays || ''} placeholder="À renseigner" onChange={e => setInput(v => ({...v,billableDays:Math.max(0,Math.floor(Number(e.target.value)))}))}/></label></div><div className="summary-line calculated-revenue"><span>Chiffre d’affaires annuel calculé<small>{input.dailyRate > 0 && input.billableDays > 0 ? `${eur.format(input.dailyRate)} × ${input.billableDays} jours` : 'Renseignez le TJM et les jours facturés'}</small></span><b>{eur.format(calculatedRevenue)}</b></div></>}<div className="summary-line"><span>Charges actuellement renseignées</span><b>{eur.format(totalExpenses)}</b></div>{calculatedRevenue <= 0 && <div className="inline-guidance"><Info size={17}/><span>{input.revenueInputMode === 'daily_rate' ? 'Renseignez votre TJM et votre nombre de jours facturés pour continuer.' : 'Renseignez votre chiffre d’affaires pour continuer.'}</span></div>}</Panel>}
        {step === 2 && <Panel title="Quelles sont vos charges ?" subtitle="Renseignez les montants annuels. Laissez vide si une catégorie ne vous concerne pas."><div className="payroll-card"><div><span className="step-label">Équipe salariée</span><h3>Salaires et charges employeur</h3><p>Le coût annuel est calculé automatiquement avec une estimation de 42 % de charges patronales.</p></div><div className="fields-grid"><label className="field"><span>Nombre de salariés</span><small>Effectif moyen sur l’année</small><input type="number" min="0" step="1" value={input.employeeCount || ''} placeholder="À renseigner" onChange={e => setInput(v => ({...v, employeeCount: Math.max(0, Math.floor(Number(e.target.value)))}))}/></label><MoneyInput label="Salaire brut mensuel moyen" hint="Par salarié" value={input.employeeGrossMonthlySalary} onChange={employeeGrossMonthlySalary => setInput(v => ({...v, employeeGrossMonthlySalary}))}/></div><div className="payroll-results"><span>Brut annuel <b>{eur.format(payroll.annualGross)}</b></span><span>Charges patronales estimées <b>{eur.format(payroll.employerContributions)}</b></span><span>Coût employeur total <b>{eur.format(payroll.total)}</b></span></div></div><div className="fields-grid">{expenseFields.map(f => <MoneyInput key={f.key} label={f.label} hint={f.hint} value={input.expenses[f.key]} onChange={n => updateExpense(f.key,n)}/>)}</div><div className="summary-line"><span>Total des charges annuelles</span><b>{eur.format(totalExpenses)}</b></div></Panel>}
        {step === 3 && <Panel title="Votre foyer fiscal" subtitle="Ces informations servent uniquement à estimer votre impôt sur le revenu."><label className="field"><span>Situation familiale</span><select value={input.household.maritalStatus} onChange={e => setInput(v=>({...v,household:{...v.household,maritalStatus:e.target.value as 'single'|'couple'}}))}><option value="single">Célibataire</option><option value="couple">Marié(e) ou pacsé(e)</option></select></label><MoneyInput label="Revenu net imposable annuel du conjoint" value={input.household.spouseTaxableIncome} onChange={spouseTaxableIncome=>setInput(v=>({...v,household:{...v.household,spouseTaxableIncome}}))}/><label className="field"><span>Nombre d’enfants à charge</span><input type="number" min="0" max="10" value={input.household.children || ''} placeholder="À renseigner" onChange={e=>setInput(v=>({...v,household:{...v.household,children:Number(e.target.value)}}))}/></label></Panel>}
        {step === 4 && <Panel title="Vos objectifs de rémunération" subtitle="Choisissez d’abord si le président de la SASU doit percevoir un salaire. Les montants EURL restent réglés séparément.">{hasSasuSalaryChoice && <div className="salary-choice"><div><h3>Salaire du président de SASU</h3><p>À l’IS, le coût salarial réduit le bénéfice imposable. À l’IR, il réduit la trésorerie mais pas le bénéfice fiscal attribué à l’associé. Sans salaire, aucune cotisation d’assimilé salarié ni droit retraite n’est estimé.</p></div><div className="input-mode-grid" role="radiogroup" aria-label="Choix du salaire du président de SASU"><button type="button" role="radio" aria-checked={input.sasuSalaryEnabled === true} className={`choice-card compact ${input.sasuSalaryEnabled === true ? 'selected' : ''}`} onClick={() => setInput(v=>({...v,sasuSalaryEnabled:true}))}><span>Oui, avec salaire</span><small>Coût total estimé à 1,82 × le salaire net</small>{input.sasuSalaryEnabled === true && <Check size={18}/>}</button><button type="button" role="radio" aria-checked={input.sasuSalaryEnabled === false} className={`choice-card compact ${input.sasuSalaryEnabled === false ? 'selected' : ''}`} onClick={() => setInput(v=>({...v,sasuSalaryEnabled:false,sasuDesiredNetSalary:0}))}><span>Non, sans salaire</span><small>Le résultat reste en société ou sort en dividendes</small>{input.sasuSalaryEnabled === false && <Check size={18}/>}</button></div></div>}<div className="fields-grid">{hasSasuSalaryChoice && input.sasuSalaryEnabled === true && <MoneyInput label="Salaire net annuel souhaité du président de SASU" hint="Avant impôt sur le revenu; coût chargé estimé automatiquement" value={input.sasuDesiredNetSalary} onChange={sasuDesiredNetSalary=>setInput(v=>({...v,sasuDesiredNetSalary}))}/>} {hasEurlSalary && <MoneyInput label="Rémunération nette annuelle souhaitée en EURL" hint="Calculée avec les cotisations TNS estimées" value={input.desiredNetSalary} onChange={desiredNetSalary=>setInput(v=>({...v,desiredNetSalary}))}/>} {hasEurlSalary && <MoneyInput label="Capital social" value={input.shareCapital} onChange={shareCapital=>setInput(v=>({...v,shareCapital}))}/>} {selectedGroups.some(id => ['sasu_is','sasu_holding','eurl_is'].includes(id)) && <MoneyInput label="Dividendes souhaités" value={input.desiredDividends} onChange={desiredDividends=>setInput(v=>({...v,desiredDividends}))}/>} {selectedGroups.includes('sasu_holding') && <label className="field"><span>Réinvestissement via holding</span><small>Part du résultat que vous souhaitez conserver</small><div className="range-value">{Math.round(input.holdingReinvestmentRate)}%</div><input type="range" min="0" max="100" step="5" value={input.holdingReinvestmentRate} onChange={e=>setInput(v=>({...v,holdingReinvestmentRate:Number(e.target.value)}))}/></label>}</div>{hasSasuSalaryChoice && input.sasuSalaryEnabled === null && <div className="inline-guidance"><Info size={17}/><span>Choisissez « avec salaire » ou « sans salaire » pour continuer.</span></div>}{hasSasuSalaryChoice && input.sasuSalaryEnabled === true && input.sasuDesiredNetSalary <= 0 && <div className="inline-guidance"><Info size={17}/><span>Renseignez le salaire net annuel souhaité du président de SASU.</span></div>}{!hasSasuSalaryChoice && !hasEurlSalary && <div className="inline-guidance success"><Check size={17}/><span>Aucun réglage de rémunération supplémentaire n’est nécessaire pour votre sélection.</span></div>}</Panel>}
        {step === 5 && <Panel title="Réglages de vos options" subtitle="Dernières informations nécessaires pour la micro-entreprise ou le portage."><div className="fields-grid">{hasMicro && <><label className="field"><span>Nature de l’activité micro</span><small>Détermine le seuil, les cotisations et l’abattement fiscal</small><select value={input.microActivity} onChange={e=>setInput(v=>({...v,microActivity:e.target.value as SimulationInput['microActivity']}))}><option value="bnc">Activité libérale non réglementée (BNC)</option><option value="bic_services">Prestations de services (BIC)</option><option value="sales">Vente de marchandises (BIC)</option></select></label><label className="field"><span>Mois de création de la micro-entreprise</span><small>Détermine la durée de l’ACRE en années 1 et 2</small><select value={input.microCreationMonth || ''} onChange={e=>setInput(v=>({...v,microCreationMonth:Number(e.target.value)}))}><option value="">À renseigner</option>{months.map((month,index)=><option key={month} value={index+1}>{month}</option>)}</select></label></>} {hasPortage && <><PercentInput label="Frais de gestion du portage" hint="Pourcentage facturé par la société de portage" value={input.portageManagementFeeRate} onChange={portageManagementFeeRate=>setInput(v=>({...v,portageManagementFeeRate}))}/><MoneyInput label="Frais professionnels remboursables en portage" hint="Sur justificatifs et sous réserve d’acceptation" value={input.portageProfessionalExpenses} onChange={portageProfessionalExpenses=>setInput(v=>({...v,portageProfessionalExpenses}))}/></>}</div>{hasMicro && <div className="notice"><Info size={18}/><span>L’ACRE n’est jamais appliquée sur deux années complètes : l’année 2 affiche uniquement le reliquat lié au trimestre de création.</span></div>}</Panel>}
        <div className="actions"><button className="secondary" disabled={step===0 || isCalculating} onClick={()=>setStep(s=>s-1)}><ArrowLeft size={17}/> Précédent</button>{step<lastStep?<button className="primary" disabled={!canAdvance || isCalculating} onClick={()=>setStep(s=>s+1)}>Continuer <ArrowRight size={17}/></button>:<button className="primary" disabled={!canAdvance || isCalculating} onClick={showSimulationResults}>{isCalculating ? 'Calcul en cours…' : 'Voir ma comparaison'} <ArrowRight size={17}/></button>}</div>
      </div></div>
  </section><Footer/></main>
}

function Panel({title,subtitle,children}:{title:string;subtitle:string;children:ReactNode}) { return <div className="panel"><span className="step-label">Questionnaire guidé</span><h2>{title}</h2><p>{subtitle}</p><div className="panel-fields">{children}</div></div> }
function Header({onReset}:{onReset:()=>void}) { return <header><button className="brand" onClick={onReset} aria-label="Accueil StatutPilot"><span><Building2 size={20}/></span>Statut<strong>Pilot</strong></button><div className="header-note"><ShieldCheck size={17}/> Données traitées localement</div><button className="reset" onClick={onReset}><RotateCcw size={15}/> Recommencer</button></header> }
function Footer(){return <footer><span>StatutPilot · Simulation indicative 2026</span><span>Sources officielles et méthodologie documentées</span></footer>}
function Metric({label,values,strong=false}:{label:string;values:number[];strong?:boolean}){return <tr className={strong?'key-metric':''}><td>{label}</td>{values.map((v,i)=><td key={i}>{eur.format(v)}</td>)}</tr>}
function SimulationLoader(){return <div className="simulation-loader" role="status" aria-live="polite" aria-label="Calcul de votre simulation en cours"><div className="simulation-loader-card"><div className="calculation-visual" aria-hidden="true"><span className="calc-orbit"><CircleEuro size={23}/></span><span className="calc-core"><Calculator size={38}/></span><span className="calc-chart"><i/><i/><i/></span></div><p className="eyebrow"><Sparkles size={15}/> Calcul en cours</p><h2>Nous préparons votre comparaison</h2><p>Statuts, cotisations et fiscalité sont mis en perspective avec vos chiffres.</p><div className="loader-progress" aria-hidden="true"><span/></div></div></div>}
