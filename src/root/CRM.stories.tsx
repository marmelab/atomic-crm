import type { Meta, StoryObj } from '@storybook/react';

import { CRM } from './CRM';
import { dataProvider, authProvider } from '../providers/fakerest';

const meta: Meta<typeof CRM> = {
    component: CRM,
};

export default meta;
type Story = StoryObj<typeof CRM>;

export const Basic: Story = {
    args: {
        dataProvider,
        authProvider,
    },
};

export const Layout: Story = {
    args: {
        dataProvider,
        authProvider,
        layout: ({ children }) => <div>{children}</div>,
    },
};
