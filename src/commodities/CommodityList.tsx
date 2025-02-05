import {
    List,
    Datagrid,
    TextField,
    BooleanField,
    ReferenceField,
} from 'react-admin';

export const CommodityList = () => {
    return (
        <List perPage={25} sort={{ field: 'name', order: 'ASC' }}>
            <Datagrid bulkActionButtons={false}>
                <TextField source="id" />
                <TextField source="name" />
                <ReferenceField reference="materials" source="material_id">
                    <TextField source="name" />
                </ReferenceField>
                <BooleanField source="active" />
            </Datagrid>
        </List>
    );
};
