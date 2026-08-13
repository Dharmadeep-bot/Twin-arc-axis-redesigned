import React, { useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import StudyHome from './StudyHome';
import StudyDetail from './StudyDetail';
import Ribbon from './Ribbon';
import WindStudy from '../WindStudy/WindStudy';
import './ScientificStudies.css';

const ScientificStudies = ({ isDarkMode, setIsDarkMode }) => {
    const [selectedStudyId, setSelectedStudyId] = useState(null);
    const studyDetailRef = useRef(null);
    const location = useLocation();
    const isWindStudy = location.pathname === '/wind-study';

    const handleSelectStudy = (id) => {
        setSelectedStudyId(id);
    };

    const handleAddComparisonUnit = () => {
        if (studyDetailRef.current && studyDetailRef.current.handleAddRow) {
            studyDetailRef.current.handleAddRow();
        }
    };

    return (
        <div className={`h-full w-full box-border transition-colors duration-200 flex flex-col ${isDarkMode ? 'bg-[#1e1e1e] text-slate-100' : 'bg-[#f3f3f3] text-slate-900'}`}>
            <Ribbon
                selectedStudyId={selectedStudyId}
                onSelectStudy={handleSelectStudy}
                onAddComparisonUnit={handleAddComparisonUnit}
                isDarkMode={isDarkMode}
                setIsDarkMode={setIsDarkMode}
            />

            {isWindStudy ? (
                <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
                    <WindStudy isDarkMode={isDarkMode} />
                </div>
            ) : (
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
            )}
        </div>
    );
};

export default ScientificStudies;
