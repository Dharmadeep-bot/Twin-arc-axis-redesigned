"""
FourthApp Routes — LCD & GCD Cluster Analysis API
Serves centrality-wise LCD / GCD cluster files from the Centrality_Files directory.

New Directory:
  Centrality_Files/

New Naming Convention:
  {type}_{phase}_{bucket}[_{centrality}]__{agg_type}__lam{val}-...xlsx

  - type: 'gcd' or 'lcd'
  - phase: 'early', 'mid' or 'late'
  - bucket: 'fail' or 'non-fail'
  - centrality: 'c1', 'c2', etc (only for LCD)
  - version: lam0.1 -> V1, lam0.01 -> V2
"""

import os
import pandas as pd
import numpy as np
from flask import Blueprint, jsonify, request

fourthapp_bp = Blueprint('fourthapp', __name__)

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))

CENTRALITY_FILES_DIR = os.path.join(BACKEND_DIR, 'Centrality_Files')
if not os.path.exists(CENTRALITY_FILES_DIR):
    os.makedirs(CENTRALITY_FILES_DIR, exist_ok=True)

def get_centrality_metadata():
    """Scan Centrality_Files and return a list of metadata dicts."""
    if not os.path.exists(CENTRALITY_FILES_DIR):
        return []
    
    metadata = []
    for f in os.listdir(CENTRALITY_FILES_DIR):
        if not (f.endswith('.xlsx') or f.endswith('.csv')): continue
        if '__' not in f: continue
        
        # pattern: {prefix}___{method}___{params}.xlsx
        # Example: lcd_early_fail_c1__cons-min2__lam0.1-lmin1-lmax15.xlsx
        parts = f.split('__')
        if len(parts) < 3: continue
        
        info_part = parts[0]
        method_part = parts[1] # This is the experiment or method name between double underscores
        params_part = parts[2]
        
        info_bits = info_part.split('_')
        # Robust extraction for dtype, phase, ds_type, centrality
        dtype = info_bits[0].lower() # lcd or gcd
        phase = info_bits[1].lower() # early, mid, late
        
        # ds_type: Check if 'fail' is present but 'non' is not
        info_part_lower = info_part.lower()
        if 'fail' in info_part_lower:
            if 'non' in info_part_lower:
                ds_type = 'non_failure'
            else:
                ds_type = 'failure'
        else:
            ds_type = 'non_failure' # Default fallback
            
        # centrality: look for bit starting with 'c' followed by digits
        centrality = 'overall'
        for bit in info_bits[2:]:
            if bit.startswith('c') and bit[1:].isdigit():
                centrality = f"central_{bit[1:]}"
                break
            
        version = 'v1' # default to v1 for lam0.1
        if '-v3' in params_part:
            version = 'v3'
        elif 'lam0.01' in params_part:
            version = 'v2'
        elif 'lam0.1' in params_part:
            version = 'v1'
            
        # Append -T if transposed, so the agg_type distinguishes between base and transposed 
        if version == 'v3' and 'Transposed' in f and not method_part.endswith('-T'):
            agg_type = f"{method_part}-T"
        else:
            agg_type = method_part
            
        metadata.append({
            'filename': f,
            'type': dtype,
            'phase': phase,
            'ds_type': ds_type,
            'centrality': centrality,
            'agg_type': agg_type, # Captured experiment/method name
            'version': version
        })
    return metadata

def _get_agg_filename_map(version):
    """Map frontend aggregation names to the new agg_type strings."""
    if version == 'v3':
        return {
            'Consensus_Min2.xlsx': 'cons-min2',
            'Consensus_Min2_Transposed.xlsx': 'cons-min2-T',
            'Consensus_50.xlsx': 'cons50',
            'Consensus_50_Transposed.xlsx': 'cons50-T',
            'Simple_Average.xlsx': 'savg',
            'Simple_Average_Transposed.xlsx': 'savg-T',
            'Weighted_Average.xlsx': 'wavg',
            'Weighted_Average_Transposed.xlsx': 'wavg-T',
        }
    elif version == 'v2':
        return {
            'Consensus_50Percent_Median.xlsx': 'cons50-med',
            'Consensus_50Percent_Median_Transposed.xlsx': 'cons50-med-T',
            'Consensus_Min2_Median.xlsx': 'consMin2-med',
            'Consensus_Min2_Median_Transposed.xlsx': 'consMin2-med-T'
        }
    else: # v1
        return {
            'Consensus_GTE2.xlsx': 'cons-min2',
            'Simple_Average.xlsx': 'savg',
            'Union_Median.xlsx': 'union-med',
            'Weighted_Average.xlsx': 'wavg',
            'Weighted_Average_Transposed.xlsx': 'wavg-T'
        }

