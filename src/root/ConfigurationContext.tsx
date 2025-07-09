import { createContext, ReactNode, useContext } from 'react';
import {
    defaultCompanySectors,
    defaultContactGender,
    defaultEngagementCategories,
    defaultEngagementPipelineStatuses,
    defaultEngagementStages,
    defaultLogo,
    defaultNoteStatuses,
    defaultTaskTypes,
    defaultTitle,
} from './defaultConfiguration';
import { ContactGender, EngagementStage, NoteStatus } from '../types';

// Define types for the context value
export interface ConfigurationContextValue {
    companySectors: string[];
    engagementCategories: string[];
    engagementPipelineStatuses: string[];
    engagementStages: EngagementStage[];
    noteStatuses: NoteStatus[];
    taskTypes: string[];
    title: string;
    logo: string;
    contactGender: ContactGender[];
}

export interface ConfigurationProviderProps extends ConfigurationContextValue {
    children: ReactNode;
}

// Create context with default value
export const ConfigurationContext = createContext<ConfigurationContextValue>({
    companySectors: defaultCompanySectors,
    engagementCategories: defaultEngagementCategories,
    engagementPipelineStatuses: defaultEngagementPipelineStatuses,
    engagementStages: defaultEngagementStages,
    noteStatuses: defaultNoteStatuses,
    taskTypes: defaultTaskTypes,
    title: defaultTitle,
    logo: defaultLogo,
    contactGender: defaultContactGender,
});

export const ConfigurationProvider = ({
    children,
    companySectors,
    engagementCategories,
    engagementPipelineStatuses,
    engagementStages,
    logo,
    noteStatuses,
    taskTypes,
    title,
    contactGender,
}: ConfigurationProviderProps) => (
    <ConfigurationContext.Provider
        value={{
            companySectors,
            engagementCategories,
            engagementPipelineStatuses,
            engagementStages,
            logo,
            noteStatuses,
            title,
            taskTypes,
            contactGender,
        }}
    >
        {children}
    </ConfigurationContext.Provider>
);

export const useConfigurationContext = () => useContext(ConfigurationContext);
