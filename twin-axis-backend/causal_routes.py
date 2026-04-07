from flask import Blueprint, request, jsonify, send_file
import os
import shutil
import uuid
import threading
from datetime import datetime
import pandas as pd
from causal import run_causal_analysis

# --- Causal Code Integration ---
# This blueprint handles the Causal Engine logic integrated from the causal application.

causal_bp = Blueprint('causal', __name__)

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BACKEND_DIR, "causal_uploads")
OUTPUT_DIR = os.path.join(BACKEND_DIR, "B_Matrices")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Global Shared Queue State
global_queue = []
worker_thread = None
queue_lock = threading.Lock()
cancelled_ids = set()

def queue_worker():
    global global_queue, cancelled_ids
    
    while True:
        with queue_lock:
            # Find the first pending item
            item = next((i for i in global_queue if i["status"] == "pending"), None)
            
            if not item:
                break # No more pending items
            
            # Update status to processing
            item["status"] = "processing"
            current_id = item["id"]
            
        file_path = item["file_path"]
        params = item["params"]
        
        def stop_check():
            with queue_lock:
                return current_id in cancelled_ids
        
        try:
            # Run the heavy analysis with cancellation check
            best_L = run_causal_analysis(
                filepath=file_path,
                Lmin=params["Lmin"],
                Lmax=params["Lmax"],
                SET_LAMBDA=params["lamda"],
                output_name=item["output_name"],
                output_dir=OUTPUT_DIR,
                check_stop_callback=stop_check
            )
            
            with queue_lock:
                if current_id in cancelled_ids:
                    # Item was cancelled, so we don't mark as completed/failed
                    # and we don't keep it in the queue list
                    cancelled_ids.discard(current_id)
                    # The item is already removed from global_queue when remove is called
                    continue 

                if best_L is not None:
                    item["status"] = "completed"
                    item["best_L"] = best_L
                else:
                    item["status"] = "failed"
                    item["error"] = "Process interrupted or stopped."
                
                item["finished_at"] = datetime.now().timestamp()
        except Exception as e:
            print(f"Error processing {item['filename']}: {e}")
            with queue_lock:
                if current_id not in cancelled_ids:
                    item["status"] = "failed"
                    item["error"] = str(e)
                    item["finished_at"] = datetime.now().timestamp()
                else:
                    cancelled_ids.discard(current_id)
        finally:
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except:
                    pass
    
    global worker_thread
    worker_thread = None

def start_worker():
    global worker_thread
    if worker_thread is None or not worker_thread.is_alive():
        worker_thread = threading.Thread(target=queue_worker, daemon=True)
        worker_thread.start()

@causal_bp.route('/api/causal/queue', methods=['GET'])
def get_queue():
    global global_queue
    now = datetime.now().timestamp()
    AUTO_REMOVE_AFTER_SECONDS = 60
    
    with queue_lock:
        # Auto-remove completed/failed items older than 60 seconds
        global_queue = [
            i for i in global_queue 
            if i["status"] not in ["completed", "failed"] or 
            (i.get("finished_at") is None or (now - i["finished_at"] < AUTO_REMOVE_AFTER_SECONDS))
        ]
        
        return jsonify([{
            "id": i["id"],
            "name": i["filename"],
            "status": i["status"],
            "size": i.get("size", 0),
            "error": i.get("error", ""),
            "finished_at": i.get("finished_at")
        } for i in global_queue])

