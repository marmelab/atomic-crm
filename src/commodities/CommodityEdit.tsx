import {
    Edit,
    Form,
    Toolbar,
    TextInput,
    required,
    SaveButton,
    BooleanInput,
    ReferenceInput,
    AutocompleteInput,
    useCreate,
    useNotify,
} from 'react-admin';

import { Card, CardContent } from '@mui/material';

export const CommodityEdit = () => {
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
        <Edit mutationMode="pessimistic" redirect="list">
            <Form>
                <Card>
                    <CardContent>
                        <TextInput source="id" label="Material ID" disabled />
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
                            />
                        </ReferenceInput>
                        <BooleanInput source="active" />
                    </CardContent>
                    <Toolbar>
                        <SaveButton />
                    </Toolbar>
                </Card>
            </Form>
        </Edit>
    );
};
