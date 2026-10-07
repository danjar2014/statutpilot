# StatutPilot

Simulateur pédagogique en français pour comparer **SASU à l'IS**, **SASU à l'IR**, **SASU à l'IS avec holding**, **EURL à l'IR**, **EURL à l'IS**, la **micro-entreprise** sur deux années et le **portage salarial**.

L'application commence par un questionnaire guidé : l'utilisateur choisit au moins deux formes à confronter, puis renseigne son activité, ses charges, son foyer et ses choix de rémunération. Après la simulation, un moteur de conseil analyse les résultats réellement calculés — net personnel, trésorerie conservée, valeur économique totale, protection sociale, simplicité et adéquation avec les souhaits saisis — pour proposer l'option la plus adaptée. Le conseil fournit des raisons chiffrées, une alternative proche, un niveau de confiance et un point de vigilance.

Le chiffre d'affaires peut être saisi directement ou calculé automatiquement à partir du **TJM HT × nombre de jours facturés**. Pour la SASU à l'IS comme à l'IR, avec ou sans holding, l'utilisateur choisit explicitement une simulation **avec salaire** ou **sans salaire**. Le coût total du salaire est estimé à 1,82 fois le net. À l'IS il est déduit du résultat fiscal; à l'IR la rémunération du président associé n'est pas déduite du bénéfice attribué à l'associé et le moteur retient, par prudence, la non-déduction du coût social estimé. La rémunération EURL reste indépendante afin de ne pas fausser la comparaison.

Elle calcule ensuite les charges modulables et affiche un comparatif lisible du net personnel, des cotisations, de l'IR, de l'IS, des prélèvements sur le capital et de la trésorerie conservée.

Pour les salariés, l'utilisateur renseigne l'effectif et le salaire brut mensuel moyen. L'application calcule le brut annuel, les charges patronales estimées et le coût employeur total. Le taux d'estimation est centralisé dans la configuration annuelle.

> **Avertissement** — Cette application fournit une estimation pédagogique. Elle ne constitue ni un conseil fiscal, comptable, social ou juridique, ni une prise de position de l'administration. Faites valider toute décision par un professionnel et les organismes compétents.

## Démarrage

```bash
npm install
npm run dev
```

Vérifications :

```bash
npm test
npm run build
```

## Architecture

- `src/config/fiscal-2026.ts` : hypothèses et taux centralisés, modifiables pour une mise à jour annuelle.
- `src/domain/simulation.ts` : moteur de calcul pur, sans dépendance à l'interface.
- `src/domain/simulation.test.ts` : tests des règles structurantes et invariants.
- `src/App.tsx` : parcours guidé et tableau comparatif.
- `render.yaml` : déploiement statique Render avec auto-deploy depuis GitHub.

## Principales hypothèses 2026

- IS : 15 % jusqu'à 42 500 € puis 25 %, sous conditions d'éligibilité au taux réduit.
- Dividendes de SASU : PFU par défaut de 31,4 % en 2026, soit 12,8 % d'IR et 18,6 % de prélèvements sociaux.
- EURL, gérant associé unique : statut TNS. À l'IR, assiette sociale sur le bénéfice ; à l'IS, sur la rémunération et la fraction des dividendes dépassant 10 % du capital. Le montant de cotisations reste une approximation paramétrable : les taux réels sont progressifs, plafonnés et dépendent de l'activité.
- Holding : régime mère-fille modélisé avec une quote-part de frais et charges de 5 % soumise à l'IS, sous réserve des conditions de détention.
- IR : barème publié en 2026 applicable aux revenus 2025 utilisé comme proxy. Le plafonnement du quotient familial, la décote, les crédits/réductions et de nombreux cas particuliers ne sont pas reproduits.
- SASU à l'IR : scénario expérimental. Par choix de modélisation, l'application applique directement 18,6 % de prélèvements sociaux à la totalité du bénéfice et ne demande plus de qualifier l'activité de professionnelle ou non professionnelle. Un éventuel salaire de président supporte en plus les cotisations d'assimilé salarié estimées; son coût réduit la trésorerie mais pas le bénéfice fiscal attribué à l'associé. Le simulateur officiel Urssaf ne couvre pas la SASU à l'IR : ce traitement doit être validé au cas par cas.
- Micro-entreprise : cotisations et CFP calculées sur 100 % du CA encaissé. L'IR est estimé après l'abattement micro correspondant à l'activité; les charges réelles diminuent le cash mais ne sont pas fiscalement déductibles. Le seuil 2026 est de 83 600 € pour les services/BNC et 203 100 € pour la vente.
- ACRE micro : l'année 1 avec/sans ACRE et l'année 2 avec reliquat/sans ACRE sont comparées. Le reliquat dépend du trimestre de création. Pour les créations à compter du 1er juillet 2026, l'exonération n'est plus que de 25 % des cotisations concernées.
- Portage salarial : estimation à partir du CA HT, des frais de gestion saisis, des frais professionnels remboursables, puis des cotisations patronales et salariales. Les conventions et pratiques de chaque société de portage peuvent modifier fortement le résultat.

