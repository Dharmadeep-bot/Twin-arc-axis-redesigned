import React, { useState, useRef } from 'react';
import StudyHome from './StudyHome';
import StudyDetail from './StudyDetail';
import Ribbon from './Ribbon';
import './ScientificStudies.css';

const ScientificStudies = ({ isDarkMode, setIsDarkMode }) => {
    const [selectedStudyId, setSelectedStudyId] = useState(null);
    const studyDetailRef = useRef(null);

    const handleSelectStudy = (id) => {
        setSelectedStudyId(id);
    };

    const handleAddComparisonUnit = () => {
        if (studyDetailRef.current && studyDetailRef.current.handleAddRow) {
            studyDetailRef.current.handleAddRow();
        }
    };

    return (
        <div className={`min-h-[calc(100vh-56px)] w-full box-border transition-colors duration-200 ${isDarkMode ? 'bg-[#1e1e1e] text-slate-100' : 'bg-[#f3f3f3] text-slate-900'}`}>
            <Ribbon 
                selectedStudyId={selectedStudyId}
                onSelectStudy={handleSelectStudy}
                onAddComparisonUnit={handleAddComparisonUnit}
                isDarkMode={isDarkMode}
                setIsDarkMode={setIsDarkMode}
            />
            
            <div className="px-4 py-3">
                {!selectedStudyId ? (
                    <StudyHome onSelectStudy={handleSelectStudy} isDarkMode={isDarkMode} />
                ) : (
                    <StudyDetail
                        ref={studyDetailRef}
                        studyId={selectedStudyId}
                        isDarkMode={isDarkMode}
                        onBack={() => setSelectedStudyId(null)}
                        onSelectStudy={handleSelectStudy}
                    />
                )}
            </div>
        </div>
    );
};

export default ScientificStudies;
