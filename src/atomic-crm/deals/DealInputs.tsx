import {
    AutocompleteArrayInput,
    AutocompleteInput,
    ReferenceArrayInput,
    ReferenceInput,
    TextInput,
    NumberInput,
    SelectInput,
} from '@/components/admin';
import { Separator } from '@/components/ui/separator';
import { useIsMobile } from '@/hooks/use-mobile';
import { required } from 'ra-core';
import { contactOptionText } from '../misc/ContactOption';
import { useConfigurationContext } from '../root/ConfigurationContext';

export const DealInputs = () => {
    const isMobile = useIsMobile();
    return (
        <div className="flex flex-col gap-8">
            <DealInfoInputs />

            <div className={`flex gap-6 ${isMobile ? 'flex-col' : 'flex-row'}`}>
                <DealLinkedToInputs />
                <Separator orientation={isMobile ? 'horizontal' : 'vertical'} />
                <DealMiscInputs />
            </div>
        </div>
    );
};

const DealInfoInputs = () => {
    return (
        <div className="flex flex-col gap-4 flex-1">
            <TextInput
                source="name"
                label="Deal name"
                validate={required()}
                helperText={false}
                labelInline
            />
            <TextInput
                source="description"
                multiline
                rows={3}
                helperText={false}
                labelInline
            />
        </div>
    );
};

const DealLinkedToInputs = () => {
    return (
        <div className="flex flex-col gap-4 flex-1">
            <h3 className="text-base font-medium">Linked to</h3>
            <ReferenceInput source="company_id" reference="companies">
                <AutocompleteInput
                    optionText="name"
                    validate={required()}
                    helperText={false}
                    labelInline
                />
            </ReferenceInput>

            <ReferenceArrayInput
                source="contact_ids"
                reference="contacts_summary"
            >
                <AutocompleteArrayInput
                    label="Contacts"
                    optionText={contactOptionText}
                    helperText={false}
                    validate={required()}
                    labelInline
                />
            </ReferenceArrayInput>
        </div>
    );
};

const DealMiscInputs = () => {
    const { dealStages, dealCategories } = useConfigurationContext();
    return (
        <div className="flex flex-col gap-4 flex-1">
            <h3 className="text-base font-medium">Misc</h3>

            <SelectInput
                source="category"
                label="Category"
                choices={dealCategories.map(type => ({ id: type, name: type }))}
                helperText={false}
                labelInline
            />
            <NumberInput
                source="amount"
                defaultValue={0}
                helperText={false}
                labelInline
                validate={required()}
            />
            <TextInput
                validate={required()}
                source="expected_closing_date"
                helperText={false}
                label="Exp. closing date"
                labelInline
                type="date"
                defaultValue={new Date().toISOString().split('T')[0]}
            />
            <SelectInput
                source="stage"
                choices={dealStages.map(stage => ({
                    id: stage.value,
                    name: stage.label,
                }))}
                defaultValue="opportunity"
                helperText={false}
                validate={required()}
                labelInline
            />
        </div>
    );
};
