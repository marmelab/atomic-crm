/* eslint-disable import/no-anonymous-default-export */
import { CandidateShow } from './CandidateShow';
import { CandidateList } from './CandidateList';
import { CandidateEdit } from './CandidateEdit';
import { CandidateCreate } from './CandidateCreate';
import { Candidate } from '../types';

export default {
    list: CandidateList,
    show: CandidateShow,
    edit: CandidateEdit,
    create: CandidateCreate,
    recordRepresentation: (record: Candidate) =>
        record?.first_name + ' ' + record?.last_name,
};
