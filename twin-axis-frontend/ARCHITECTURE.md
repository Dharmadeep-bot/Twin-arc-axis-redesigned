# Component Architecture

This document outlines the modular component structure of the Pairplot Dashboard application.

## Component Hierarchy

```
App.jsx (Main Application)
├── ThemeToggle.jsx (Theme selection)
├── ControlPanel.jsx (Left sidebar)
│   ├── UploadZone.jsx (File upload area)
│   └── DatasetCard.jsx (Individual dataset management)
├── PairplotMatrix.jsx (Main pairplot visualization)
└── DetailPanel.jsx (Right sidebar)
    └── PlotCard.jsx (Individual plot with notes)
```

## Component Descriptions

### Core Components

#### **App.jsx**
- Main application container
- Manages global state (datasets, selections, UI state, theme)
- Handles file upload, data processing, and event coordination
- Orchestrates communication between all child components

### UI Components

#### **ThemeToggle.jsx**
- Theme selection dropdown
- Manages theme menu visibility
- Provides 5 color themes (Cyan, Emerald, Sunset, Rose, Violet)
- **Props**: `currentTheme`, `onThemeChange`

#### **ControlPanel.jsx**
- Left sidebar container
- Manages datasets, column selection, and settings
- **Props**: `datasets`, `maxPoints`, `isLoading`, `isDragOver`, `sidebarCollapsed`, event handlers
- **Children**: UploadZone, DatasetCard

#### **UploadZone.jsx**
- File upload interface (drag & drop or click)
- Compact mode when datasets exist
- **Props**: `isDragOver`, `hasDatasets`, `onDragOver`, `onDragLeave`, `onDrop`, `onFileSelect`

#### **DatasetCard.jsx**
- Individual dataset display and management
- Column selection interface
- Dataset removal
- **Props**: `dataset`, `onToggleColumn`, `onToggleAll`, `onRemove`

#### **PairplotMatrix.jsx**
- Renders pairplot matrix visualization
- Handles cell clicks for detail view
- Dynamic theme color support
- **Props**: `data`, `selectedColumns`, `maxPoints`, `onCellClick`

#### **DetailPanel.jsx**
- Right sidebar container
- Manages selected plot cards
- Collapsible with floating toggle button
- **Props**: `selectedCells`, `datasets`, `maxPoints`, `collapsed`, `onToggle`, `onRemoveCell`
- **Children**: PlotCard

#### **PlotCard.jsx**
- Individual plot display with flip animation
- Front: Plot visualization with metadata
- Back: Note-taking interface
- LocalStorage persistence for notes
- **Props**: `cell`, `dataset`, `maxPoints`, `onRemove`, `themeVersion`

### Utility Components

#### **Icons.jsx**
- Centralized icon components
- Exports: UploadIcon, FileIcon, CheckIcon, XIcon, ChartIcon, ColumnsIcon, SparklesIcon, MenuIcon, ChevronLeftIcon, ChevronRightIcon, SettingsIcon, PaletteIcon, EditIcon

## Data Flow

### State Management
- **App.jsx** holds all primary state
- Props flow down to child components
- Event handlers bubble up to App.jsx

### Key State Objects

#### Dataset Object
```javascript
{
  id: string,           // Unique identifier
  name: string,         // File name
  data: Array,          // Parsed CSV data
  columns: Array,       // Numeric column names
  selectedColumns: Array, // User-selected columns
  fileInfo: {           // File metadata
    name: string,
    size: number,
    rows: number,
    cols: number
  }
}
```

#### Cell Object
```javascript
{
  datasetId: string,    // Reference to dataset
  row: number,          // Matrix row index
  col: number           // Matrix column index
}
```

## Benefits of Modular Architecture

1. **Separation of Concerns**: Each component has a single, well-defined responsibility
2. **Reusability**: Components like DatasetCard and PlotCard can be easily reused
3. **Maintainability**: Easier to locate and fix bugs in isolated components
4. **Scalability**: New features can be added as new components without affecting existing code
5. **Testing**: Individual components can be tested in isolation
6. **Code Organization**: Clear file structure makes navigation easier

## File Structure

```
src/
├── App.jsx
├── App.css
├── index.css
├── components/
│   ├── ControlPanel.jsx
│   ├── DatasetCard.jsx
│   ├── DetailPanel.jsx
│   ├── Icons.jsx
│   ├── PairplotMatrix.jsx
│   ├── PlotCard.jsx
│   ├── ThemeToggle.jsx
│   └── UploadZone.jsx
└── utils/
    └── dataUtils.js
```

## Future Enhancements

With this modular structure, you can easily:
- Add new visualization types by creating new components
- Implement different upload methods (URL, API, etc.)
- Create custom themes by extending ThemeToggle
- Add export/import functionality for notes
- Implement collaborative features
- Add data transformation pipelines
