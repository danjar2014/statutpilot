import { useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, BarChart3, Building2, Check, ChevronDown, Info, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react'
import { blankSimulationInput, employeePayrollCost, simulate, type SimulationInput } from './domain/simulation'

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const steps = ['Activité', 'Charges', 'Foyer', 'Objectifs', 'Micro & portage']
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

function MoneyInput({ label, hint, value, onChange }: { label: string; hint?: string; value: number; onChange: (n: number) => void }) {
  return <label className="field"><span>{label}</span>{hint && <small>{hint}</small>}<div className="money"><input type="number" min="0" value={value || ''} placeholder="À renseigner" onChange={e => onChange(Math.max(0, Number(e.target.value)))} /><b>€</b></div></label>
}

function PercentInput({ label, hint, value, onChange }: { label: string; hint?: string; value: number; onChange: (n: number) => void }) {
  return <label className="field"><span>{label}</span>{hint && <small>{hint}</small>}<div className="money"><input type="number" min="0" max="30" value={value || ''} placeholder="À renseigner" onChange={e => onChange(Math.max(0, Number(e.target.value)))} /><b>%</b></div></label>
}

export default function App() {
  const [input, setInput] = useState<SimulationInput>(blankSimulationInput)
  const [step, setStep] = useState(0)
  const [results, setResults] = useState(false)
  const [details, setDetails] = useState<string | null>(null)
  const simulation = useMemo(() => simulate(input), [input])
  const payroll = useMemo(() => employeePayrollCost(input), [input])
  const totalExpenses = Object.entries(input.expenses).filter(([key]) => key !== 'employees').reduce((sum, [, value]) => sum + value, 0) + payroll.total
  const updateExpense = (key: keyof SimulationInput['expenses'], value: number) => setInput(v => ({ ...v, expenses: { ...v.expenses, [key]: value } }))

  const reset = () => { setInput(blankSimulationInput); setStep(0); setResults(false) }
  if (results) return <main>
    <Header onReset={reset} />
    <section className="results hero-shell">
      <button className="back" onClick={() => setResults(false)}><ArrowLeft size={17} /> Modifier mes réponses</button>
      <div className="results-title"><div><p className="eyebrow">Votre comparaison personnalisée</p><h1>Tous les statuts, une lecture claire.</h1><p>Sur la base d’un chiffre d’affaires de {eur.format(input.revenue)} et de {eur.format(totalExpenses)} de charges.</p></div><div className="profit"><span>Résultat avant fiscalité personnelle</span><strong>{eur.format(simulation.operatingProfit)}</strong></div></div>
      <div className="notice"><Info size={19}/><span><strong>Simulation indicative.</strong> Les montants comportent des estimations et ne remplacent pas l’avis d’un expert-comptable ou fiscaliste.</span></div>
      <div className="mobile-comparison" aria-label="Comparatif des statuts sur mobile">
        <div className="swipe-hint"><span>Faites glisser pour comparer</span><span>{simulation.scenarios.length} statuts</span></div>
        <div className="scenario-cards">
          {simulation.scenarios.map((scenario, index) => <article className="scenario-card" key={scenario.id}>
            <div className="scenario-heading"><div>{index === 0 && <span className="recommended">Repère</span>}<h2>{scenario.label}</h2></div><span>{index + 1}/{simulation.scenarios.length}</span></div>
            <div className="scenario-net"><span>Net personnel estimé</span><strong>{eur.format(scenario.personalNet)}</strong></div>
            <dl>
              <div><dt>Cotisations sociales</dt><dd>{eur.format(scenario.socialContributions)}</dd></div>
              <div><dt>Impôt sur le revenu</dt><dd>{eur.format(scenario.incomeTax)}</dd></div>
              <div><dt>Impôt sur les sociétés</dt><dd>{eur.format(scenario.corporateTax)}</dd></div>
              <div><dt>Prélèvements sur le capital</dt><dd>{eur.format(scenario.capitalLevies)}</dd></div>
              <div><dt>Trésorerie société</dt><dd>{eur.format(scenario.companyCash)}</dd></div>
              <div><dt>Trésorerie holding</dt><dd>{eur.format(scenario.holdingCash)}</dd></div>
            </dl>
            <div className="scenario-protection"><ShieldCheck size={17}/><div><strong>{scenario.protection.health}</strong><small>{scenario.protection.retirement}</small></div></div>
            <button className="mobile-details" onClick={() => setDetails(details === scenario.id ? null : scenario.id)} aria-expanded={details === scenario.id}>Détails et avertissements <ChevronDown size={16}/></button>
            {details === scenario.id && <div className="mobile-detail-panel">{Object.entries(scenario.breakdown).map(([k,v]) => <span key={k}>{k}<b>{eur.format(v)}</b></span>)}{scenario.warnings.map(w => <p key={w}>⚠ {w}</p>)}</div>}
          </article>)}
        </div>
      </div>
      <div className="comparison desktop-comparison" role="region" aria-label="Comparatif des statuts" tabIndex={0}>
        <table><thead><tr><th>Indicateur</th>{simulation.scenarios.map((s, i) => <th key={s.id} className={i === 0 ? 'featured' : ''}>{i === 0 && <span className="recommended">Repère</span>}{s.label}</th>)}</tr></thead>
          <tbody>
            <Metric label="Net personnel estimé" values={simulation.scenarios.map(s => s.personalNet)} strong />
            <Metric label="Cotisations sociales" values={simulation.scenarios.map(s => s.socialContributions)} />
            <Metric label="Impôt sur le revenu" values={simulation.scenarios.map(s => s.incomeTax)} />
            <Metric label="Impôt sur les sociétés" values={simulation.scenarios.map(s => s.corporateTax)} />
            <Metric label="Prélèvements sur le capital" values={simulation.scenarios.map(s => s.capitalLevies)} />
            <Metric label="Trésorerie en société" values={simulation.scenarios.map(s => s.companyCash)} />
            <Metric label="Trésorerie en holding" values={simulation.scenarios.map(s => s.holdingCash)} />
            <tr><td>Protection sociale</td>{simulation.scenarios.map(s => <td key={s.id}><span className="protection"><ShieldCheck size={15}/>{s.protection.health}</span><small>{s.protection.retirement}</small></td>)}</tr>
            <tr><td></td>{simulation.scenarios.map(s => <td key={s.id}><button className="details" onClick={() => setDetails(details === s.id ? null : s.id)}>Voir le détail <ChevronDown size={14}/></button>{details === s.id && <div className="detail-panel">{Object.entries(s.breakdown).map(([k,v]) => <span key={k}>{k}<b>{eur.format(v)}</b></span>)}{s.warnings.map(w => <p key={w}>⚠ {w}</p>)}</div>}</td>)}</tr>
          </tbody></table>
      </div>
      <div className="assumptions"><h2>Hypothèses de calcul</h2>{simulation.assumptions.map(a => <p key={a}><Check size={15}/>{a}</p>)}</div>
    </section>
    <Footer />
  </main>

  return <main><Header onReset={reset}/><section className="wizard hero-shell">
    <div className="intro"><p className="eyebrow"><Sparkles size={15}/> Simulateur 2026</p><h1>Quel statut fait vraiment<br/>avancer votre projet&nbsp;?</h1><p>Répondez à quelques questions. StatutPilot compare les options avec vos vrais chiffres.</p></div>
    <div className="wizard-grid"><aside><p>Votre parcours</p>{steps.map((s,i) => <button key={s} className={i === step ? 'active' : i < step ? 'done' : ''} onClick={() => i <= step && setStep(i)}><span>{i < step ? <Check size={15}/> : i+1}</span>{s}</button>)}<div className="aside-card"><BarChart3/><strong>Une comparaison utile</strong><small>Chaque montant reste modifiable. Vous pourrez revenir en arrière à tout moment.</small></div></aside>
      <div className="form-card"><div className="mobile-progress"><span>Étape {step+1} sur 5</span><progress value={step+1} max="5"/></div>
        {step === 0 && <Panel title="Parlons de votre activité" subtitle="Commencez par vos revenus professionnels sur une année complète."><MoneyInput label="Chiffre d’affaires annuel HT" hint="Le total facturé avant TVA" value={input.revenue} onChange={revenue => setInput(v => ({...v,revenue}))}/><label className="field"><span>Dans la SASU à l’IR, exercez-vous l’activité à titre professionnel ?</span><small>Ce choix détermine la nature des prélèvements sociaux sur votre quote-part de bénéfice.</small><select value={input.sasuIrProfessionalActivity ? 'professional' : 'non-professional'} onChange={e => setInput(v => ({...v, sasuIrProfessionalActivity: e.target.value === 'professional'}))}><option value="professional">Oui — activité professionnelle</option><option value="non-professional">Non — activité non professionnelle</option></select></label><div className="summary-line"><span>Charges actuellement renseignées</span><b>{eur.format(totalExpenses)}</b></div></Panel>}
        {step === 1 && <Panel title="Quelles sont vos charges ?" subtitle="Renseignez les montants annuels. Laissez vide si une catégorie ne vous concerne pas."><div className="payroll-card"><div><span className="step-label">Équipe salariée</span><h3>Salaires et charges employeur</h3><p>Le coût annuel est calculé automatiquement avec une estimation de 42 % de charges patronales.</p></div><div className="fields-grid"><label className="field"><span>Nombre de salariés</span><small>Effectif moyen sur l’année</small><input type="number" min="0" step="1" value={input.employeeCount || ''} placeholder="À renseigner" onChange={e => setInput(v => ({...v, employeeCount: Math.max(0, Math.floor(Number(e.target.value)))}))}/></label><MoneyInput label="Salaire brut mensuel moyen" hint="Par salarié" value={input.employeeGrossMonthlySalary} onChange={employeeGrossMonthlySalary => setInput(v => ({...v, employeeGrossMonthlySalary}))}/></div><div className="payroll-results"><span>Brut annuel <b>{eur.format(payroll.annualGross)}</b></span><span>Charges patronales estimées <b>{eur.format(payroll.employerContributions)}</b></span><span>Coût employeur total <b>{eur.format(payroll.total)}</b></span></div></div><div className="fields-grid">{expenseFields.map(f => <MoneyInput key={f.key} label={f.label} hint={f.hint} value={input.expenses[f.key]} onChange={n => updateExpense(f.key,n)}/>)}</div><div className="summary-line"><span>Total des charges annuelles</span><b>{eur.format(totalExpenses)}</b></div></Panel>}
        {step === 2 && <Panel title="Votre foyer fiscal" subtitle="Ces informations servent uniquement à estimer votre impôt sur le revenu."><label className="field"><span>Situation familiale</span><select value={input.household.maritalStatus} onChange={e => setInput(v=>({...v,household:{...v.household,maritalStatus:e.target.value as 'single'|'couple'}}))}><option value="single">Célibataire</option><option value="couple">Marié(e) ou pacsé(e)</option></select></label><MoneyInput label="Revenu net imposable annuel du conjoint" value={input.household.spouseTaxableIncome} onChange={spouseTaxableIncome=>setInput(v=>({...v,household:{...v.household,spouseTaxableIncome}}))}/><label className="field"><span>Nombre d’enfants à charge</span><input type="number" min="0" max="10" value={input.household.children || ''} placeholder="À renseigner" onChange={e=>setInput(v=>({...v,household:{...v.household,children:Number(e.target.value)}}))}/></label></Panel>}
        {step === 3 && <Panel title="Vos objectifs de rémunération" subtitle="Dites-nous ce que vous souhaitez percevoir et conserver pour investir."><div className="fields-grid"><MoneyInput label="Rémunération nette annuelle souhaitée" value={input.desiredNetSalary} onChange={desiredNetSalary=>setInput(v=>({...v,desiredNetSalary}))}/><MoneyInput label="Capital social" value={input.shareCapital} onChange={shareCapital=>setInput(v=>({...v,shareCapital}))}/><MoneyInput label="Dividendes souhaités" value={input.desiredDividends} onChange={desiredDividends=>setInput(v=>({...v,desiredDividends}))}/><label className="field"><span>Réinvestissement via holding</span><small>Part du résultat que vous souhaitez conserver</small><div className="range-value">{Math.round(input.holdingReinvestmentRate)}%</div><input type="range" min="0" max="100" step="5" value={input.holdingReinvestmentRate} onChange={e=>setInput(v=>({...v,holdingReinvestmentRate:Number(e.target.value)}))}/></label></div></Panel>}
        {step === 4 && <Panel title="Micro-entreprise et portage" subtitle="Précisez les hypothèses propres à ces deux alternatives."><div className="fields-grid"><label className="field"><span>Nature de l’activité micro</span><small>Détermine le seuil, les cotisations et l’abattement fiscal</small><select value={input.microActivity} onChange={e=>setInput(v=>({...v,microActivity:e.target.value as SimulationInput['microActivity']}))}><option value="bnc">Activité libérale non réglementée (BNC)</option><option value="bic_services">Prestations de services (BIC)</option><option value="sales">Vente de marchandises (BIC)</option></select></label><label className="field"><span>Mois de création de la micro-entreprise</span><small>Détermine la durée de l’ACRE en années 1 et 2</small><select value={input.microCreationMonth || ''} onChange={e=>setInput(v=>({...v,microCreationMonth:Number(e.target.value)}))}><option value="">À renseigner</option>{months.map((month,index)=><option key={month} value={index+1}>{month}</option>)}</select></label><PercentInput label="Frais de gestion du portage" hint="Pourcentage facturé par la société de portage" value={input.portageManagementFeeRate} onChange={portageManagementFeeRate=>setInput(v=>({...v,portageManagementFeeRate}))}/><MoneyInput label="Frais professionnels remboursables en portage" hint="Sur justificatifs et sous réserve d’acceptation" value={input.portageProfessionalExpenses} onChange={portageProfessionalExpenses=>setInput(v=>({...v,portageProfessionalExpenses}))}/></div><div className="notice"><Info size={18}/><span>L’ACRE n’est jamais appliquée sur deux années complètes : l’année 2 affiche uniquement le reliquat lié au trimestre de création.</span></div></Panel>}
        <div className="actions"><button className="secondary" disabled={step===0} onClick={()=>setStep(s=>s-1)}><ArrowLeft size={17}/> Précédent</button>{step<4?<button className="primary" onClick={()=>setStep(s=>s+1)}>Continuer <ArrowRight size={17}/></button>:<button className="primary" onClick={()=>setResults(true)}>Voir ma comparaison <ArrowRight size={17}/></button>}</div>
      </div></div>
  </section><Footer/></main>
}

function Panel({title,subtitle,children}:{title:string;subtitle:string;children:ReactNode}) { return <div className="panel"><span className="step-label">Questionnaire guidé</span><h2>{title}</h2><p>{subtitle}</p><div className="panel-fields">{children}</div></div> }
function Header({onReset}:{onReset:()=>void}) { return <header><button className="brand" onClick={onReset} aria-label="Accueil StatutPilot"><span><Building2 size={20}/></span>Statut<strong>Pilot</strong></button><div className="header-note"><ShieldCheck size={17}/> Données traitées localement</div><button className="reset" onClick={onReset}><RotateCcw size={15}/> Recommencer</button></header> }
function Footer(){return <footer><span>StatutPilot · Simulation indicative 2026</span><span>Sources officielles et méthodologie documentées</span></footer>}
function Metric({label,values,strong=false}:{label:string;values:number[];strong?:boolean}){return <tr className={strong?'key-metric':''}><td>{label}</td>{values.map((v,i)=><td key={i}>{eur.format(v)}</td>)}</tr>}
