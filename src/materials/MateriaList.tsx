import { List, Datagrid, TextField, BooleanField } from 'react-admin';

export const MaterialsList = () => {
    return (
        <List perPage={25} sort={{ field: 'name', order: 'ASC' }}>
            <Datagrid bulkActionButtons={false}>
                <TextField source="id" />
                <TextField source="name" />
                <BooleanField source="active" />
            </Datagrid>
        </List>
    );
};
