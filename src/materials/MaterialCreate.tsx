import { CreateBase, Form, Toolbar, TextInput, required } from 'react-admin';
import { Card, CardContent } from '@mui/material';

export const MaterialCreate = () => {
    return (
        <CreateBase redirect="list">
            <Form>
                <Card>
                    <CardContent>
                        <TextInput
                            source="name"
                            label="Material Name"
                            validate={required()}
                            id="material:name"
                            autoComplete="off"
                        />
                    </CardContent>
                    <Toolbar />
                </Card>
            </Form>
        </CreateBase>
    );
};
