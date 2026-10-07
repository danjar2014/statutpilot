import { useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, BarChart3, Building2, Check, ChevronDown, Info, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react'
import { defaultSimulationInput, simulate, type SimulationInput } from './domain/simulation'

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const steps = ['Activité', 'Charges', 'Foyer', 'Objectifs']
const expenseFields: { key: keyof SimulationInput['expenses']; label: string; hint: string }[] = [
  { key: 'employees', label: 'Salariés', hint: 'Salaires et charges employeur' },
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
  return <label className="field"><span>{label}</span>{hint && <small>{hint}</small>}<div className="money"><input type="number" min="0" value={value} onChange={e => onChange(Math.max(0, Number(e.target.value)))} /><b>€</b></div></label>
}

export default function App() {
  const [input, setInput] = useState<SimulationInput>(defaultSimulationInput)
  const [step, setStep] = useState(0)
  const [results, setResults] = useState(false)
  const [details, setDetails] = useState<string | null>(null)
  const simulation = useMemo(() => simulate(input), [input])
  const totalExpenses = Object.values(input.expenses).reduce((a, b) => a + b, 0)
  const updateExpense = (key: keyof SimulationInput['expenses'], value: number) => setInput(v => ({ ...v, expenses: { ...v.expenses, [key]: value } }))

  const reset = () => { setInput(defaultSimulationInput); setStep(0); setResults(false) }
  if (results) return <main>
    <Header onReset={reset} />
    <section className="results hero-shell">
      <button className="back" onClick={() => setResults(false)}><ArrowLeft size={17} /> Modifier mes réponses</button>
      <div className="results-title"><div><p className="eyebrow">Votre comparaison personnalisée</p><h1>Cinq statuts, une lecture claire.</h1><p>Sur la base d’un chiffre d’affaires de {eur.format(input.revenue)} et de {eur.format(totalExpenses)} de charges.</p></div><div className="profit"><span>Résultat avant fiscalité personnelle</span><strong>{eur.format(simulation.operatingProfit)}</strong></div></div>
      <div className="notice"><Info size={19}/><span><strong>Simulation indicative.</strong> Les montants comportent des estimations et ne remplacent pas l’avis d’un expert-comptable ou fiscaliste.</span></div>
      <div className="comparison" role="region" aria-label="Comparatif des statuts" tabIndex={0}>
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
      <div className="form-card"><div className="mobile-progress"><span>Étape {step+1} sur 4</span><progress value={step+1} max="4"/></div>
        {step === 0 && <Panel title="Parlons de votre activité" subtitle="Commencez par vos revenus professionnels sur une année complète."><MoneyInput label="Chiffre d’affaires annuel HT" hint="Le total facturé avant TVA" value={input.revenue} onChange={revenue => setInput(v => ({...v,revenue}))}/><label className="field"><span>Dans la SASU à l’IR, exercez-vous l’activité à titre professionnel ?</span><small>Ce choix détermine la nature des prélèvements sociaux sur votre quote-part de bénéfice.</small><select value={input.sasuIrProfessionalActivity ? 'professional' : 'non-professional'} onChange={e => setInput(v => ({...v, sasuIrProfessionalActivity: e.target.value === 'professional'}))}><option value="professional">Oui — activité professionnelle</option><option value="non-professional">Non — activité non professionnelle</option></select></label><div className="summary-line"><span>Charges actuellement renseignées</span><b>{eur.format(totalExpenses)}</b></div></Panel>}
        {step === 1 && <Panel title="Quelles sont vos charges ?" subtitle="Renseignez les montants annuels. Laissez 0 si une catégorie ne vous concerne pas."><div className="fields-grid">{expenseFields.map(f => <MoneyInput key={f.key} label={f.label} hint={f.hint} value={input.expenses[f.key]} onChange={n => updateExpense(f.key,n)}/>)}</div><div className="summary-line"><span>Total des charges annuelles</span><b>{eur.format(totalExpenses)}</b></div></Panel>}
        {step === 2 && <Panel title="Votre foyer fiscal" subtitle="Ces informations servent uniquement à estimer votre impôt sur le revenu."><label className="field"><span>Situation familiale</span><select value={input.household.maritalStatus} onChange={e => setInput(v=>({...v,household:{...v.household,maritalStatus:e.target.value as 'single'|'couple'}}))}><option value="single">Célibataire</option><option value="couple">Marié(e) ou pacsé(e)</option></select></label><MoneyInput label="Revenu net imposable annuel du conjoint" value={input.household.spouseTaxableIncome} onChange={spouseTaxableIncome=>setInput(v=>({...v,household:{...v.household,spouseTaxableIncome}}))}/><label className="field"><span>Nombre d’enfants à charge</span><input type="number" min="0" max="10" value={input.household.children} onChange={e=>setInput(v=>({...v,household:{...v.household,children:Number(e.target.value)}}))}/></label></Panel>}
        {step === 3 && <Panel title="Vos objectifs de rémunération" subtitle="Dites-nous ce que vous souhaitez percevoir et conserver pour investir."><div className="fields-grid"><MoneyInput label="Rémunération nette annuelle souhaitée" value={input.desiredNetSalary} onChange={desiredNetSalary=>setInput(v=>({...v,desiredNetSalary}))}/><MoneyInput label="Capital social" value={input.shareCapital} onChange={shareCapital=>setInput(v=>({...v,shareCapital}))}/><MoneyInput label="Dividendes souhaités" value={input.desiredDividends} onChange={desiredDividends=>setInput(v=>({...v,desiredDividends}))}/><label className="field"><span>Réinvestissement via holding</span><small>Part du résultat que vous souhaitez conserver</small><div className="range-value">{Math.round(input.holdingReinvestmentRate)}%</div><input type="range" min="0" max="100" step="5" value={input.holdingReinvestmentRate} onChange={e=>setInput(v=>({...v,holdingReinvestmentRate:Number(e.target.value)}))}/></label></div></Panel>}
        <div className="actions"><button className="secondary" disabled={step===0} onClick={()=>setStep(s=>s-1)}><ArrowLeft size={17}/> Précédent</button>{step<3?<button className="primary" onClick={()=>setStep(s=>s+1)}>Continuer <ArrowRight size={17}/></button>:<button className="primary" onClick={()=>setResults(true)}>Voir ma comparaison <ArrowRight size={17}/></button>}</div>
      </div></div>
  </section><Footer/></main>
}

function Panel({title,subtitle,children}:{title:string;subtitle:string;children:ReactNode}) { return <div className="panel"><span className="step-label">Questionnaire guidé</span><h2>{title}</h2><p>{subtitle}</p><div className="panel-fields">{children}</div></div> }
function Header({onReset}:{onReset:()=>void}) { return <header><button className="brand" onClick={onReset} aria-label="Accueil StatutPilot"><span><Building2 size={20}/></span>Statut<strong>Pilot</strong></button><div className="header-note"><ShieldCheck size={17}/> Données traitées localement</div><button className="reset" onClick={onReset}><RotateCcw size={15}/> Recommencer</button></header> }
function Footer(){return <footer><span>StatutPilot · Simulation indicative 2026</span><span>Sources officielles et méthodologie documentées</span></footer>}
function Metric({label,values,strong=false}:{label:string;values:number[];strong?:boolean}){return <tr className={strong?'key-metric':''}><td>{label}</td>{values.map((v,i)=><td key={i}>{eur.format(v)}</td>)}</tr>}
