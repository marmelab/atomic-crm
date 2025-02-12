import {
    CreateBase,
    Form,
    Toolbar,
    TextInput,
    AutocompleteInput,
    ReferenceInput,
    useCreate,
    useNotify,
    required,
} from 'react-admin';
import { Card, CardContent } from '@mui/material';

export const CommodityCreate = () => {
    const [create] = useCreate();

    const notify = useNotify();

    const handleCreate = async (name?: string) => {
        if (!name) return;
        try {
            const val = await create(
                'materials',
                {
                    data: {
                        name,
                    },
                },
                { returnPromise: true }
            );
            return val;
        } catch (error) {
            notify('An error occurred while creating the material', {
                type: 'error',
            });
        }
    };

    return (
        <CreateBase redirect="list">
            <Form>
                <Card>
                    <CardContent>
                        <TextInput
                            source="name"
                            label="Commodity Name"
                            validate={required()}
                            id="commodity:name"
                            autoComplete="off"
                        />

                        <ReferenceInput
                            source="material_id"
                            reference="materials"
                        >
                            <AutocompleteInput
                                optionText="name"
                                onCreate={handleCreate}
                                helperText={false}
                                filterToQuery={(q: string) => {
                                    return {
                                        'name@ilike': q,
                                    };
                                }}
                            />
                        </ReferenceInput>
                    </CardContent>
                    <Toolbar />
                </Card>
            </Form>
        </CreateBase>
    );
};
