import { lazy } from 'react';
const DealList = lazy(() => import('./DealList'));

export default {
    list: DealList,
};