Toutes les sorties différencient les règles officielles, les estimations et les points à valider.

## Crédits visuels

- [Consultante indépendante dans un bureau — Anna Shvets / Pexels](https://www.pexels.com/photo/woman-laptop-freelancer-indoors-12662856/)
- [Équipe analysant des graphiques — olia danilevich / Pexels](https://www.pexels.com/photo/persons-using-laptops-on-table-with-charts-8145328/)

Les images sont servies dans des dimensions adaptées via le CDN Pexels. L’image située sous les résultats est chargée à la demande pour préserver les performances.

## Sources officielles

Sources vérifiées le **7 octobre 2026** :

- [Impôts — taux d'IS et taux réduit PME](https://www.impots.gouv.fr/professionnel/imposition-des-resultats)
- [Impôts — PFU et prélèvements sur revenus mobiliers](https://www.impots.gouv.fr/particulier/questions/jai-des-valeurs-mobilieres-comment-sont-elles-imposees)
- [Service-Public — prélèvements sociaux 2026](https://www.service-public.fr/particuliers/vosdroits/F34913/1_3)
- [Service-Public Entreprendre — régime fiscal et social de l'EURL](https://entreprendre.service-public.fr/vosdroits/F37777)
- [Urssaf — cotisations des indépendants](https://www.urssaf.fr/accueil/independant/comprendre-payer-cotisations/vos-cotisations.html)
- [Urssaf — simulateur SASU et limite SASU à l'IR](https://mon-entreprise.urssaf.fr/simulateurs/comparaison-r%C3%A9gimes-sociaux/SASU/dirigeant/assimil%C3%A9-salari%C3%A9)
- [BOFiP — rémunération non déductible des associés de SAS ayant opté pour l'IR](https://bofip.impots.gouv.fr/bofip/6333-PGP.html/identifiant=BOI-RSA-GER-10-30-20221215)
- [BOFiP — conditions de l'option SAS/SASU à l'IR](https://bofip.impots.gouv.fr/bofip/3600-PGP.html/identifiant%3DBOI-BIC-CHAMP-70-20-40-10-20160302)
- [BOFiP — durée maximale de cinq exercices de l'option IR](https://bofip.impots.gouv.fr/bofip/3601-PGP.html/identifiant%3DBOI-BIC-CHAMP-70-20-40-20-20140325)
- [BOFiP — régime mère-fille et quote-part](https://bofip.impots.gouv.fr/bofip/1926-PGP.html/identifiant%3DBOI-IS-BASE-10-10-20-20240626)
- [BOFiP — barème IR publié en 2026](https://bofip.impots.gouv.fr/bofip/2491-PGP.html/identifiant%3DBOI-IR-LIQ-20-10-20260407)
- [Service-Public — seuils micro-entreprise 2026](https://entreprendre.service-public.fr/vosdroits/F32353)
- [Urssaf — taux micro et ACRE à compter du 1er juillet 2026](https://www.urssaf.fr/files/live/sites/urssaffr/files/autres/Diaporama_Auto-entrepreneur.pdf)
- [Légifrance — calcul du montant disponible en portage salarial](https://www.legifrance.gouv.fr/conv_coll/article/KALIARTI000050004613)

## Déploiement Render

Le Blueprint `render.yaml` crée un site statique gratuit. Render construit avec `npm ci && npm run build`, publie `dist/` et redéploie automatiquement chaque commit de la branche suivie.