@causal_bp.route('/api/causal/analyze-batch', methods=['POST'])
def add_to_queue():
    if 'files' not in request.files:
        return jsonify({"error": "No files uploaded"}), 400
    
    files = request.files.getlist('files')
    l_min = int(request.form.get('Lmin', 5))
    l_max = int(request.form.get('Lmax', 15))
    lamda = float(request.form.get('lamda', 0.1))
    
    new_items = []
    for file in files:
        filename_lower = file.filename.lower()
        if not (filename_lower.endswith('.csv') or filename_lower.endswith('.xlsx') or filename_lower.endswith('.xls')):
            continue
            
        file_id = str(uuid.uuid4())
        file_path = os.path.join(UPLOAD_DIR, f"{file_id}_{file.filename}")
        
        file.save(file_path)
        
        # Get file size
        file_size = os.stat(file_path).st_size
            
        item = {
            "id": file_id,
            "filename": file.filename,
            "file_path": file_path,
            "output_name": os.path.splitext(file.filename)[0],
            "status": "pending",
            "size": file_size,
            "params": {"Lmin": l_min, "Lmax": l_max, "lamda": lamda},
            "finished_at": None
        }
        with queue_lock:
            global_queue.append(item)
        new_items.append(file_id)

    start_worker()
    
    return jsonify({"added": len(new_items), "status": "queued"})

@causal_bp.route('/api/causal/queue/clear-completed', methods=['POST'])
def clear_completed():
    global global_queue
    with queue_lock:
        global_queue = [i for i in global_queue if i["status"] not in ["completed", "failed"]]
    return jsonify({"status": "cleared"})

@causal_bp.route('/api/causal/queue/<item_id>', methods=['DELETE'])
def remove_from_queue(item_id):
    global global_queue, cancelled_ids
    with queue_lock:
        item_index = next((idx for idx, i in enumerate(global_queue) if i["id"] == item_id), -1)
        if item_index != -1:
            item = global_queue[item_index]
            # Record as cancelled
            cancelled_ids.add(item_id)
            
            if os.path.exists(item.get("file_path", "")):
                try:
                    os.remove(item["file_path"])
                except:
                    pass
            global_queue.pop(item_index)
            return jsonify({"status": "removed"})
    return jsonify({"error": "Item not found"}), 404

@causal_bp.route('/api/causal/queue/move', methods=['POST'])
def move_queue_item():
    item_id = request.form.get('item_id')
    direction = request.form.get('direction')
    
    with queue_lock:
        idx = next((i for i, v in enumerate(global_queue) if v["id"] == item_id), -1)
        if idx == -1: return jsonify({"error": "not found"}), 404
        
        # Only allow moving pending items
        if global_queue[idx]["status"] != "pending":
            return jsonify({"error": "only pending items can be moved"}), 400

        new_idx = idx - 1 if direction == "up" else idx + 1
        if 0 <= new_idx < len(global_queue):
            # Also swap only with pending items for consistency
            if global_queue[new_idx]["status"] == "pending":
                global_queue[idx], global_queue[new_idx] = global_queue[new_idx], global_queue[idx]
                return jsonify({"status": "moved"})
    return jsonify({"status": "no action"})

@causal_bp.route('/api/causal/outputs', methods=['GET'])
def list_outputs():
    if not os.path.exists(OUTPUT_DIR):
        return jsonify([])
        
    files = [f for f in os.listdir(OUTPUT_DIR) if f.endswith('.xlsx')]
    results = []
    for f in files:
        path = os.path.join(OUTPUT_DIR, f)
        stats = os.stat(path)
        results.append({
            "name": f,
            "size": stats.st_size,
            "modified": stats.st_mtime
        })
    return jsonify(sorted(results, key=lambda x: x['modified'], reverse=True))

@causal_bp.route('/api/causal/output-data/<filename>', methods=['GET'])
def get_output_data(filename):
    file_path = os.path.join(OUTPUT_DIR, filename)
    if not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 404
    
    try:
        df = pd.read_excel(file_path)
        return jsonify({
            "columns": df.columns.tolist(),
            "data": df.values.tolist()
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@causal_bp.route('/api/causal/output/<filename>', methods=['DELETE'])
def delete_output(filename):
    file_path = os.path.join(OUTPUT_DIR, filename)
    if not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 404
    try:
        os.remove(file_path)
        return jsonify({"status": "deleted"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@causal_bp.route('/api/causal/download/<filename>', methods=['GET'])
def download_output(filename):
    file_path = os.path.join(OUTPUT_DIR, filename)
    if not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 404
    return send_file(file_path, as_attachment=True, download_name=filename)
