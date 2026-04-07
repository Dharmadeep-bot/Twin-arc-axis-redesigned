"""
Flask Backend for Causal Analysis App
Handles dataset processing, graph generation, and preprocessing
"""

from flask import Flask, jsonify, request, send_from_directory, send_file
from flask_cors import CORS
import os
import pandas as pd
import numpy as np
from numpy.linalg import eig, det
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import json
from datetime import datetime
app = Flask(__name__)
CORS(app, origins=[
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://axis.dev.twinarcpro.eminds.ai"
])

from fourthapp_routes import fourthapp_bp  # noqa: E402
app.register_blueprint(fourthapp_bp)

# --- Causal Code Integration ---
from causal_routes import causal_bp
app.register_blueprint(causal_bp)

import configparser

# Configuration
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(BACKEND_DIR)
PROPERTIES_PATH = os.path.join(BACKEND_DIR, 'properties', 'local_properties.ini')

config = configparser.ConfigParser()
if os.path.exists(PROPERTIES_PATH):
    config.read(PROPERTIES_PATH)
    DATASET_DIR = os.path.abspath(os.path.join(BACKEND_DIR, config.get('backend', 'dataset_dir', fallback='dataset')))
    OUTPUT_DIR = os.path.abspath(os.path.join(BACKEND_DIR, config.get('backend', 'output_dir', fallback='output')))
else:
    DATASET_DIR = os.path.join(BACKEND_DIR, 'dataset')
    OUTPUT_DIR = os.path.join(BACKEND_DIR, 'output')

