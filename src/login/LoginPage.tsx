import { useQuery } from '@tanstack/react-query';
import { useDataProvider } from 'react-admin';
import { Navigate, useNavigate } from 'react-router-dom';
import { CrmDataProvider } from '../providers/types';
import { LoginForm } from './LoginForm';
import { LoginSkeleton } from './LoginSkeleton';
import { useState } from 'react';
import AuthChecker from '../utils/helperFunctions';

export const LoginPage = () => {
    const navigate = useNavigate();
    const dataProvider = useDataProvider<CrmDataProvider>();
    const {
        data: isInitialized,
        error,
        isPending,
    } = useQuery({
        queryKey: ['init'],
        queryFn: async () => {
            return dataProvider.isInitialized();
        },
    });
    const [isLoading, setIsLoading] = useState(true);
    AuthChecker({ navigate, setIsLoading });

    if (isPending || isLoading) return <LoginSkeleton />;
    return <LoginForm />;
};