def _clean_df_for_json(df: pd.DataFrame) -> pd.DataFrame:
    """Replace Inf/NaN with None so the result is JSON-serialisable."""
    df = df.replace([np.inf, -np.inf], np.nan)
    return df.astype(object).where(pd.notnull(df), None)

def _read_xlsx_as_bmatrix(path: str):
    """Read an XLSX file and return { columns, data } or { error }."""
    try:
        df = pd.read_excel(path, engine='openpyxl')
        df = _clean_df_for_json(df)
        return {
            'columns': list(df.columns),
            'data': df.to_dict(orient='records'),
        }
    except Exception as exc:
        return {'error': str(exc)}


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/fourthapp/files
# Returns the list of available windows and, for each window, the available
# central nodes.
#
# Query params:
#   dataset_type   'failure' (default) | 'non_failure'
#   version        'v1' | 'v2' (default)
# ─────────────────────────────────────────────────────────────────────────────
@fourthapp_bp.route('/api/fourthapp/files', methods=['GET'])
def get_fourthapp_files():
    """List available windows and centralities for LCD."""
    ds_type = request.args.get('dataset_type', 'failure')
    version = request.args.get('version', 'v2')
    
    try:
        meta = get_centrality_metadata()
        filtered = [m for m in meta if m['type'] == 'lcd' and m['ds_type'] == ds_type and m['version'] == version]
        
        windows = sorted(list(set(m['phase'] for m in filtered)))
        central_nodes_map = {}
        for w in windows:
            cents = sorted(list(set(m['centrality'] for m in filtered if m['phase'] == w)))
            central_nodes_map[w] = cents
            
        return jsonify({
            'success': True,
            'windows': windows,
            'central_nodes_map': central_nodes_map,
        })
    except Exception as exc:
        import traceback
        return jsonify({'success': False, 'error': str(exc), 'traceback': traceback.format_exc()}), 500


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/fourthapp/lcd-data
# Returns the B-Matrix data for every XLSX file inside the chosen cluster dir.
#
# Query params:
#   window         e.g. 'early'
#   central_node   e.g. 'central_1'
#   dataset_type   'failure' (default) | 'non_failure'
#   version        'v1' | 'v2' (default)
# ─────────────────────────────────────────────────────────────────────────────
@fourthapp_bp.route('/api/fourthapp/lcd-data', methods=['GET'])
def get_fourthapp_lcd_data():
    window = request.args.get('window', '').strip()
    central_node = request.args.get('central_node', '').strip()
    ds_type = request.args.get('dataset_type', 'failure')
    version = request.args.get('version', 'v2')

    if not window or not central_node:
        return jsonify({'success': False, 'error': 'Missing window or central_node'}), 400

    try:
        meta = get_centrality_metadata()
        filtered = [m for m in meta if m['type'] == 'lcd' and m['phase'] == window and 
                    m['ds_type'] == ds_type and m['version'] == version and m['centrality'] == central_node]
        
        agg_map = _get_agg_filename_map(version)
        files_data = {}
        
        for ui_name, agg_code in agg_map.items():
            match = next((m for m in filtered if m['agg_type'] == agg_code), None)
            if match:
                path = os.path.join(CENTRALITY_FILES_DIR, match['filename'])
                files_data[ui_name] = _read_xlsx_as_bmatrix(path)
            else:
                files_data[ui_name] = {'error': f'Metric {agg_code} not found for this selection.'}
                
        return jsonify({
            'success': True,
            'window': window,
            'central_node': central_node,
            'dataset_type': ds_type,
            'version': version,
            'files': files_data,
        })
    except Exception as exc:
        return jsonify({'success': False, 'error': str(exc)}), 500


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/fourthapp/all-centralities
# Returns the union of all centralities that appear across all windows.
#
# Query params:
#   dataset_type   'failure' (default) | 'non_failure'
#   version        'v1' | 'v2' (default)
# ─────────────────────────────────────────────────────────────────────────────
@fourthapp_bp.route('/api/fourthapp/all-centralities', methods=['GET'])
def get_all_centralities():
    ds_type = request.args.get('dataset_type', 'failure')
    version = request.args.get('version', 'v2')
    
    try:
        meta = get_centrality_metadata()
        seen = set(m['centrality'] for m in meta if m['type'] == 'lcd' and m['ds_type'] == ds_type and m['version'] == version)
        return jsonify({'success': True, 'centralities': sorted(list(seen))})
    except Exception as exc:
        return jsonify({'success': False, 'error': str(exc)}), 500


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/fourthapp/centrality-view
# Returns LCD data for ALL windows for a single chosen central node.
# Each window entry has { files: {...}, available: bool }
#
# Query params:
#   central_node   e.g. 'central_1'
#   dataset_type   'failure' (default) | 'non_failure'
#   windows        comma-separated list of windows to fetch, default 'early,mid,late'
#   version        'v1' | 'v2' (default)
# ─────────────────────────────────────────────────────────────────────────────
@fourthapp_bp.route('/api/fourthapp/centrality-view', methods=['GET'])
def get_centrality_view():
    central_node = request.args.get('central_node', '').strip()
    ds_type = request.args.get('dataset_type', 'failure')
    windows_param = request.args.get('windows', 'early,mid,late')
    version = request.args.get('version', 'v2')

    if not central_node:
        return jsonify({'success': False, 'error': 'Missing central_node'}), 400

    try:
        meta = get_centrality_metadata()
        windows_list = [w.strip() for w in windows_param.split(',') if w.strip()]
        agg_map = _get_agg_filename_map(version)
        
        result = {}
        for win in windows_list:
            filtered = [m for m in meta if m['phase'] == win and m['centrality'] == central_node and 
                        m['ds_type'] == ds_type and m['version'] == version and m['type'] == 'lcd']
            
            if not filtered:
                result[win] = {'available': False, 'files': {}}
                continue
            
            files_data = {}
            for ui_name, agg_code in agg_map.items():
                match = next((m for m in filtered if m['agg_type'] == agg_code), None)
                if match:
                    path = os.path.join(CENTRALITY_FILES_DIR, match['filename'])
                    files_data[ui_name] = _read_xlsx_as_bmatrix(path)
                else:
                    files_data[ui_name] = {'error': 'Not found'}
            
            result[win] = {'available': True, 'files': files_data}
            
        return jsonify({
            'success': True,
            'central_node': central_node,
            'dataset_type': ds_type,
            'version': version,
            'windows': result,
        })
    except Exception as exc:
        return jsonify({'success': False, 'error': str(exc)}), 500


