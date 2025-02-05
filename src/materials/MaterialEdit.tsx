import {
    Edit,
    Form,
    Toolbar,
    TextInput,
    required,
    SaveButton,
    BooleanInput,
} from 'react-admin';

import { Card, CardContent } from '@mui/material';

export const MaterialEdit = () => {
    return (
        <Edit mutationMode="pessimistic" redirect="list">
            <Form>
                <Card>
                    <CardContent>
                        <TextInput source="id" label="Material ID" disabled />
                        <TextInput
                            source="name"
                            label="Material Name"
                            validate={required()}
                            id="material:name"
                            autoComplete="off"
                        />
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
