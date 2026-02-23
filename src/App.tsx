import { CRM } from "@/components/atomic-crm/root/CRM";

/**
 * Application entry point
 *
 * Customize Atomic CRM by passing props to the CRM component:
 *  - companySectors
 *  - darkTheme
 *  - dealCategories
 *  - dealPipelineStatuses
 *  - dealStages
 *  - lightTheme
 *  - logo
 *  - noteStatuses
 *  - taskTypes
 *  - title
 * ... as well as all the props accepted by shadcn-admin-kit's <Admin> component.
 *
 * @example
 * const App = () => (
 *    <CRM
 *       logo="./img/logo.png"
 *       title="Acme CRM"
 *    />
 * );
 */
const App = () => (
    <CRM
        title="Road to 100M€"
        contactGender={[
            { value: 'male', label: 'He' },
            { value: 'female', label: 'She' },
        ]}
        companySectors={['Partenaire', 'Client Final', 'Fournisseur', 'Autres']}
        dealCategories={['HIT', 'Réseaux','Sécurité','Cross BU']}
        dealPipelineStatuses={['won']}
        dealStages={[
            { value: 'opportunity', label: 'Leads' },
            { value: 'proposal-sent', label: 'Proposition envoyée' },
            { value: 'won', label: 'Gagné' },
            { value: 'lost', label: 'Perdu' },
          { value: 'delayed', label: 'Repoussé' },
        ]}
        noteStatuses={[
            { value: 'cold', label: 'Cold', color: '#7dbde8' },
            { value: 'warm', label: 'Warm', color: '#e8cb7d' },
            { value: 'hot', label: 'Hot', color: '#e88b7d' },
        ]}
        taskTypes={['Appel', 'Email', 'RDV']}
    />
);

export default App;
