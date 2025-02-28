import UploadIcon from '@mui/icons-material/Upload';
import { useState } from 'react';
import { Button } from 'react-admin';
import { CandidateImportDialog } from './CandidateImportDialog';

export const CandidateImportButton = () => {
    const [modalOpen, setModalOpen] = useState(false);

    const handleOpenModal = () => {
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
    };

    return (
        <>
            <Button
                startIcon={<UploadIcon />}
                label="Import"
                onClick={handleOpenModal}
            />
            <CandidateImportDialog open={modalOpen} onClose={handleCloseModal} />
        </>
    );
};
