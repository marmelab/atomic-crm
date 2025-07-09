/* eslint-disable import/no-anonymous-default-export */
import * as React from 'react';
const EngagementList = React.lazy(() => import('./EngagementList'));

export default {
    list: EngagementList,
};
