
import React from 'react';
import { useUserStore } from '../state/userStore';
import { useUILabels } from '../state/uiLabelsStore';

interface Props {
    id: string;
    text: string;
    onEdit: (id: string, currentText: string) => void;
    children: React.ReactNode;
    className?: string;
}

export const EditableElement: React.FC<Props> = ({ id, text, onEdit, children, className }) => {
    const { isEditMode, isMaster } = useUserStore();
    const { getLabel } = useUILabels();

    // Get the dynamic label from store
    const dynamicText = getLabel(id, text);

    if (isMaster && isEditMode) {
        return (
            <div
                className={`relative group cursor-help ${className}`}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEdit(id, dynamicText);
                }}
            >
                {/* Visual marker for editable area */}
                <div className="absolute -inset-1 border-2 border-primary border-dashed rounded-xl opacity-50 group-hover:opacity-100 transition-opacity z-50 pointer-events-none" />
                <div className="absolute -top-3 -right-3 size-6 bg-primary text-black rounded-full flex items-center justify-center z-[51] shadow-lg">
                    <span className="material-symbols-outlined text-sm font-black">edit_note</span>
                </div>

                {/* Clone children but replace text if it's a simple string, 
                    OR just render children if they handle content themselves.
                    In this case, we expect children to be the visual button, 
                    and we might need to "inject" the dynamic text into them if they are just strings.
                */}
                {children}
            </div>
        );
    }

    return <>{children}</>;
};
