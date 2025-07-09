import { random, lorem } from 'faker/locale/en_US';

import { Db } from './types';
import { randomDate } from './utils';

export const generateEngagementNotes = (db: Db) => {
    return Array.from(Array(300).keys()).map(id => {
        const engagement = random.arrayElement(db.engagements);
        return {
            id,
            engagement_id: engagement.id,
            text: lorem.paragraphs(random.number({ min: 1, max: 4 })),
            date: randomDate(
                new Date(db.engagements[engagement.id as number].created_at)
            ).toISOString(),
            sales_id: engagement.sales_id,
        };
    });
};
