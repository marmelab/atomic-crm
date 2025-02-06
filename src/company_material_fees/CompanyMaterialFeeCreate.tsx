import {
    Create,
    SimpleForm,
    ReferenceInput,
    AutocompleteInput,
    NumberInput,
    useGetList,
} from 'react-admin';

import { useMemo } from 'react';

import { useLocation } from 'react-router-dom';

const helperText = (
    <>
        <span style={{ display: 'block' }}>
            Fee ($ per load) charged by the agent; this fee can be overridden by
            material or commodity fees.
        </span>
        <span>Up to 2 decimal values are allowed.</span>
    </>
);

export const CreateFee = () => {
    const loc = useLocation();

    const data = useGetList('company_material_fees', {
        filter: {
            company_id: loc.state?.record?.company_id,
        },
    });

    const present = useMemo(() => {
        const ret = (data.data ?? []).map(v => v.material_id);

        return ret;
    }, [data]);

    return (
        <Create
            redirect={(_resource, _id, data) => {
                return `companies/${data!.company_id}/show/agent_fees`;
            }}
        >
            <SimpleForm>
                <ReferenceInput source="company_id" reference="companies" load>
                    <AutocompleteInput
                        optionText="name"
                        helperText={false}
                        readOnly
                        loading={data.isPending ? true : undefined}
                    />
                </ReferenceInput>

                <ReferenceInput
                    source="material_id"
                    reference="materials"
                    filter={{
                        active: true,
                        'id@not.in': '(' + present.join(',') + ')',
                    }}
                >
                    <AutocompleteInput
                        optionText="name"
                        helperText="only active materials are displayed that are not yet used for this company"
                    />
                </ReferenceInput>

                <NumberInput source="fee" min={0} helperText={helperText} />
            </SimpleForm>
        </Create>
    );
};
