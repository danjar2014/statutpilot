# StatutPilot

Simulateur pédagogique en français pour comparer cinq cadres d'exercice : **SASU à l'IS**, **SASU à l'IR**, **SASU à l'IS avec holding**, **EURL à l'IR** et **EURL à l'IS**.

L'application commence par un questionnaire guidé, calcule les charges modulables et affiche un comparatif lisible du net personnel, des cotisations, de l'IR, de l'IS, des prélèvements sur le capital et de la trésorerie conservée.

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
- SASU à l'IR : scénario expérimental. L'application distingue désormais l'activité professionnelle (contributions sur revenus d'activité estimées) de l'activité non professionnelle (prélèvements sociaux sur le patrimoine à 18,6 % en 2026). Le calcul social n'est pas couvert par le simulateur officiel Urssaf et doit être validé au cas par cas.

Toutes les sorties différencient les règles officielles, les estimations et les points à valider.

## Sources officielles

Sources vérifiées le **7 octobre 2026** :

- [Impôts — taux d'IS et taux réduit PME](https://www.impots.gouv.fr/professionnel/imposition-des-resultats)
- [Impôts — PFU et prélèvements sur revenus mobiliers](https://www.impots.gouv.fr/particulier/questions/jai-des-valeurs-mobilieres-comment-sont-elles-imposees)
- [Service-Public — prélèvements sociaux 2026](https://www.service-public.fr/particuliers/vosdroits/F34913/1_3)
- [Service-Public Entreprendre — régime fiscal et social de l'EURL](https://entreprendre.service-public.fr/vosdroits/F37777)
- [Urssaf — cotisations des indépendants](https://www.urssaf.fr/accueil/independant/comprendre-payer-cotisations/vos-cotisations.html)
- [Urssaf — simulateur SASU et limite SASU à l'IR](https://mon-entreprise.urssaf.fr/simulateurs/comparaison-r%C3%A9gimes-sociaux/SASU/dirigeant/assimil%C3%A9-salari%C3%A9)
- [BOFiP — conditions de l'option SAS/SASU à l'IR](https://bofip.impots.gouv.fr/bofip/3600-PGP.html/identifiant%3DBOI-BIC-CHAMP-70-20-40-10-20160302)
- [BOFiP — durée maximale de cinq exercices de l'option IR](https://bofip.impots.gouv.fr/bofip/3601-PGP.html/identifiant%3DBOI-BIC-CHAMP-70-20-40-20-20140325)
- [BOFiP — régime mère-fille et quote-part](https://bofip.impots.gouv.fr/bofip/1926-PGP.html/identifiant%3DBOI-IS-BASE-10-10-20-20240626)
- [BOFiP — barème IR publié en 2026](https://bofip.impots.gouv.fr/bofip/2491-PGP.html/identifiant%3DBOI-IR-LIQ-20-10-20260407)

## Déploiement Render

Le Blueprint `render.yaml` crée un site statique gratuit. Render construit avec `npm ci && npm run build`, publie `dist/` et redéploie automatiquement chaque commit de la branche suivie.

