"""
Wind B-Matrix Study Routes
Serves causal graph animation data from Wind B_Matrices folder.
"""

from flask import Blueprint, jsonify, request
import os
import re
import pandas as pd
import numpy as np

wind_bp = Blueprint('wind', __name__)

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
WIND_DIR = os.path.join(BACKEND_DIR, 'Wind B_Matrices')

# Pattern: wt80_seg0_win000_B_Matrix_14.xlsx
_FILENAME_RE = re.compile(
    r'^(?P<turbine_id>[^_]+)_(?P<segment>seg\d+)_(?P<window>win\d+)_B_Matrix_\d+\.xlsx$',
    re.IGNORECASE
)


def _clean(df):
    df = df.replace([np.inf, -np.inf], np.nan)
    return df.astype(object).where(pd.notnull(df), None)


def _turbine_label(folder_name):
    """Wt_80_extracted_matrices → WT 80"""
    label = folder_name.replace('_extracted_matrices', '').replace('_', ' ')
    return label.upper()


def _read_b_matrix(filepath):
    df = pd.read_excel(filepath, engine='openpyxl')
    df_clean = _clean(df)
    return {
        'columns': list(df_clean.columns),
        'data': df_clean.to_dict(orient='records')
    }


@wind_bp.route('/api/wind/turbines', methods=['GET'])
def get_wind_turbines():
    """List turbine type folders inside Wind B_Matrices."""
    try:
        if not os.path.exists(WIND_DIR):
            return jsonify({'success': True, 'turbines': []})

        turbines = []
        for item in sorted(os.listdir(WIND_DIR)):
            if os.path.isdir(os.path.join(WIND_DIR, item)):
                turbines.append({
                    'folder': item,
                    'label': _turbine_label(item)
                })

        return jsonify({'success': True, 'turbines': turbines})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@wind_bp.route('/api/wind/segments', methods=['GET'])
def get_wind_segments():
    """List unique segments for a given turbine folder."""
    try:
        turbine = request.args.get('turbine', '')
        folder_path = os.path.join(WIND_DIR, turbine)

        if not os.path.exists(folder_path):
            return jsonify({'success': False, 'error': 'Turbine folder not found'}), 404

        segments = set()
        for f in os.listdir(folder_path):
            m = _FILENAME_RE.match(f)
            if m:
                segments.add(m.group('segment').lower())

        return jsonify({'success': True, 'segments': sorted(segments)})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@wind_bp.route('/api/wind/windows', methods=['GET'])
def get_wind_windows():
    """List window filenames for a turbine + segment."""
    try:
        turbine = request.args.get('turbine', '')
        segment = request.args.get('segment', '').lower()
        folder_path = os.path.join(WIND_DIR, turbine)

        if not os.path.exists(folder_path):
            return jsonify({'success': False, 'error': 'Turbine folder not found'}), 404

        windows = []
        for f in sorted(os.listdir(folder_path)):
            m = _FILENAME_RE.match(f)
            if m and m.group('segment').lower() == segment:
                windows.append({'filename': f, 'window': m.group('window')})

        return jsonify({'success': True, 'windows': windows})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@wind_bp.route('/api/wind/b-matrix', methods=['GET'])
def get_wind_b_matrix():
    """Get B-matrix for a specific filename."""
    try:
        turbine = request.args.get('turbine', '')
        filename = request.args.get('filename', '')

        if not turbine or not filename:
            return jsonify({'success': False, 'error': 'Missing turbine or filename'}), 400

        filepath = os.path.join(WIND_DIR, turbine, filename)
        if not os.path.exists(filepath):
            return jsonify({'success': False, 'error': 'File not found'}), 404

        result = _read_b_matrix(filepath)
        return jsonify({'success': True, 'filename': filename, **result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@wind_bp.route('/api/wind/all-windows-data', methods=['GET'])
def get_all_windows_data():
    """
    Pre-load all B-matrix frames for a turbine + segment.
    Returns ordered list of {filename, window, columns, data}.
    """
    try:
        turbine = request.args.get('turbine', '')
        segment = request.args.get('segment', '').lower()
        folder_path = os.path.join(WIND_DIR, turbine)

        if not os.path.exists(folder_path):
            return jsonify({'success': False, 'error': 'Turbine folder not found'}), 404

        frames = []
        for f in sorted(os.listdir(folder_path)):
            m = _FILENAME_RE.match(f)
            if m and m.group('segment').lower() == segment:
                filepath = os.path.join(folder_path, f)
                mat = _read_b_matrix(filepath)
                frames.append({
                    'filename': f,
                    'window': m.group('window'),
                    **mat
                })

        return jsonify({'success': True, 'frames': frames, 'total': len(frames)})
    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500