# =============================================================================
# GCD ROUTES  (mirror of LCD routes, uses centrality_wise_gcd_files)
# =============================================================================

# ─────────────────────────────────────────────────────────────────────────────
# GET /api/fourthapp/gcd-files
# Query params:
#   dataset_type   'failure' (default) | 'non_failure'
#   version        'v1' | 'v2' (default)
# ─────────────────────────────────────────────────────────────────────────────
@fourthapp_bp.route('/api/fourthapp/gcd-files', methods=['GET'])
def get_fourthapp_gcd_files():
    ds_type = request.args.get('dataset_type', 'failure')
    version = request.args.get('version', 'v2')
    
    try:
        meta = get_centrality_metadata()
        filtered = [m for m in meta if m['type'] == 'gcd' and m['ds_type'] == ds_type and m['version'] == version]
        
        windows = sorted(list(set(m['phase'] for m in filtered)))
        central_nodes_map = {}
        for w in windows:
            cents = sorted(list(set(m['centrality'] for m in filtered if m['phase'] == w)))
            central_nodes_map[w] = cents
            
        return jsonify({'success': True, 'windows': windows, 'central_nodes_map': central_nodes_map})
    except Exception as exc:
        return jsonify({'success': False, 'error': str(exc)}), 500


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/fourthapp/gcd-data
# Query params:
#   window         e.g. 'early'
#   central_node   e.g. 'central_1'
#   dataset_type   'failure' (default) | 'non_failure'
#   version        'v1' | 'v2' (default)
# ─────────────────────────────────────────────────────────────────────────────
@fourthapp_bp.route('/api/fourthapp/gcd-data', methods=['GET'])
def get_fourthapp_gcd_data():
    window = request.args.get('window', '').strip()
    central_node = request.args.get('central_node', 'overall').strip()
    ds_type = request.args.get('dataset_type', 'failure')
    version = request.args.get('version', 'v2')

    if not window:
        return jsonify({'success': False, 'error': 'Missing window'}), 400

    try:
        meta = get_centrality_metadata()
        filtered = [m for m in meta if m['type'] == 'gcd' and m['phase'] == window and 
                    m['ds_type'] == ds_type and m['version'] == version and m['centrality'] == central_node]
        
        agg_map = _get_agg_filename_map(version)
        files_data = {}
        
        for ui_name, agg_code in agg_map.items():
            match = next((m for m in filtered if m['agg_type'] == agg_code), None)
            if match:
                path = os.path.join(CENTRALITY_FILES_DIR, match['filename'])
                files_data[ui_name] = _read_xlsx_as_bmatrix(path)
            else:
                files_data[ui_name] = {'error': f'Metric {agg_code} not found.'}

        return jsonify({
            'success': True,
            'window': window,
            'dataset_type': ds_type,
            'version': version,
            'files': files_data,
        })
    except Exception as exc:
        return jsonify({'success': False, 'error': str(exc)}), 500


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/fourthapp/gcd-all-centralities
# Query params:
#   dataset_type   'failure' (default) | 'non_failure'
#   version        'v1' | 'v2' (default)
# ─────────────────────────────────────────────────────────────────────────────
@fourthapp_bp.route('/api/fourthapp/gcd-all-centralities', methods=['GET'])
def get_gcd_all_centralities():
    ds_type = request.args.get('dataset_type', 'failure')
    version = request.args.get('version', 'v2')
    try:
        meta = get_centrality_metadata()
        seen = set(m['centrality'] for m in meta if m['type'] == 'gcd' and m['ds_type'] == ds_type and m['version'] == version)
        return jsonify({'success': True, 'centralities': sorted(list(seen))})
    except Exception as exc:
        return jsonify({'success': False, 'error': str(exc)}), 500


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/fourthapp/gcd-centrality-view
# Query params:
#   central_node   e.g. 'central_1'
#   dataset_type   'failure' (default) | 'non_failure'
#   windows        comma-separated, default 'early,mid,late'
#   version        'v1' | 'v2' (default)
# ─────────────────────────────────────────────────────────────────────────────
@fourthapp_bp.route('/api/fourthapp/gcd-centrality-view', methods=['GET'])
def get_gcd_centrality_view():
    central_node = request.args.get('central_node', 'overall').strip()
    ds_type = request.args.get('dataset_type', 'failure')
    windows_param = request.args.get('windows', 'early,mid,late')
    version = request.args.get('version', 'v2')

    try:
        meta = get_centrality_metadata()
        windows_list = [w.strip() for w in windows_param.split(',') if w.strip()]
        agg_map = _get_agg_filename_map(version)
        
        result = {}
        for win in windows_list:
            filtered = [m for m in meta if m['phase'] == win and m['ds_type'] == ds_type and 
                        m['version'] == version and m['type'] == 'gcd' and m['centrality'] == central_node]
            
            if not filtered:
                result[win] = {'available': False, 'files': {}}
                continue
            
            files_data = {}
            for ui_name, agg_code in agg_map.items():
                match = next((m for m in filtered if m['agg_type'] == agg_code), None)
                if match:
                    path = os.path.join(CENTRALITY_FILES_DIR, match['filename'])
                    files_data[ui_name] = _read_xlsx_as_bmatrix(path)
                else:
                    files_data[ui_name] = {'error': 'Not found'}
            
            result[win] = {'available': True, 'files': files_data}
            
        return jsonify({
            'success': True,
            'dataset_type': ds_type,
            'version': version,
            'windows': result,
        })
    except Exception as exc:
        return jsonify({'success': False, 'error': str(exc)}), 500