# Ensure directories exist
os.makedirs(DATASET_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

GASIFIER_STUDIES_DIR = os.path.join(BACKEND_DIR, 'gasifier_bmatrix_studies')
os.makedirs(GASIFIER_STUDIES_DIR, exist_ok=True)


def get_dataset_name(filename):
    """Extract dataset name from filename (without extension)"""
    return os.path.splitext(filename)[0]


def clean_df_for_json(df):
    """
    Ensure DataFrame is JSON serializable by replacing NaN and Inf with None (null).
    """
    # First replace Inf with NaN
    df = df.replace([np.inf, -np.inf], np.nan)
    # Convert to object type and replace NaN with None
    return df.astype(object).where(pd.notnull(df), None)


@app.route('/api/tag-list', methods=['GET'])
def get_tag_list():
    """Read and return the tag list from Excel"""
    try:
        excel_path = os.path.join(BACKEND_DIR, 'Tag_List_Data_Collection_Dates_R0.xlsx')
        if not os.path.exists(excel_path):
            return jsonify({'success': False, 'error': 'Tag list Excel file not found'}), 404
        
        # Read Sheet1
        df = pd.read_excel(excel_path, sheet_name=0) # Index 0 is Sheet1
        
        # Handle NaN/Inf for JSON compatibility
        df = clean_df_for_json(df)
        
        return jsonify({
            'success': True,
            'data': df.to_dict(orient='records'),
            'columns': list(df.columns)
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/datasets', methods=['GET'])
def list_datasets():
    """List all CSV files in the dataset directory"""
    try:
        datasets = []
        for file in os.listdir(DATASET_DIR):
            if file.endswith('.csv'):
                filepath = os.path.join(DATASET_DIR, file)
                file_stats = os.stat(filepath)
                datasets.append({
                    'name': file,
                    'size': file_stats.st_size,
                    'modified': datetime.fromtimestamp(file_stats.st_mtime).isoformat()
                })
        return jsonify({'success': True, 'datasets': datasets})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/dataset-metadata', methods=['GET'])
def get_dataset_metadata():
    """Get metadata for all datasets including bucket, central nodes, and base name"""
    try:
        from fourthapp_routes import _get_gcd_root
        
        metadata = {}
        
        # Scan failure and non-failure roots
        for bucket_name, root_fn in [('failure', lambda: _get_gcd_root('failure')), 
                                      ('non_failure', lambda: _get_gcd_root('non_failure'))]:
            root = root_fn()
            if not os.path.isdir(root):
                continue
            
            # Walk through window/central_n to find gasifier xlsx files
            for window in os.listdir(root):
                window_path = os.path.join(root, window)
                if not os.path.isdir(window_path):
                    continue
                
                for central_node in os.listdir(window_path):
                    if not central_node.startswith('central_'):
                        continue
                    
                    central_num = int(central_node.replace('central_', ''))
                    central_path = os.path.join(window_path, central_node)
                    if not os.path.isdir(central_path):
                        continue
                        
                    for f in os.listdir(central_path):
                        if f.endswith('.xlsx') and '_B_Matrix_' in f:
                            # Extract gasifier name from filename (e.g. G5R21_early_B_Matrix_7.xlsx)
                            parts = f.split('_')
                            gasifier_name = parts[0].lower() # Normalize to lower
                            
                            if gasifier_name not in metadata:
                                # Determine base name (e.g. g1 for g1r20)
                                base_name = gasifier_name
                                if 'r' in gasifier_name:
                                    base_name = gasifier_name.split('r')[0]
                                elif gasifier_name.startswith('g') and len(gasifier_name) > 1 and gasifier_name[1].isdigit():
                                    # Fallback for simple gN patterns
                                    import re
                                    match = re.match(r'(g\d+)', gasifier_name)
                                    if match:
                                        base_name = match.group(1)
                                
                                metadata[gasifier_name] = {
                                    'name': gasifier_name,
                                    'bucket': bucket_name,
                                    'base_name': base_name,
                                    'central_nodes': set()
                                }
                            
                            metadata[gasifier_name]['central_nodes'].add(central_num)

        # Convert sets to sorted lists for JSON
        result = []
        for g in metadata.values():
            g['central_nodes'] = sorted(list(g['central_nodes']))
            result.append(g)
            
        return jsonify({'success': True, 'metadata': result})
    except Exception as e:
        import traceback
        return jsonify({'success': False, 'error': str(e), 'traceback': traceback.format_exc()}), 500


@app.route('/api/output/<dataset_name>/<path:filename>', methods=['GET'])
def serve_output_file(dataset_name, filename):
    """Serve generated output files (images, CSVs, etc.)"""
    try:
        output_folder = os.path.join(OUTPUT_DIR, dataset_name)
        return send_from_directory(output_folder, filename)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 404


@app.route('/api/output/<dataset_name>/windows/<filename>', methods=['GET'])
def serve_window_file(dataset_name, filename):
    """Serve generated window CSV files"""
    try:
        windows_folder = os.path.join(OUTPUT_DIR, dataset_name, 'windows')
        return send_from_directory(windows_folder, filename)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 404


@app.route('/api/output/<dataset_name>', methods=['GET'])
def list_output_files(dataset_name):
    """List all files in the output folder for a dataset"""
    try:
        output_folder = os.path.join(OUTPUT_DIR, dataset_name)
        if not os.path.exists(output_folder):
            return jsonify({'success': True, 'files': []})
        
        files = []
        for file in os.listdir(output_folder):
            filepath = os.path.join(output_folder, file)
            file_stats = os.stat(filepath)
            files.append({
                'name': file,
                'size': file_stats.st_size,
                'modified': datetime.fromtimestamp(file_stats.st_mtime).isoformat(),
                'url': f'/api/output/{dataset_name}/{file}'
            })
        
        return jsonify({'success': True, 'files': files})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/gasifier-datasets', methods=['GET'])
def get_gasifier_datasets():
    """List datasets grouped by gasifier (folder) for the folder browser"""
    try:
        folders_data = []
        if not os.path.exists(OUTPUT_DIR):
            return jsonify({'success': True, 'folders': []})

        for folder_name in sorted(os.listdir(OUTPUT_DIR)):
            folder_path = os.path.join(OUTPUT_DIR, folder_name)
            if not os.path.isdir(folder_path):
                continue
                
            files = []
            for f in sorted(os.listdir(folder_path)):
                if f.endswith('.csv') or f.endswith('.xlsx'):
                    f_path = os.path.join(folder_path, f)
                    stats = os.stat(f_path)
                    files.append({
                        'id': f"{folder_name}/{f}",
                        'name': f,
                        'label': f,
                        'size': f"{stats.st_size // 1024} KB",
                        'path': f"/api/output/{folder_name}/{f}"
                    })
            
            if files:
                folders_data.append({
                    'id': folder_name,
                    'name': folder_name,
                    'files': files
                })
        
        return jsonify({'success': True, 'folders': folders_data})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/dataset/<dataset_name>/causal-results', methods=['GET'])
def list_causal_results(dataset_name):
    """List all available causal result folders for a dataset"""
    try:
        output_folder = os.path.join(OUTPUT_DIR, dataset_name)
        if not os.path.exists(output_folder):
            return jsonify({'success': True, 'folders': []})

        folders = []
        for item in os.listdir(output_folder):
            item_path = os.path.join(output_folder, item)
            if os.path.isdir(item_path) and (item.startswith('early_') or item.startswith('mid_') or item.startswith('late_') or item == 'overall'):
                # Basic check for B-matrix files
                b_matrices = [f for f in os.listdir(item_path) if f.startswith('B_Matrix_')]
                if b_matrices:
                    folders.append({
                        'folder_name': item,
                        'iterations': len(b_matrices)
                    })
        return jsonify({'success': True, 'folders': folders})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/dataset/<dataset_name>/causal-iterations', methods=['GET'])
def get_causal_iterations(dataset_name):
    """Get iterations for a specific causal result folder"""
    try:
        folder = request.args.get('folder')
        if not folder:
            return jsonify({'success': False, 'error': 'No folder specified'}), 400

        folder_path = os.path.join(OUTPUT_DIR, dataset_name, folder)
        if not os.path.exists(folder_path):
            return jsonify({'success': False, 'error': 'Folder not found'}), 404

        iterations = []
        for f in sorted(os.listdir(folder_path)):
            if f.startswith('B_Matrix_') and f.endswith('.xlsx'):
                try:
                    num = int(f.split('_')[-1].split('.')[0])
                    iterations.append(num)
                except:
                    pass

        return jsonify({
            'success': True,
            'iterations': sorted(iterations)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/dataset/<dataset_name>/b-matrix/<iteration>', methods=['GET'])
def get_dataset_b_matrix(dataset_name, iteration):
    """Get B-Matrix data for a specific dataset iteration"""
    try:
        folder = request.args.get('folder')
        if not folder:
            return jsonify({'success': False, 'error': 'No folder specified'}), 400

        file_path = os.path.join(OUTPUT_DIR, dataset_name, folder, f'B_Matrix_{iteration}.xlsx')
        if not os.path.exists(file_path):
            return jsonify({'success': False, 'error': 'File not found'}), 404

        df = pd.read_excel(file_path)
        df_clean = clean_df_for_json(df)
        return jsonify({
            'success': True,
            'columns': list(df.columns),
            'data': df_clean.to_dict(orient='records')
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


def get_hpt_metadata():
    """Scan B_Matrices and extract metadata for HPT files."""
    if not os.path.exists(B_MATRICES_DIR):
        return []
    
    metadata = []
    for f in os.listdir(B_MATRICES_DIR):
        if not f.startswith('hpt__'): continue
        if not (f.endswith('.xlsx') or f.endswith('.csv')): continue
        
        # hpt__g6r19_buc-late_BM_7__lam0.1-lmin1-lmax15.xlsx
        parts = f.split('__')
        if len(parts) < 3: continue
        
        info_part = parts[1] # g6r19_buc-late_BM_7
        params_part = parts[2] # lam0.1-lmin1-lmax15.xlsx
        
        info_bits = info_part.split('_')
        # info_bits: ['g6r19', 'buc-late', 'BM', '7']
        if len(info_bits) < 4: continue
        
        gasifier = info_bits[0]
        bucket = info_bits[1] # buc-late
        lam = params_part.split('-')[0] # lam0.1
        
        metadata.append({
            'filename': f,
            'gasifier': gasifier,
            'bucket': bucket,
            'lamda': lam
        })
    return metadata


@app.route('/api/hyperparameter/options', methods=['GET'])
def get_hyperparameter_options():
    """List available options for hyperparameter tuning study from B_Matrices."""
    try:
        metadata = get_hpt_metadata()
        
        gasifiers = sorted(list(set(m['gasifier'] for m in metadata)))
        buckets = sorted(list(set(m['bucket'] for m in metadata)))
        lamdas = sorted(list(set(m['lamda'] for m in metadata)))
                
        return jsonify({
            'success': True,
            'gasifiers': gasifiers,
            'buckets': buckets,
            'lamdas': lamdas
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/hyperparameter/b-matrix', methods=['GET'])
def get_hyperparameter_b_matrix():
    """Fetch B-Matrix for specific hyperparameter combination from B_Matrices."""
    try:
        g = request.args.get('gasifier')
        b = request.args.get('bucket')
        l = request.args.get('lamda')
        
        metadata = get_hpt_metadata()
        match = next((m for m in metadata if m['gasifier'] == g and m['bucket'] == b and m['lamda'] == l), None)
        
        if not match:
            return jsonify({'success': False, 'error': 'Experimental file not found'}), 404
            
        path = os.path.join(B_MATRICES_DIR, match['filename'])
        
        if match['filename'].endswith('.xlsx'):
            df = pd.read_excel(path, engine='openpyxl')
        else:
            df = pd.read_csv(path)
            
        df_clean = clean_df_for_json(df)
        
        # Determine gasifier prefix to clean columns
        gasifier_name = g.lower()
        prefix = gasifier_name + '_'
        
        cleaned_columns = []
        for col in df_clean.columns:
            col_str = str(col)
            if col_str.lower().startswith(prefix):
                cleaned_columns.append(col_str[len(prefix):])
            else:
                cleaned_columns.append(col_str)
                
        return jsonify({
            'success': True,
            'columns': cleaned_columns,
            'data': df_clean.to_dict(orient='records')
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


### scientific_study_notes
@app.route('/api/dataset/<dataset_name>/notes', methods=['GET', 'POST'])
def handle_gasifier_notes(dataset_name):
    """Load or save notes and summary for a specific gasifier"""
    try:
        # Notes are stored in the output folder for the dataset
        dataset_name_clean = get_dataset_name(dataset_name)
        output_folder = os.path.join(OUTPUT_DIR, dataset_name_clean)
        if not os.path.exists(output_folder):
            os.makedirs(output_folder, exist_ok=True)
            
        json_path = os.path.join(output_folder, 'scientific_study_notes.json')
        
        # Data structure for notes
        data = {
            'notes': '',      # Fallback/General notes
            'summary': '',    # Global summary across gasifiers
            'categorized': {} # studyId -> phase -> note
        }
        
        # Load existing JSON data if available
        if os.path.exists(json_path):
            try:
                with open(json_path, 'r') as f:
                    loaded_data = json.load(f)
                    data.update(loaded_data)
            except:
                pass
        else:
            # Migration: Load from old txt files if they exist
            notes_path = os.path.join(output_folder, 'scientific_study_notes.txt')
            summary_path = os.path.join(output_folder, 'scientific_study_summary.txt')
            
            if os.path.exists(notes_path):
                with open(notes_path, 'r') as f:
                    data['notes'] = f.read()
            
            if os.path.exists(summary_path):
                with open(summary_path, 'r') as f:
                    data['summary'] = f.read()

        if request.method == 'POST':
            req_data = request.json
            notes = req_data.get('notes')
            summary = req_data.get('summary')
            study_id = req_data.get('studyId')
            phase = req_data.get('phase', '')

            if summary is not None:
                data['summary'] = summary
            
            if notes is not None:
                if study_id:
                    s_id = str(study_id)
                    if 'categorized' not in data:
                        data['categorized'] = {}
                    if s_id not in data['categorized']:
                        data['categorized'][s_id] = {}
                    data['categorized'][s_id][phase] = notes
                else:
                    data['notes'] = notes
            
            # Save to JSON
            with open(json_path, 'w') as f:
                json.dump(data, f, indent=2)
            
            return jsonify({'success': True})

        else: # GET
            study_id = request.args.get('studyId')
            phase = request.args.get('phase', '')
            
            if study_id:
                s_id = str(study_id)
                phase_notes = data.get('categorized', {}).get(s_id, {}).get(phase, '')
                return jsonify({
                    'success': True,
                    'notes': phase_notes,
                    'summary': data.get('summary', '')
                })
            else:
                return jsonify({
                    'success': True,
                    'notes': data.get('notes', ''),
                    'summary': data.get('summary', '')
                })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# Gasifier Causal Graph Studies - New B_Matrices Structure
B_MATRICES_DIR = os.path.join(BACKEND_DIR, 'B_Matrices')
os.makedirs(B_MATRICES_DIR, exist_ok=True)

def get_b_matrix_metadata():
    """Scan B_Matrices and extract metadata from filenames."""
    if not os.path.exists(B_MATRICES_DIR):
        return []
    
    metadata = []
    for f in os.listdir(B_MATRICES_DIR):
        if not (f.endswith('.xlsx') or f.endswith('.csv')): continue
        if not f.startswith('ov'): continue
        if '__' not in f: continue
        parts = f.split('__')
        if len(parts) < 2: continue
        
        ov = parts[0]
        # gasifier_part might be 'g3r25_buc1_BM_9'
        gasifier_part = parts[1]
        gasifier = gasifier_part.split('_')[0]
        
        stride = ov
        if ov == 'ov0k' or ov == 'no_overlap': 
            stride = 'no_overlap'
        elif ov.startswith('ov') and ov.endswith('k'):
            stride = ov[2:] # Extract '3k', '6k', '9k' etc. from 'ov3k', 'ov6k'
        
        metadata.append({
            'filename': f,
            'stride': stride,
            'gasifier': gasifier,
            'original_overlap': ov
        })
    return metadata


@app.route('/api/gasifier-bmatrix-studies/strides', methods=['GET'])
def list_gasifier_strides():
    """Return which stride options actually exist in B_Matrices filenames."""
    try:
        metadata = get_b_matrix_metadata()
        strides = sorted(list(set(m['stride'] for m in metadata)))
        return jsonify({'success': True, 'strides': strides})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/gasifier-bmatrix-studies/folders', methods=['GET'])
def list_gasifier_folders():
    """List all gasifiers for a given stride from B_Matrices filenames."""
    try:
        stride = request.args.get('stride', '')
        metadata = get_b_matrix_metadata()
        gasifiers = sorted(list(set(m['gasifier'] for m in metadata if m['stride'] == stride)))
        return jsonify({'success': True, 'folders': gasifiers})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/gasifier-bmatrix-studies/files', methods=['GET'])
def list_gasifier_files():
    """List all bucket files for a specific gasifier and stride."""
    try:
        stride = request.args.get('stride', '')
        gasifier = request.args.get('folder', '') # 'folder' param in frontend maps to gasifier
        metadata = get_b_matrix_metadata()
        files = [m['filename'] for m in metadata if m['stride'] == stride and m['gasifier'] == gasifier]
        return jsonify({'success': True, 'files': sorted(files)})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/gasifier-bmatrix-studies/b-matrix', methods=['GET'])
def get_gasifier_b_matrix():
    """Serve B-matrix data from a specific file in B_Matrices."""
    try:
        filename = request.args.get('file')
        if not filename:
            return jsonify({'success': False, 'error': 'Missing file parameter'}), 400

        filepath = os.path.join(B_MATRICES_DIR, filename)
        if not os.path.exists(filepath):
            return jsonify({'success': False, 'error': 'File not found'}), 404

        try:
            if filename.endswith('.xlsx'):
                df = pd.read_excel(filepath, engine='openpyxl')
            else:
                df = pd.read_csv(filepath)
                
            df_clean = clean_df_for_json(df)

            # Try to determine gasifier prefix to clean columns
            # ov0k__g3r25_buc1_BM_9__...
            gasifier_name = ''
            parts = filename.split('__')
            if len(parts) >= 2:
                gasifier_name = parts[1].lower()
            
            cleaned_columns = []
            if gasifier_name:
                # We might have cases like G3R25 or g3r25
                # Try both lowercase and original
                prefix = gasifier_name + '_'
                orig_prefix = parts[1] + '_'
                for col in df_clean.columns:
                    col_str = str(col)
                    if col_str.lower().startswith(prefix):
                        cleaned_columns.append(col_str[len(prefix):])
                    elif col_str.startswith(orig_prefix):
                        cleaned_columns.append(col_str[len(orig_prefix):])
                    else:
                        cleaned_columns.append(col_str)
            else:
                cleaned_columns = list(df_clean.columns)

            return jsonify({
                'success': True,
                'columns': cleaned_columns,
                'data': df_clean.to_dict(orient='records')
            })
        except Exception as e:
            import traceback
            print(traceback.format_exc())
            return jsonify({'success': False, 'error': f"Failed to read B-Matrix: {str(e)}"}), 500

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ─────────────────────────────────────────────────────────────────────────────
# Phase-Based B-Matrix Studies (Studies 1-4)
# Reads from B_Matrices/{gasifier}_buc-{phase}_BM_{num}__{params}.xlsx
# ─────────────────────────────────────────────────────────────────────────────

def get_phase_bmatrix_metadata():
    """Scan B_Matrices for phase-based files: {gasifier}_buc-{phase}_BM_{num}__{params}.xlsx"""
    import re
    result = []
    if not os.path.exists(B_MATRICES_DIR):
        return result

    for f in os.listdir(B_MATRICES_DIR):
        if not f.endswith('.xlsx'):
            continue
        # Must match pattern: starts with gasifier name (no prefix like ov/hpt)
        # e.g. g1r20_buc-early_BM_9__lam0.01-lmin5-lmax15.xlsx
        # Exclude files that have prefixes (ov*, hpt*)
        if re.match(r'^(ov|hpt)', f, re.IGNORECASE):
            continue

        # Pattern: {gasifier}_buc-{phase}_BM_{num}__{params}.xlsx
        pattern = r'^([a-zA-Z0-9]+)_buc-(early|mid|late)_BM_(\d+)__(.+)\.xlsx$'
        m = re.match(pattern, f, re.IGNORECASE)
        if not m:
            continue

        gasifier = m.group(1).lower()
        phase = m.group(2).lower()
        bm_num = int(m.group(3))
        params = m.group(4)

        result.append({
            'filename': f,
            'gasifier': gasifier,
            'phase': phase,
            'bm_num': bm_num,
            'params': params
        })

    return result


@app.route('/api/phase-studies/gasifiers', methods=['GET'])
def get_phase_study_gasifiers():
    """Return all unique gasifiers available in B_Matrices for phase studies."""
    try:
        meta = get_phase_bmatrix_metadata()
        gasifiers = sorted(list(set(m['gasifier'] for m in meta)))
        return jsonify({'success': True, 'gasifiers': gasifiers})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/phase-studies/phases', methods=['GET'])
def get_phase_study_phases():
    """Return available phases (early/mid/late) for a given gasifier in B_Matrices."""
    try:
        gasifier = request.args.get('gasifier', '').lower()
        meta = get_phase_bmatrix_metadata()
        phases = sorted(list(set(m['phase'] for m in meta if m['gasifier'] == gasifier)))
        return jsonify({'success': True, 'phases': phases})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/phase-studies/b-matrix', methods=['GET'])
def get_phase_study_b_matrix():
    """Serve B-matrix for a specific gasifier+phase from B_Matrices."""
    try:
        gasifier = request.args.get('gasifier', '').lower()
        phase = request.args.get('phase', '').lower()

        if not gasifier or not phase:
            return jsonify({'success': False, 'error': 'Missing gasifier or phase parameter'}), 400

        meta = get_phase_bmatrix_metadata()
        # Pick the matching entry (there should be one per gasifier+phase)
        match = next((m for m in meta if m['gasifier'] == gasifier and m['phase'] == phase), None)

        if not match:
            return jsonify({'success': False, 'error': f'No B-matrix found for gasifier={gasifier}, phase={phase}'}), 404

        filepath = os.path.join(B_MATRICES_DIR, match['filename'])
        df = pd.read_excel(filepath, engine='openpyxl')
        df_clean = clean_df_for_json(df)

        # Strip gasifier prefix from column names (e.g. g1r20_col -> col)
        prefix = gasifier + '_'
        cleaned_columns = []
        for col in df_clean.columns:
            col_str = str(col)
            if col_str.lower().startswith(prefix):
                cleaned_columns.append(col_str[len(prefix):])
            else:
                cleaned_columns.append(col_str)

        return jsonify({
            'success': True,
            'columns': cleaned_columns,
            'data': df_clean.to_dict(orient='records'),
            'filename': match['filename'],
            'gasifier': gasifier,
            'phase': phase,
            'bm_num': match['bm_num']
        })
    except Exception as e:
        import traceback
        return jsonify({'success': False, 'error': str(e), 'traceback': traceback.format_exc()}), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
